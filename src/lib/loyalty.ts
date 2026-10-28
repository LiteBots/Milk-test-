import 'server-only';
import mongoose, { type Types } from 'mongoose';
import {
  LoyaltyConfig,
  User,
  Order,
  Coupon,
  CouponUse,
  Reward,
  PointTransaction,
  WalletTransaction,
  type ILoyaltyConfig,
  type IOrder,
  type IUser
} from './models';
import { HttpError } from './http';
import { randomCode, round2 } from './util';
import { localParts } from './hours';
import { pushToUser } from './notify';

export async function getLoyaltyConfig(): Promise<ILoyaltyConfig> {
  let cfg = await LoyaltyConfig.findOne({ key: 'main' }).lean<ILoyaltyConfig>();
  if (!cfg) {
    await LoyaltyConfig.updateOne({ key: 'main' }, { $setOnInsert: { key: 'main' } }, { upsert: true });
    cfg = await LoyaltyConfig.findOne({ key: 'main' }).lean<ILoyaltyConfig>();
  }
  return cfg!;
}

export function tierFor(cfg: ILoyaltyConfig, yearSpent: number) {
  const sorted = [...cfg.tiers].sort((a, b) => b.minYearSpent - a.minYearSpent);
  return sorted.find((t) => yearSpent >= t.minYearSpent) || cfg.tiers[0];
}

export function nextTier(cfg: ILoyaltyConfig, yearSpent: number) {
  return [...cfg.tiers].sort((a, b) => a.minYearSpent - b.minYearSpent).find((t) => t.minYearSpent > yearSpent) || null;
}

const historyEntry = (text: string) => ({ text, date: new Date().toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' }) });

export function pushHistory(texts: string[]) {
  return { $push: { history: { $each: texts.map(historyEntry), $position: 0, $slice: 50 } } };
}

/* ---------- Wygasanie punktów (leniwe – przy odczycie konta) ---------- */
export async function expirePointsIfNeeded(user: Pick<IUser, '_id' | 'points' | 'pointsExpireAt'>) {
  if (user.points > 0 && user.pointsExpireAt && new Date(user.pointsExpireAt) < new Date()) {
    await User.updateOne(
      { _id: user._id, points: user.points },
      { $set: { points: 0, pointsExpireAt: null }, ...pushHistory([`- ${user.points} pkt • Punkty wygasły po okresie nieaktywności`]) }
    );
    return true;
  }
  return false;
}

/* ---------- Przy składaniu zamówienia: zużycie nagrody, kuponu, portfela ---------- */
export async function consumeOrderBenefits(
  order: Pick<IOrder, '_id' | 'orderNumber' | 'userId' | 'customerPhone' | 'couponCode' | 'rewardUsed' | 'walletUsed' | 'discount'>,
  couponId: string | null,
  couponDiscount: number
) {
  const userId = order.userId;
  if (order.walletUsed > 0) {
    if (!userId) throw new HttpError(400, 'Płatność portfelem wymaga zalogowania.');
    const res = await User.updateOne(
      { _id: userId, walletBalance: { $gte: order.walletUsed } },
      { $inc: { walletBalance: -order.walletUsed }, ...pushHistory([`- ${order.walletUsed.toFixed(2)} zł • Zamówienie ${order.orderNumber}`]) }
    );
    if (!res.modifiedCount) throw new HttpError(400, 'Za mało środków w portfelu.');
    const u = await User.findById(userId, 'username phone').lean();
    await WalletTransaction.create({
      userId,
      userDisplay: `${u?.username} (${u?.phone})`,
      amount: order.walletUsed,
      action: 'remove',
      reason: `Zamówienie ${order.orderNumber}`,
      orderId: order._id
    });
  }
  if (order.rewardUsed && userId) {
    if (order.rewardUsed === 'stamp') {
      await User.updateOne({ _id: userId, stampRewardsAvailable: { $gte: 1 } }, { $inc: { stampRewardsAvailable: -1 } });
    } else {
      await User.updateOne(
        { _id: userId, 'activeRewards.code': order.rewardUsed },
        { $set: { 'activeRewards.$.usedAt': new Date() } }
      );
    }
  }
  if (couponId) {
    await Coupon.updateOne({ _id: couponId }, { $inc: { usedCount: 1 } });
    await CouponUse.create({ couponId, userId: userId || null, phone: order.customerPhone, orderId: order._id, discount: couponDiscount });
  }
}

/* ---------- Anulowanie: zwrot portfela, nagrody i kuponu ---------- */
export async function restoreOrderBenefits(order: IOrder) {
  if (order.userId && order.walletUsed > 0) {
    await User.updateOne(
      { _id: order.userId },
      { $inc: { walletBalance: order.walletUsed }, ...pushHistory([`+ ${order.walletUsed.toFixed(2)} zł • Zwrot za anulowane ${order.orderNumber}`]) }
    );
    await WalletTransaction.create({
      userId: order.userId,
      userDisplay: order.customerName,
      amount: order.walletUsed,
      action: 'add',
      reason: `Zwrot – anulowane ${order.orderNumber}`,
      orderId: order._id
    });
  }
  if (order.userId && order.rewardUsed) {
    if (order.rewardUsed === 'stamp') await User.updateOne({ _id: order.userId }, { $inc: { stampRewardsAvailable: 1 } });
    else
      await User.updateOne({ _id: order.userId, 'activeRewards.code': order.rewardUsed }, { $set: { 'activeRewards.$.usedAt': null } });
  }
  if (order.couponCode) {
    const c = await Coupon.findOne({ code: order.couponCode });
    if (c) {
      await Coupon.updateOne({ _id: c._id, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } });
      await CouponUse.deleteOne({ couponId: c._id, orderId: order._id });
    }
  }
}

/* ---------- Po wydaniu zamówienia: punkty, pieczątki, poziom, polecenia ---------- */
export async function awardOrderLoyalty(orderId: Types.ObjectId | string) {
  // Atomowo oznaczamy zamówienie jako przetworzone – brak podwójnego naliczenia
  const order = await Order.findOneAndUpdate(
    { _id: orderId, loyaltyProcessed: { $ne: true }, userId: { $ne: null } },
    { $set: { loyaltyProcessed: true } },
    { new: true }
  ).lean<IOrder>();
  if (!order || !order.userId) return;
  const user = await User.findById(order.userId).lean<IUser>();
  if (!user) return;

  const cfg = await getLoyaltyConfig();
  const year = Number(localParts().date.slice(0, 4));
  const spentBase = Math.max(0, round2(order.subtotal - (order.discount || 0)));
  const yearSpentBefore = user.yearSpentYear === year ? user.yearSpent || 0 : 0;
  const tier = tierFor(cfg, yearSpentBefore);
  const points = Math.floor((spentBase / Math.max(1, cfg.pointsPerAmount)) * (tier.multiplier || 1));

  let stampsEarned = 0;
  if (cfg.stampsEnabled) {
    stampsEarned = order.items
      .filter((i) => i.type === 'product' && String(i.categoryId || '').startsWith(cfg.stampCategoryPrefix))
      .reduce((s, i) => s + i.quantity, 0);
    if (order.rewardUsed === 'stamp') stampsEarned = Math.max(0, stampsEarned - 1);
  }
  const totalStamps = (user.stamps || 0) + stampsEarned;
  const newRewards = cfg.stampsEnabled ? Math.floor(totalStamps / cfg.stampsRequired) : 0;
  const stampsLeft = cfg.stampsEnabled ? totalStamps % cfg.stampsRequired : user.stamps || 0;
  const yearSpent = round2(yearSpentBefore + spentBase);
  const newTier = tierFor(cfg, yearSpent);

  const texts: string[] = [];
  if (points > 0) texts.push(`+ ${points} pkt • Zamówienie ${order.orderNumber}`);
  if (newRewards > 0) texts.push(`🎁 Darmowy shake do odebrania (${cfg.stampsRequired} pieczątek)`);
  if (newTier.key !== user.tier) texts.push(`Nowy poziom: ${newTier.name}`);

  const expiry = cfg.pointsExpiryMonths > 0 ? new Date(Date.now() + cfg.pointsExpiryMonths * 30 * 24 * 3600 * 1000) : null;
  await User.updateOne(
    { _id: user._id },
    {
      $inc: { points, lifetimeSpent: spentBase, stampRewardsAvailable: newRewards },
      $set: { stamps: stampsLeft, yearSpent, yearSpentYear: year, tier: newTier.key, lastOrderAt: new Date(), pointsExpireAt: expiry },
      ...(texts.length ? pushHistory(texts) : {})
    }
  );
  await Order.updateOne({ _id: order._id }, { $set: { pointsEarned: points, stampsEarned } });
  if (points > 0) {
    await PointTransaction.create({
      userId: user._id,
      userDisplay: `${user.username} (${user.phone})`,
      amountSpent: spentBase,
      pointsAwarded: points,
      reason: `Zamówienie ${order.orderNumber}`,
      orderId: order._id,
      location: order.location
    });
  }

  // Polecenia: przy pierwszym wydanym zamówieniu poleconego obie strony dostają punkty
  if (cfg.referralEnabled && user.referredBy && !user.referralRewarded) {
    const flagged = await User.updateOne({ _id: user._id, referralRewarded: { $ne: true } }, { $set: { referralRewarded: true } });
    if (flagged.modifiedCount) {
      await User.updateOne(
        { _id: user._id },
        { $inc: { points: cfg.referralPointsReferee }, ...pushHistory([`+ ${cfg.referralPointsReferee} pkt • Bonus za polecenie`]) }
      );
      await User.updateOne(
        { _id: user.referredBy },
        { $inc: { points: cfg.referralPointsReferrer }, ...pushHistory([`+ ${cfg.referralPointsReferrer} pkt • Znajomy złożył pierwsze zamówienie`]) }
      );
      pushToUser(user.referredBy, { title: 'Punkty za polecenie', body: `Dostajesz ${cfg.referralPointsReferrer} pkt – znajomy złożył pierwsze zamówienie.`, url: '/app' }).catch(() => {});
    }
  }

  if (points > 0 || newRewards > 0) {
    pushToUser(user._id, {
      title: newRewards > 0 ? 'Darmowy shake czeka!' : `+${points} pkt w MilkMi`,
      body: newRewards > 0 ? 'Zebrałeś komplet pieczątek. Odbierz shake przy następnym zamówieniu.' : `Dziękujemy za zamówienie ${order.orderNumber}.`,
      url: '/app'
    }).catch(() => {});
  }
}

/* ---------- Wymiana punktów na portfel ---------- */
export async function redeemWalletVoucher(userId: string, cost: number) {
  const cfg = await getLoyaltyConfig();
  const v = cfg.walletVouchers.find((x) => x.cost === cost);
  if (!v) throw new HttpError(400, 'Nieprawidłowy bon.');
  const res = await User.findOneAndUpdate(
    { _id: userId, points: { $gte: v.cost } },
    {
      $inc: { points: -v.cost, redeemedPoints: v.cost, walletBalance: v.value },
      ...pushHistory([`- ${v.cost} pkt • Wymiana na portfel`, `+ ${v.value.toFixed(2)} zł • Bon z punktów`])
    },
    { new: true }
  ).lean<IUser>();
  if (!res) throw new HttpError(400, 'Niewystarczająca liczba punktów.');
  await WalletTransaction.create({ userId: res._id, userDisplay: `${res.username} (${res.phone})`, amount: v.value, action: 'add', reason: 'Wymiana punktów' });
  await PointTransaction.create({ userId: res._id, userDisplay: `${res.username} (${res.phone})`, pointsAwarded: -v.cost, reason: 'Wymiana na portfel' });
  return res;
}

/* ---------- Odbiór nagrody z katalogu (produkt za punkty) ---------- */
export async function claimReward(userId: string, rewardId: string) {
  if (!mongoose.isValidObjectId(rewardId)) throw new HttpError(400, 'Nieprawidłowa nagroda.');
  const reward = await Reward.findOne({ _id: rewardId, active: true }).lean();
  if (!reward) throw new HttpError(404, 'Nagroda nie jest już dostępna.');
  const code = `R-${randomCode(6)}`;
  const res = await User.findOneAndUpdate(
    { _id: userId, points: { $gte: reward.cost } },
    {
      $inc: { points: -reward.cost, redeemedPoints: reward.cost },
      $push: { activeRewards: { rewardId: String(reward._id), name: reward.name, cost: reward.cost, dateClaimed: new Date(), code, usedAt: null } }
    },
    { new: true }
  ).lean<IUser>();
  if (!res) throw new HttpError(400, 'Niewystarczająca liczba punktów.');
  await User.updateOne({ _id: userId }, pushHistory([`- ${reward.cost} pkt • Nagroda: ${reward.name}`]));
  await PointTransaction.create({ userId: res._id, userDisplay: `${res.username} (${res.phone})`, pointsAwarded: -reward.cost, reason: `Nagroda: ${reward.name}` });
  return { code, name: reward.name };
}

/* ---------- Kupony automatyczne: urodzinowy i na pierwsze zamówienie w aplikacji ---------- */
export async function ensureAutoCoupons(user: IUser) {
  const cfg = await getLoyaltyConfig();
  const now = localParts();
  const year = Number(now.date.slice(0, 4));
  const month = now.date.slice(5, 7);

  if (cfg.birthdayCouponEnabled && user.birthday && user.birthday.slice(0, 2) === month && user.birthdayCouponYear !== year) {
    const flagged = await User.updateOne({ _id: user._id, birthdayCouponYear: { $ne: year } }, { $set: { birthdayCouponYear: year } });
    if (flagged.modifiedCount) {
      const end = new Date();
      end.setDate(end.getDate() + 30);
      await Coupon.create({
        code: `URODZINY-${randomCode(5)}`,
        name: `Urodzinowe ${cfg.birthdayCouponPercent}%`,
        type: 'percent',
        value: cfg.birthdayCouponPercent,
        usesPerUser: 1,
        maxUses: 1,
        userId: user._id,
        validTo: end,
        origin: 'birthday'
      });
      pushToUser(user._id, { title: 'Wszystkiego najlepszego!', body: `Masz -${cfg.birthdayCouponPercent}% na zamówienie w aplikacji.`, url: '/app/kupony' }, 'marketing').catch(() => {});
    }
  }

  if (cfg.firstAppOrderCouponEnabled) {
    const hasAny = await Coupon.exists({ userId: user._id, origin: 'first_order' });
    if (!hasAny) {
      const ordered = await Order.exists({ userId: user._id, source: 'app' });
      if (!ordered) {
        await Coupon.create({
          code: `START-${randomCode(5)}`,
          name: `Na start -${cfg.firstAppOrderPercent}%`,
          type: 'percent',
          value: cfg.firstAppOrderPercent,
          usesPerUser: 1,
          maxUses: 1,
          appOnly: true,
          userId: user._id,
          origin: 'first_order'
        });
      }
    }
  }
}

/* ---------- Ręczne operacje z kasy / panelu ---------- */
export async function adjustPoints(userId: string, delta: number, reason: string, staffName: string, amountSpent = 0) {
  if (!Number.isFinite(delta) || delta === 0) throw new HttpError(400, 'Podaj liczbę punktów.');
  const filter = delta < 0 ? { _id: userId, points: { $gte: -delta } } : { _id: userId };
  const cfg = await getLoyaltyConfig();
  const expiry = delta > 0 && cfg.pointsExpiryMonths > 0 ? { pointsExpireAt: new Date(Date.now() + cfg.pointsExpiryMonths * 30 * 24 * 3600 * 1000) } : {};
  const u = await User.findOneAndUpdate(
    filter,
    { $inc: { points: delta }, $set: { ...expiry }, ...pushHistory([`${delta > 0 ? '+' : '-'} ${Math.abs(delta)} pkt • ${reason}`]) },
    { new: true }
  ).lean<IUser>();
  if (!u) throw new HttpError(400, 'Klient ma za mało punktów.');
  await PointTransaction.create({ userId: u._id, userDisplay: `${u.username} (${u.phone})`, amountSpent, pointsAwarded: delta, reason, staffName });
  return u;
}

export async function adjustWallet(userId: string, delta: number, reason: string, staffName: string) {
  if (!Number.isFinite(delta) || delta === 0) throw new HttpError(400, 'Podaj kwotę.');
  const amount = round2(Math.abs(delta));
  const filter = delta < 0 ? { _id: userId, walletBalance: { $gte: amount } } : { _id: userId };
  const u = await User.findOneAndUpdate(
    filter,
    { $inc: { walletBalance: delta < 0 ? -amount : amount }, ...pushHistory([`${delta > 0 ? '+' : '-'} ${amount.toFixed(2)} zł • ${reason}`]) },
    { new: true }
  ).lean<IUser>();
  if (!u) throw new HttpError(400, 'Brak wystarczających środków w portfelu klienta.');
  await WalletTransaction.create({
    userId: u._id,
    userDisplay: `${u.username} (${u.phone})`,
    amount,
    action: delta > 0 ? 'add' : 'remove',
    reason,
    staffName
  });
  return u;
}

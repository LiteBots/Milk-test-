import 'server-only';
import mongoose, { type Types } from 'mongoose';
import { Product, Location, UpsellConfig, Coupon, CouponUse, User, Reward, type IProduct, type ILocation, type OrderItem } from './models';
import { getLoyaltyConfig } from './loyalty';
import { HttpError } from './http';
import { round2 } from './util';
import { localParts } from './hours';

export interface CartLineInput {
  type?: 'product' | 'upsell';
  productId: string;
  variant?: string | null;
  addonIds?: string[];
  set?: { side: string; drink: string } | null;
  quantity: number;
}

export interface QuoteInput {
  items: CartLineInput[];
  location: string;
  couponCode?: string | null;
  reward?: string | null; // 'stamp' albo kod aktywnej nagrody użytkownika
  deliveryMethod?: 'pickup' | 'delivery';
  paymentMethod?: string;
  userId?: string | null;
  phone?: string | null;
  source: 'web' | 'app' | 'kiosk';
}

export interface Quote {
  items: OrderItem[];
  subtotal: number;
  packagingFee: number;
  deliveryFee: number;
  couponDiscount: number;
  rewardDiscount: number;
  discount: number;
  total: number;
  coupon: { id: string; code: string; name: string } | null;
  couponError: string | null;
  reward: { key: string; label: string } | null;
  rewardError: string | null;
  walletBalance: number | null;
  warnings: string[];
  location: ILocation;
}

/* ---------- Dostępność i ceny produktów w lokalu ---------- */
export function productVisibleAt(p: Pick<IProduct, 'location'>, loc: string) {
  return !p.location || p.location === 'all' || p.location === loc;
}

export function inSeason(p: Pick<IProduct, 'seasonFrom' | 'seasonTo'>, today = localParts().date) {
  if (p.seasonFrom && today < p.seasonFrom) return false;
  if (p.seasonTo && today > p.seasonTo) return false;
  return true;
}

export function productAvailableAt(p: IProduct, loc: string) {
  return p.available !== false && !(p.unavailableAt || []).includes(loc) && productVisibleAt(p, loc) && inSeason(p);
}

// Cena bazowa i warianty z uwzględnieniem cen różnych dla lokali
export function effectivePricing(p: Pick<IProduct, 'price' | 'variants' | 'hasVariants' | 'priceOverrides'>, loc: string) {
  const o = (p.priceOverrides || []).find((x) => x.location === loc);
  const variants =
    p.hasVariants && p.variants?.length
      ? p.variants.map((v) => {
          const ov = o?.variants?.find((x) => x.name === v.name);
          return { name: v.name, price: Number(ov?.price ?? v.price) || 0 };
        })
      : [];
  const price = o && o.price != null ? Number(o.price) : Number(p.price ?? 0);
  return { price, variants, fromPrice: variants.length ? Math.min(...variants.map((v) => v.price)) : price };
}

export async function getLocation(slug: string): Promise<ILocation> {
  const loc = await Location.findOne({ slug }).lean<ILocation>();
  if (!loc) throw new HttpError(400, 'Nieznany lokal.');
  return loc;
}

/* ---------- Wycena koszyka – jedyne źródło prawdy o cenach ---------- */
export async function quoteCart(input: QuoteInput): Promise<Quote> {
  const location = await getLocation(input.location);
  if (!Array.isArray(input.items) || input.items.length === 0) throw new HttpError(400, 'Koszyk jest pusty.');
  if (input.items.length > 60) throw new HttpError(400, 'Za dużo pozycji w koszyku.');

  const warnings: string[] = [];
  const productIds = input.items
    .filter((i) => i.type !== 'upsell' && mongoose.isValidObjectId(i.productId))
    .map((i) => i.productId);
  const products = await Product.find({ _id: { $in: productIds } }).lean<IProduct[]>();
  const byId = new Map(products.map((p) => [String(p._id), p]));
  const upsellDoc = await UpsellConfig.findOne({ location: location.slug }).lean();
  const upsellItems = upsellDoc?.items || [];

  const items: OrderItem[] = [];
  for (const raw of input.items) {
    const quantity = Math.floor(Number(raw.quantity));
    if (!Number.isFinite(quantity) || quantity < 1 || quantity > 30) throw new HttpError(400, 'Nieprawidłowa ilość produktu.');

    if (raw.type === 'upsell') {
      const u = upsellItems.find((x) => String(x.id) === String(raw.productId));
      if (!u) {
        warnings.push('Jeden z dodatków nie jest już dostępny i został usunięty.');
        continue;
      }
      items.push({ type: 'upsell', productId: String(u.id), name: u.name, price: round2(Number(u.price) || 0), quantity, desc: '' });
      continue;
    }

    const p = byId.get(String(raw.productId));
    if (!p || !productAvailableAt(p, location.slug)) {
      throw new HttpError(409, `${p ? p.name : 'Produkt'} jest chwilowo niedostępny – usuń go z koszyka.`);
    }
    const pricing = effectivePricing(p, location.slug);
    let unit = pricing.price;
    let variantName: string | null = null;
    if (pricing.variants.length) {
      const v = pricing.variants.find((x) => x.name === raw.variant) || null;
      if (!v) throw new HttpError(400, `Wybierz wariant: ${p.name}.`);
      unit = v.price;
      variantName = v.name;
    }
    const addonIds = Array.isArray(raw.addonIds) ? raw.addonIds.map(String).slice(0, 20) : [];
    const addons = (p.addons || []).filter((a) => addonIds.includes(String(a.id)));
    unit += addons.reduce((s, a) => s + (Number(a.price) || 0), 0);

    let set: OrderItem['set'] = null;
    if (raw.set && p.allowSet) {
      const side = location.setSides.includes(raw.set.side) ? raw.set.side : location.setSides[0];
      const drink = location.setDrinks.includes(raw.set.drink) ? raw.set.drink : location.setDrinks[0];
      set = { side, drink };
      unit += location.mealSetPrice;
    }
    const desc = [set ? `Zestaw: ${set.side}, ${set.drink}` : '', ...addons.map((a) => `+ ${a.name}`)].filter(Boolean).join(' | ');
    items.push({
      type: 'product',
      productId: String(p._id),
      name: variantName ? `${p.name} (${variantName})` : p.name,
      variant: variantName,
      price: round2(unit),
      quantity,
      desc,
      addonIds: addons.map((a) => String(a.id)),
      set,
      categoryId: p.categoryId
    });
  }
  if (!items.length) throw new HttpError(400, 'Koszyk jest pusty.');

  const subtotal = round2(items.reduce((s, i) => s + i.price * i.quantity, 0));
  const packagingFee = round2(location.packagingFee || 0);
  const delivery = input.deliveryMethod === 'delivery';
  if (delivery && !location.deliveryEnabled) throw new HttpError(400, 'Dostawa jest obecnie niedostępna – wybierz odbiór.');
  if (delivery && subtotal < (location.deliveryMinOrder || 0)) {
    throw new HttpError(400, `Minimalna kwota zamówienia z dostawą to ${location.deliveryMinOrder} zł.`);
  }
  const deliveryFee = delivery && subtotal < (location.freeDeliveryThreshold || 0) ? round2(location.deliveryFee || 0) : 0;

  /* ----- Nagroda (pieczątki lub produkt za punkty) ----- */
  let rewardDiscount = 0;
  let reward: Quote['reward'] = null;
  let rewardError: string | null = null;
  let walletBalance: number | null = null;
  const user = input.userId && mongoose.isValidObjectId(input.userId) ? await User.findById(input.userId).lean() : null;
  if (user) walletBalance = round2(user.walletBalance || 0);

  if (input.reward) {
    if (!user) rewardError = 'Zaloguj się w aplikacji, aby użyć nagrody.';
    else if (input.reward === 'stamp') {
      const cfg = await getLoyaltyConfig();
      if ((user.stampRewardsAvailable || 0) < 1) rewardError = 'Nie masz jeszcze darmowego shake’a.';
      else {
        const eligible = items
          .filter((i) => i.type === 'product' && String(i.categoryId || '').startsWith(cfg.stampCategoryPrefix))
          .sort((a, b) => b.price - a.price);
        if (!eligible.length) rewardError = 'Dodaj do koszyka shake’a, aby odebrać go gratis.';
        else {
          rewardDiscount = round2(Math.min(eligible[0].price, cfg.stampRewardMaxValue || eligible[0].price));
          reward = { key: 'stamp', label: `Darmowy shake (${cfg.stampsRequired}. pieczątka)` };
        }
      }
    } else {
      const r = (user.activeRewards || []).find((x) => x.code === input.reward && !x.usedAt);
      if (!r) rewardError = 'Ta nagroda została już wykorzystana.';
      else {
        const def = mongoose.isValidObjectId(r.rewardId) ? await Reward.findById(r.rewardId).lean() : null;
        const line = def?.productId ? items.find((i) => i.productId === def.productId) : null;
        if (def && !def.productId) rewardError = 'Tę nagrodę odbierasz przy kasie – pokaż kod z aplikacji.';
        else if (!def || !line) rewardError = `Dodaj do koszyka produkt z nagrody: ${r.name}.`;
        else {
          rewardDiscount = round2(Math.min(line.price, def.maxValue || line.price));
          reward = { key: r.code!, label: r.name };
        }
      }
    }
  }

  /* ----- Kupon ----- */
  let couponDiscount = 0;
  let coupon: Quote['coupon'] = null;
  let couponError: string | null = null;
  if (input.couponCode) {
    const res = await evaluateCoupon(input.couponCode, {
      subtotal: subtotal - rewardDiscount,
      items,
      location: location.slug,
      source: input.source,
      userId: user?._id ?? null,
      phone: input.phone || null
    });
    if ('error' in res) couponError = res.error ?? null;
    else {
      couponDiscount = res.discount;
      coupon = { id: String(res.coupon._id), code: res.coupon.code, name: res.coupon.name };
    }
  }

  const discount = round2(Math.min(subtotal, couponDiscount + rewardDiscount));
  const total = round2(Math.max(0, subtotal - discount) + packagingFee + deliveryFee);
  return {
    items,
    subtotal,
    packagingFee,
    deliveryFee,
    couponDiscount,
    rewardDiscount,
    discount,
    total,
    coupon,
    couponError,
    reward,
    rewardError,
    walletBalance,
    warnings,
    location
  };
}

/* ---------- Kupony ---------- */
export async function evaluateCoupon(
  code: string,
  ctx: { subtotal: number; items: OrderItem[]; location: string; source: string; userId: Types.ObjectId | null; phone: string | null }
) {
  const c = await Coupon.findOne({ code: String(code).trim().toUpperCase() }).lean();
  if (!c || !c.active) return { error: 'Nieprawidłowy kod rabatowy.' } as const;
  const now = new Date();
  if (c.validFrom && now < new Date(c.validFrom)) return { error: 'Ten kod jeszcze nie obowiązuje.' } as const;
  if (c.validTo && now > new Date(c.validTo)) return { error: 'Ten kod wygasł.' } as const;
  if (c.appOnly && ctx.source !== 'app') return { error: 'Ten kod działa tylko w aplikacji MilkMi.' } as const;
  if (c.userId && (!ctx.userId || String(c.userId) !== String(ctx.userId))) return { error: 'Ten kod jest przypisany do innego konta.' } as const;
  if (c.locations?.length && !c.locations.includes(ctx.location)) return { error: 'Kod nie obowiązuje w tym lokalu.' } as const;
  if (c.maxUses != null && c.usedCount >= c.maxUses) return { error: 'Limit użyć kodu został wyczerpany.' } as const;
  if (ctx.subtotal < (c.minOrder || 0)) return { error: `Kod działa od ${c.minOrder} zł.` } as const;
  if (c.usesPerUser > 0 && (ctx.userId || ctx.phone)) {
    const used = await CouponUse.countDocuments({
      couponId: c._id,
      ...(ctx.userId ? { userId: ctx.userId } : { phone: ctx.phone })
    });
    if (used >= c.usesPerUser) return { error: 'Ten kod został już przez Ciebie wykorzystany.' } as const;
  }
  let discount = 0;
  if (c.type === 'percent') discount = (ctx.subtotal * Math.min(100, c.value)) / 100;
  else if (c.type === 'amount') discount = c.value;
  else if (c.type === 'free_product') {
    const line = ctx.items.find((i) => i.productId === c.productId);
    if (!line) return { error: 'Dodaj do koszyka produkt objęty kodem.' } as const;
    discount = line.price;
  }
  if (c.maxDiscount) discount = Math.min(discount, c.maxDiscount);
  discount = round2(Math.max(0, Math.min(discount, ctx.subtotal)));
  return { discount, coupon: c } as const;
}

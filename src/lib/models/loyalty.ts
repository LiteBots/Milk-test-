import { Schema, model, models, type Model, type Types } from 'mongoose';

/* ============================================================
   KONFIGURACJA PROGRAMU LOJALNOŚCIOWEGO (jeden dokument)
   ============================================================ */
export interface ILoyaltyConfig {
  key: 'main';
  pointsPerAmount: number; // ile PLN = 1 pkt (domyślnie 10)
  tiers: { key: 'milk' | 'silver' | 'gold'; name: string; minYearSpent: number; multiplier: number; perks: string }[];
  stampsEnabled: boolean;
  stampsRequired: number; // co który shake gratis
  stampCategoryPrefix: string; // kategorie liczone do pieczątek, np. "shakes"
  stampRewardMaxValue: number; // maks. wartość darmowego produktu
  walletVouchers: { cost: number; value: number }[]; // wymiana punktów na portfel
  birthdayCouponEnabled: boolean;
  birthdayCouponPercent: number;
  firstAppOrderCouponEnabled: boolean;
  firstAppOrderPercent: number;
  referralEnabled: boolean;
  referralPointsReferrer: number;
  referralPointsReferee: number;
  topupBonuses: { min: number; bonusPercent: number }[];
  pointsExpiryMonths: number; // 0 = nie wygasają
  updatedAt: Date;
}
const loyaltySchema = new Schema<ILoyaltyConfig>({
  key: { type: String, default: 'main', unique: true },
  pointsPerAmount: { type: Number, default: 10 },
  tiers: {
    type: [{ key: String, name: String, minYearSpent: Number, multiplier: Number, perks: String }],
    default: [
      { key: 'milk', name: 'Milk', minYearSpent: 0, multiplier: 1, perks: '1 pkt za każde 10 zł' },
      { key: 'silver', name: 'Silver', minYearSpent: 500, multiplier: 1.25, perks: '+25% punktów, kupon urodzinowy 20%' },
      { key: 'gold', name: 'Gold', minYearSpent: 1500, multiplier: 1.5, perks: '+50% punktów, nowości przed premierą' }
    ]
  },
  stampsEnabled: { type: Boolean, default: true },
  stampsRequired: { type: Number, default: 10 },
  stampCategoryPrefix: { type: String, default: 'shakes' },
  stampRewardMaxValue: { type: Number, default: 30 },
  walletVouchers: {
    type: [{ cost: Number, value: Number }],
    default: [
      { cost: 10, value: 10 },
      { cost: 20, value: 20 },
      { cost: 50, value: 50 },
      { cost: 100, value: 100 }
    ]
  },
  birthdayCouponEnabled: { type: Boolean, default: true },
  birthdayCouponPercent: { type: Number, default: 15 },
  firstAppOrderCouponEnabled: { type: Boolean, default: true },
  firstAppOrderPercent: { type: Number, default: 10 },
  referralEnabled: { type: Boolean, default: true },
  referralPointsReferrer: { type: Number, default: 20 },
  referralPointsReferee: { type: Number, default: 10 },
  topupBonuses: {
    type: [{ min: Number, bonusPercent: Number }],
    default: [
      { min: 100, bonusPercent: 5 },
      { min: 200, bonusPercent: 8 }
    ]
  },
  pointsExpiryMonths: { type: Number, default: 12 },
  updatedAt: { type: Date, default: Date.now }
});
export const LoyaltyConfig: Model<ILoyaltyConfig> =
  (models.LoyaltyConfig as Model<ILoyaltyConfig>) || model<ILoyaltyConfig>('LoyaltyConfig', loyaltySchema);

/* ============================================================
   NAGRODY ZA PUNKTY (konkretne produkty)
   ============================================================ */
export interface IReward {
  _id: Types.ObjectId;
  name: string;
  description: string;
  cost: number;
  imageUrl?: string;
  productId?: string | null; // powiązany produkt dodawany do zamówienia za 0 zł
  maxValue?: number | null;
  active: boolean;
  sortOrder: number;
}
const rewardSchema = new Schema<IReward>({
  name: { type: String, required: true },
  description: { type: String, default: '' },
  cost: { type: Number, required: true },
  imageUrl: String,
  productId: { type: String, default: null },
  maxValue: { type: Number, default: null },
  active: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 }
});
export const Reward: Model<IReward> = (models.Reward as Model<IReward>) || model<IReward>('Reward', rewardSchema);

/* ============================================================
   KUPONY I KODY RABATOWE
   ============================================================ */
export interface ICoupon {
  _id: Types.ObjectId;
  code: string;
  name: string;
  type: 'percent' | 'amount' | 'free_product';
  value: number; // % lub PLN
  productId?: string | null;
  minOrder: number;
  maxDiscount?: number | null;
  maxUses?: number | null;
  usesPerUser: number;
  usedCount: number;
  validFrom?: Date | null;
  validTo?: Date | null;
  active: boolean;
  appOnly: boolean;
  userId?: Types.ObjectId | null; // kupon osobisty (urodzinowy, nagroda)
  locations: string[];
  origin: 'manual' | 'birthday' | 'first_order' | 'reward' | 'campaign' | 'referral';
  createdAt: Date;
}
const couponSchema = new Schema<ICoupon>({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  name: { type: String, default: '' },
  type: { type: String, enum: ['percent', 'amount', 'free_product'], default: 'percent' },
  value: { type: Number, default: 0 },
  productId: { type: String, default: null },
  minOrder: { type: Number, default: 0 },
  maxDiscount: { type: Number, default: null },
  maxUses: { type: Number, default: null },
  usesPerUser: { type: Number, default: 1 },
  usedCount: { type: Number, default: 0 },
  validFrom: { type: Date, default: null },
  validTo: { type: Date, default: null },
  active: { type: Boolean, default: true },
  appOnly: { type: Boolean, default: false },
  userId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  locations: { type: [String], default: [] },
  origin: { type: String, default: 'manual' },
  createdAt: { type: Date, default: Date.now }
});
export const Coupon: Model<ICoupon> = (models.Coupon as Model<ICoupon>) || model<ICoupon>('Coupon', couponSchema);

export interface ICouponUse {
  couponId: Types.ObjectId;
  userId?: Types.ObjectId | null;
  phone?: string;
  orderId: Types.ObjectId;
  discount: number;
  at: Date;
}
const couponUseSchema = new Schema<ICouponUse>({
  couponId: { type: Schema.Types.ObjectId, ref: 'Coupon', index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  phone: String,
  orderId: { type: Schema.Types.ObjectId, ref: 'Order' },
  discount: Number,
  at: { type: Date, default: Date.now }
});
export const CouponUse: Model<ICouponUse> =
  (models.CouponUse as Model<ICouponUse>) || model<ICouponUse>('CouponUse', couponUseSchema);

/* ============================================================
   KARTY PODARUNKOWE
   ============================================================ */
export interface IGiftCard {
  _id: Types.ObjectId;
  code: string;
  amount: number;
  balance: number;
  buyerName: string;
  buyerEmail: string;
  recipientName: string;
  recipientEmail: string;
  message: string;
  status: 'awaiting_payment' | 'active' | 'redeemed' | 'cancelled';
  payuOrderId?: string | null;
  redeemedBy?: Types.ObjectId | null;
  redeemedAt?: Date | null;
  sentAt?: Date | null;
  validTo: Date;
  createdAt: Date;
}
const giftCardSchema = new Schema<IGiftCard>({
  code: { type: String, required: true, unique: true },
  amount: Number,
  balance: Number,
  buyerName: String,
  buyerEmail: String,
  recipientName: String,
  recipientEmail: String,
  message: { type: String, default: '' },
  status: { type: String, default: 'awaiting_payment' },
  payuOrderId: { type: String, default: null },
  redeemedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  redeemedAt: { type: Date, default: null },
  sentAt: { type: Date, default: null },
  validTo: Date,
  createdAt: { type: Date, default: Date.now }
});
export const GiftCard: Model<IGiftCard> = (models.GiftCard as Model<IGiftCard>) || model<IGiftCard>('GiftCard', giftCardSchema);

/* ============================================================
   DOŁADOWANIA PORTFELA ONLINE
   ============================================================ */
export interface IWalletTopup {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  amount: number;
  bonus: number;
  status: 'awaiting_payment' | 'completed' | 'failed';
  payuOrderId?: string | null;
  createdAt: Date;
}
const topupSchema = new Schema<IWalletTopup>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  amount: Number,
  bonus: { type: Number, default: 0 },
  status: { type: String, default: 'awaiting_payment' },
  payuOrderId: { type: String, default: null },
  createdAt: { type: Date, default: Date.now }
});
export const WalletTopup: Model<IWalletTopup> =
  (models.WalletTopup as Model<IWalletTopup>) || model<IWalletTopup>('WalletTopup', topupSchema);

/* ============================================================
   DZIENNIKI TRANSAKCJI (zgodne ze starymi kolekcjami)
   ============================================================ */
export interface IPointTransaction {
  userId?: Types.ObjectId | null;
  userDisplay: string;
  amountSpent: number;
  pointsAwarded: number; // może być ujemne
  reason?: string;
  orderId?: Types.ObjectId | null;
  staffName?: string;
  location?: string;
  date: Date;
}
const pointTxSchema = new Schema<IPointTransaction>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  userDisplay: String,
  amountSpent: { type: Number, default: 0 },
  pointsAwarded: Number,
  reason: String,
  orderId: { type: Schema.Types.ObjectId, default: null },
  staffName: String,
  location: String,
  date: { type: Date, default: Date.now, index: true }
});
export const PointTransaction: Model<IPointTransaction> =
  (models.PointTransaction as Model<IPointTransaction>) || model<IPointTransaction>('PointTransaction', pointTxSchema);

export interface IWalletTransaction {
  userId?: Types.ObjectId | null;
  userDisplay: string;
  amount: number;
  action: 'add' | 'remove';
  reason?: string;
  orderId?: Types.ObjectId | null;
  staffName?: string;
  date: Date;
}
const walletTxSchema = new Schema<IWalletTransaction>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  userDisplay: String,
  amount: Number,
  action: String,
  reason: String,
  orderId: { type: Schema.Types.ObjectId, default: null },
  staffName: String,
  date: { type: Date, default: Date.now, index: true }
});
export const WalletTransaction: Model<IWalletTransaction> =
  (models.WalletTransaction as Model<IWalletTransaction>) || model<IWalletTransaction>('WalletTransaction', walletTxSchema);

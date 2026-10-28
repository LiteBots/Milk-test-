import mongoose, { Schema, model, models, type Model, type Types } from 'mongoose';

/* ============================================================
   KLIENCI (kolekcja `users` – zgodna ze starą wersją)
   ============================================================ */
export interface IUser {
  _id: Types.ObjectId;
  username: string; // w nowej wersji = imię wyświetlane / login
  name?: string;
  email: string;
  phone: string;
  password?: string;
  points: number;
  walletBalance: number;
  redeemedPoints: number;
  lifetimeSpent: number; // suma zakupów (do poziomów)
  yearSpent: number; // suma w bieżącym roku
  yearSpentYear?: number;
  tier: 'milk' | 'silver' | 'gold';
  stamps: number; // pieczątki do darmowego shake'a
  stampRewardsAvailable: number;
  birthday?: string; // MM-DD
  birthdayCouponYear?: number;
  referralCode?: string;
  referredBy?: Types.ObjectId | null;
  referralRewarded?: boolean;
  favorites: string[]; // productId
  marketingConsent: boolean;
  smsConsent: boolean;
  activeRewards: { rewardId: string; name: string; cost: number; dateClaimed: Date; code?: string; usedAt?: Date | null }[];
  history: { text: string; date: string }[];
  adminNotes?: string;
  tags: string[];
  lastOrderAt?: Date | null;
  lastLoginAt?: Date | null;
  pointsExpireAt?: Date | null;
  createdAt: Date;
}

const userSchema = new Schema<IUser>({
  username: { type: String, required: true, unique: true, trim: true },
  name: { type: String, trim: true },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  phone: { type: String, required: true, trim: true },
  password: { type: String },
  points: { type: Number, default: 0 },
  walletBalance: { type: Number, default: 0 },
  redeemedPoints: { type: Number, default: 0 },
  lifetimeSpent: { type: Number, default: 0 },
  yearSpent: { type: Number, default: 0 },
  yearSpentYear: Number,
  tier: { type: String, enum: ['milk', 'silver', 'gold'], default: 'milk' },
  stamps: { type: Number, default: 0 },
  stampRewardsAvailable: { type: Number, default: 0 },
  birthday: String,
  birthdayCouponYear: Number,
  referralCode: { type: String, index: true, sparse: true, unique: true },
  referredBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  referralRewarded: { type: Boolean, default: false },
  favorites: { type: [String], default: [] },
  marketingConsent: { type: Boolean, default: false },
  smsConsent: { type: Boolean, default: false },
  activeRewards: [
    {
      rewardId: String,
      name: String,
      cost: Number,
      dateClaimed: { type: Date, default: Date.now },
      code: String,
      usedAt: { type: Date, default: null }
    }
  ],
  history: [{ text: String, date: { type: String, default: () => new Date().toLocaleString('pl-PL') } }],
  adminNotes: String,
  tags: { type: [String], default: [] },
  lastOrderAt: { type: Date, default: null },
  lastLoginAt: { type: Date, default: null },
  pointsExpireAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
});
userSchema.index({ phone: 1 });
userSchema.index({ createdAt: -1 });

export const User: Model<IUser> = (models.User as Model<IUser>) || model<IUser>('User', userSchema);

/* ============================================================
   PRACOWNICY PANELU (role)
   ============================================================ */
export type StaffRole = 'owner' | 'manager' | 'cashier' | 'kitchen';
export interface IStaff {
  _id: Types.ObjectId;
  name: string;
  email: string;
  password: string;
  role: StaffRole;
  locations: string[]; // puste = wszystkie
  active: boolean;
  totpSecret?: string | null; // 2FA
  totpEnabled: boolean;
  lastLoginAt?: Date | null;
  failedLogins: number;
  lockedUntil?: Date | null;
  createdAt: Date;
}
const staffSchema = new Schema<IStaff>({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['owner', 'manager', 'cashier', 'kitchen'], default: 'cashier' },
  locations: { type: [String], default: [] },
  active: { type: Boolean, default: true },
  totpSecret: { type: String, default: null },
  totpEnabled: { type: Boolean, default: false },
  lastLoginAt: { type: Date, default: null },
  failedLogins: { type: Number, default: 0 },
  lockedUntil: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
});
export const Staff: Model<IStaff> = (models.Staff as Model<IStaff>) || model<IStaff>('Staff', staffSchema);

/* ============================================================
   LOKALE (godziny, wyjątki, ustawienia zamówień)
   ============================================================ */
export interface DayHours {
  isOpen: boolean;
  from: string; // HH:mm
  to: string;
}
export type WeekKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export interface ILocation {
  _id: Types.ObjectId;
  slug: string;
  name: string;
  city: string;
  street: string;
  postalCode: string;
  phone: string;
  email: string;
  lat: number;
  lng: number;
  mapsUrl: string;
  description: string;
  directions: string; // dojazd / parking (SEO)
  photos: string[];
  seasonal: boolean;
  seasonNote: string;
  active: boolean;
  schedule: Record<WeekKey, DayHours>;
  exceptions: { date: string; closed: boolean; from?: string; to?: string; note?: string }[];
  ordersEnabled: boolean;
  pausedUntil?: Date | null;
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
  reservationsEnabled: boolean;
  prepMinutes: number;
  slotStepMinutes: number;
  maxOrdersPerSlot: number;
  lastOrderMinutesBeforeClose: number;
  packagingFee: number;
  mealSetPrice: number;
  setSides: string[];
  setDrinks: string[];
  deliveryFee: number;
  freeDeliveryThreshold: number;
  deliveryMinOrder: number;
  deliveryZones: string[];
  reservationZones: { key: string; name: string; seats: number }[];
  reservationSlotMinutes: number;
  reservationDurationMinutes: number;
  updatedAt: Date;
}
const day = { isOpen: { type: Boolean, default: true }, from: { type: String, default: '10:00' }, to: { type: String, default: '22:00' } };
const locationSchema = new Schema<ILocation>({
  slug: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  city: String,
  street: String,
  postalCode: String,
  phone: { type: String, default: '' },
  email: { type: String, default: '' },
  lat: Number,
  lng: Number,
  mapsUrl: String,
  description: { type: String, default: '' },
  directions: { type: String, default: '' },
  photos: { type: [String], default: [] },
  seasonal: { type: Boolean, default: false },
  seasonNote: { type: String, default: '' },
  active: { type: Boolean, default: true },
  schedule: { mon: day, tue: day, wed: day, thu: day, fri: day, sat: day, sun: day },
  exceptions: [{ date: String, closed: Boolean, from: String, to: String, note: String }],
  ordersEnabled: { type: Boolean, default: true },
  pausedUntil: { type: Date, default: null },
  pickupEnabled: { type: Boolean, default: true },
  deliveryEnabled: { type: Boolean, default: false },
  reservationsEnabled: { type: Boolean, default: true },
  prepMinutes: { type: Number, default: 20 },
  slotStepMinutes: { type: Number, default: 15 },
  maxOrdersPerSlot: { type: Number, default: 8 },
  lastOrderMinutesBeforeClose: { type: Number, default: 30 },
  packagingFee: { type: Number, default: 2 },
  mealSetPrice: { type: Number, default: 10 },
  setSides: { type: [String], default: ['Frytki', 'Frytki z batatów', 'Krążki cebulowe'] },
  setDrinks: { type: [String], default: ['Coca-Cola', 'Coca-Cola Zero', 'Fanta', 'Woda'] },
  deliveryFee: { type: Number, default: 8 },
  freeDeliveryThreshold: { type: Number, default: 80 },
  deliveryMinOrder: { type: Number, default: 40 },
  deliveryZones: { type: [String], default: [] },
  reservationZones: {
    type: [{ key: String, name: String, seats: Number }],
    default: [
      { key: 'sala', name: 'Sala', seats: 30 },
      { key: 'ogrodek', name: 'Ogródek', seats: 20 }
    ]
  },
  reservationSlotMinutes: { type: Number, default: 30 },
  reservationDurationMinutes: { type: Number, default: 90 },
  updatedAt: { type: Date, default: Date.now }
});
export const Location: Model<ILocation> = (models.Location as Model<ILocation>) || model<ILocation>('Location', locationSchema);

/* ============================================================
   KATEGORIE MENU
   ============================================================ */
export interface ICategory {
  _id: Types.ObjectId;
  key: string; // np. "burgery", "shakes_klasyczne" (zgodne ze starym categoryId)
  slug: string; // adres: /menu/burgery
  name: string;
  nameEn?: string;
  parentKey?: string | null; // podkategoria
  description: string;
  seoTitle?: string;
  seoDescription?: string;
  imageUrl?: string;
  sortOrder: number;
  visible: boolean;
  allowSet: boolean; // kategoria z zestawami (burgery itp.)
  stampEligible: boolean; // liczy się do pieczątek (shake'i)
}
const categorySchema = new Schema<ICategory>({
  key: { type: String, required: true, unique: true },
  slug: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  nameEn: String,
  parentKey: { type: String, default: null },
  description: { type: String, default: '' },
  seoTitle: String,
  seoDescription: String,
  imageUrl: String,
  sortOrder: { type: Number, default: 0 },
  visible: { type: Boolean, default: true },
  allowSet: { type: Boolean, default: false },
  stampEligible: { type: Boolean, default: false }
});
export const Category: Model<ICategory> = (models.Category as Model<ICategory>) || model<ICategory>('Category', categorySchema);

/* ============================================================
   PRODUKTY (kolekcja `products` – zgodna ze starą wersją)
   ============================================================ */
export { ALLERGENS, DIET_TAGS } from '../constants';

export interface IProduct {
  _id: Types.ObjectId;
  name: string;
  nameEn?: string;
  slug?: string;
  description: string;
  descriptionEn?: string;
  price?: number;
  imageUrl: string;
  categoryId: string;
  location?: string; // 'slupsk' | 'rowy' | 'all' (brak = slupsk – zgodność wstecz)
  hasVariants: boolean;
  variants: { name: string; price: number }[];
  allowSet: boolean;
  addons: { id: string; name: string; price: number }[];
  isBestseller: boolean;
  allergens: string[];
  tags: string[];
  kcal?: number | null;
  available: boolean;
  unavailableAt: string[]; // lokale, w których chwilowo brak
  sortOrder: number;
  seasonFrom?: string | null; // YYYY-MM-DD
  seasonTo?: string | null;
  priceOverrides: { location: string; price?: number | null; variants?: { name: string; price: number }[] }[];
  stampEligible?: boolean | null;
  seoTitle?: string;
  seoDescription?: string;
  createdAt: Date;
  updatedAt?: Date;
}
const productSchema = new Schema<IProduct>({
  name: { type: String, required: true },
  nameEn: String,
  slug: { type: String, index: true },
  description: { type: String, default: '' },
  descriptionEn: String,
  price: { type: Number },
  imageUrl: { type: String, default: '' },
  categoryId: { type: String, required: true, index: true },
  location: { type: String, default: 'slupsk' },
  hasVariants: { type: Boolean, default: false },
  variants: [{ name: String, price: Number }],
  allowSet: { type: Boolean, default: false },
  addons: [{ id: String, name: String, price: Number }],
  isBestseller: { type: Boolean, default: false },
  allergens: { type: [String], default: [] },
  tags: { type: [String], default: [] },
  kcal: { type: Number, default: null },
  available: { type: Boolean, default: true },
  unavailableAt: { type: [String], default: [] },
  sortOrder: { type: Number, default: 0 },
  seasonFrom: { type: String, default: null },
  seasonTo: { type: String, default: null },
  priceOverrides: [{ location: String, price: Number, variants: [{ name: String, price: Number }] }],
  stampEligible: { type: Boolean, default: null },
  seoTitle: String,
  seoDescription: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});
export const Product: Model<IProduct> = (models.Product as Model<IProduct>) || model<IProduct>('Product', productSchema);

/* ============================================================
   ZAMÓWIENIA (kolekcja `orders` – zgodna ze starą wersją)
   ============================================================ */
import { ORDER_STATUSES } from '../constants';
export { ORDER_STATUSES };
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface OrderItem {
  type: 'product' | 'upsell' | 'reward';
  productId: string;
  name: string;
  variant?: string | null;
  price: number;
  quantity: number;
  desc?: string;
  addonIds?: string[];
  set?: { side: string; drink: string } | null;
  categoryId?: string;
}
export interface IOrder {
  _id: Types.ObjectId;
  orderNumber: string;
  clientOrderId?: string;
  userId?: Types.ObjectId | null;
  source: 'web' | 'app' | 'kiosk';
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  pickupTime: string; // HH:mm
  pickupDate?: string; // YYYY-MM-DD
  notes: string;
  items: OrderItem[];
  subtotal: number;
  packagingFee: number;
  deliveryFee: number;
  discount: number;
  couponCode?: string | null;
  rewardUsed?: string | null;
  walletUsed: number;
  totalAmount: number; // do zapłaty
  paymentMethod: 'cash' | 'card' | 'online' | 'prepaid';
  paymentStatus: 'unpaid' | 'paid' | 'refunded' | 'failed';
  payuOrderId?: string | null;
  deliveryMethod: 'pickup' | 'delivery';
  deliveryAddress: string;
  location: string;
  status: OrderStatus | string;
  statusHistory: { status: string; at: Date; by?: string }[];
  estimatedReadyAt?: Date | null;
  cancelReason?: string;
  pointsEarned: number;
  stampsEarned: number;
  loyaltyProcessed: boolean;
  rating?: number | null;
  ratingComment?: string;
  createdAt: Date;
}
const orderSchema = new Schema<IOrder>({
  orderNumber: { type: String, index: true },
  clientOrderId: { type: String, index: { unique: true, sparse: true } },
  userId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  source: { type: String, default: 'web' },
  customerName: String,
  customerPhone: String,
  customerEmail: String,
  pickupTime: String,
  pickupDate: String,
  notes: { type: String, default: '' },
  items: { type: Array, default: [] },
  subtotal: { type: Number, default: 0 },
  packagingFee: { type: Number, default: 0 },
  deliveryFee: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  couponCode: { type: String, default: null },
  rewardUsed: { type: String, default: null },
  walletUsed: { type: Number, default: 0 },
  totalAmount: Number,
  paymentMethod: String,
  paymentStatus: { type: String, default: 'unpaid' },
  payuOrderId: { type: String, default: null },
  deliveryMethod: { type: String, default: 'pickup' },
  deliveryAddress: { type: String, default: '' },
  location: { type: String, default: 'slupsk', index: true },
  status: { type: String, default: 'pending', index: true },
  statusHistory: [{ status: String, at: { type: Date, default: Date.now }, by: String }],
  estimatedReadyAt: { type: Date, default: null },
  cancelReason: String,
  pointsEarned: { type: Number, default: 0 },
  stampsEarned: { type: Number, default: 0 },
  loyaltyProcessed: { type: Boolean, default: false },
  rating: { type: Number, default: null },
  ratingComment: String,
  createdAt: { type: Date, default: Date.now, index: true }
});
orderSchema.index({ location: 1, createdAt: -1 });
orderSchema.index({ userId: 1, source: 1, createdAt: -1 });
export const Order: Model<IOrder> = (models.Order as Model<IOrder>) || model<IOrder>('Order', orderSchema);

/* ============================================================
   LICZNIKI (numeracja zamówień MI-XXXX)
   ============================================================ */
interface ICounter {
  id: string;
  seq: number;
}
const counterSchema = new Schema<ICounter>({ id: { type: String, required: true }, seq: { type: Number, default: 0 } });
export const Counter: Model<ICounter> = (models.Counter as Model<ICounter>) || model<ICounter>('Counter', counterSchema);

export async function nextSeq(id: string): Promise<number> {
  const c = await Counter.findOneAndUpdate({ id }, { $inc: { seq: 1 } }, { new: true, upsert: true });
  return c!.seq;
}

export { mongoose };

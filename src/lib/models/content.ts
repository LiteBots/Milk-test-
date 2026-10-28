import { Schema, model, models, type Model, type Types } from 'mongoose';

/* ============================================================
   BANERY / PASKI INFORMACYJNE (kolekcja `banners` – zgodna)
   ============================================================ */
export interface IBanner {
  _id: Types.ObjectId;
  target: string; // 'app' | 'web'
  isActive: boolean;
  text: string;
  link?: string;
  backgroundColor: string;
  startsAt?: Date | null;
  endsAt?: Date | null;
  updatedAt: Date;
}
const bannerSchema = new Schema<IBanner>({
  target: { type: String, required: true, unique: true },
  isActive: { type: Boolean, default: false },
  text: { type: String, default: '' },
  link: { type: String, default: '' },
  backgroundColor: { type: String, default: '#0F172A' },
  startsAt: { type: Date, default: null },
  endsAt: { type: Date, default: null },
  updatedAt: { type: Date, default: Date.now }
});
export const Banner: Model<IBanner> = (models.Banner as Model<IBanner>) || model<IBanner>('Banner', bannerSchema);

/* ============================================================
   UPSELL W KOSZYKU (kolekcja `upsellconfigs` – zgodna)
   ============================================================ */
export interface IUpsellConfig {
  location: string;
  items: { id: string; name: string; price: number; img: string }[];
  rules: { whenCategoryPrefix: string; suggestProductIds: string[] }[];
  updatedAt: Date;
}
const upsellSchema = new Schema<IUpsellConfig>({
  location: { type: String, required: true, unique: true },
  items: [{ id: String, name: String, price: Number, img: String }],
  rules: { type: [{ whenCategoryPrefix: String, suggestProductIds: [String] }], default: [] },
  updatedAt: { type: Date, default: Date.now }
});
export const UpsellConfig: Model<IUpsellConfig> =
  (models.UpsellConfig as Model<IUpsellConfig>) || model<IUpsellConfig>('UpsellConfig', upsellSchema);

/* ============================================================
   TREŚCI STRONY (edytowalne z panelu)
   ============================================================ */
export interface ISiteContent {
  key: 'main';
  heroTitle: string;
  heroSubtitle: string;
  heroImage: string;
  heroImageAlt: string;
  aboutTitle: string;
  aboutText: string;
  aboutImage: string;
  appTitle: string;
  appText: string;
  eventsText: string;
  giftCardsText: string;
  jobsText: string;
  announcement: string;
  instagramImages: string[];
  googleReviewsUrl: string;
  googleRating?: number | null;
  googleReviewsCount?: number | null;
  testimonials: { author: string; text: string; rating: number; source: string }[];
  updatedAt: Date;
}
const contentSchema = new Schema<ISiteContent>({
  key: { type: String, default: 'main', unique: true },
  heroTitle: { type: String, default: 'Sztuka idealnego milkshake\'a.' },
  heroSubtitle: {
    type: String,
    default: 'Gęste milkshake’i z prawdziwych lodów, burgery Black Angus i śniadania. W Słupsku przez cały rok, w Rowach w sezonie.'
  },
  heroImage: { type: String, default: 'https://i.imgur.com/70NTMx8.png' },
  heroImageAlt: { type: String, default: 'Milkshake truskawkowy z bitą śmietaną' },
  aboutTitle: { type: String, default: 'Robimy desery tak, jak sami lubimy je jeść' },
  aboutText: {
    type: String,
    default:
      'Milkshakebar powstał w Słupsku z prostego założenia: shake ma być gęsty, zimny i zrobiony z dobrych lodów. Z czasem doszły burgery z wołowiny Black Angus, śniadania i sezonowy lokal w Rowach, kilka kroków od plaży.'
  },
  aboutImage: { type: String, default: 'https://i.imgur.com/XeqbhHa.jpeg' },
  appTitle: { type: String, default: 'Aplikacja MilkMi' },
  appText: {
    type: String,
    default: 'Zbieraj punkty za każde zamówienie, odbieraj co 10. shake gratis i płać portfelem. Bez instalowania ze sklepu – działa w przeglądarce.'
  },
  eventsText: {
    type: String,
    default: 'Urodziny, wieczór panieński, spotkanie firmowe albo bar z shake’ami na Twojej imprezie. Napisz, a przygotujemy ofertę w 24 godziny.'
  },
  giftCardsText: {
    type: String,
    default: 'Karta podarunkowa trafia e-mailem w kilka minut. Obdarowany wpisuje kod w aplikacji, a kwota ląduje w jego portfelu.'
  },
  jobsText: {
    type: String,
    default: 'Szukamy osób na sezon w Rowach i na stałe w Słupsku: baristów, obsługi sali i kuchni. Elastyczny grafik, szkolenie na start.'
  },
  announcement: { type: String, default: '' },
  instagramImages: { type: [String], default: [] },
  googleReviewsUrl: { type: String, default: '' },
  googleRating: { type: Number, default: null },
  googleReviewsCount: { type: Number, default: null },
  testimonials: { type: [{ author: String, text: String, rating: Number, source: String }], default: [] },
  updatedAt: { type: Date, default: Date.now }
});
export const SiteContent: Model<ISiteContent> =
  (models.SiteContent as Model<ISiteContent>) || model<ISiteContent>('SiteContent', contentSchema);

/* ============================================================
   BLOG
   ============================================================ */
export interface IBlogPost {
  _id: Types.ObjectId;
  slug: string;
  title: string;
  excerpt: string;
  body: string; // prosty markdown: akapity, ## nagłówki, - listy
  coverImage: string;
  author: string;
  published: boolean;
  publishedAt: Date;
  seoTitle?: string;
  seoDescription?: string;
  updatedAt: Date;
}
const blogSchema = new Schema<IBlogPost>({
  slug: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  excerpt: { type: String, default: '' },
  body: { type: String, default: '' },
  coverImage: { type: String, default: '' },
  author: { type: String, default: 'Milkshakebar' },
  published: { type: Boolean, default: false },
  publishedAt: { type: Date, default: Date.now },
  seoTitle: String,
  seoDescription: String,
  updatedAt: { type: Date, default: Date.now }
});
export const BlogPost: Model<IBlogPost> = (models.BlogPost as Model<IBlogPost>) || model<IBlogPost>('BlogPost', blogSchema);

/* ============================================================
   FAQ
   ============================================================ */
export interface IFaq {
  _id: Types.ObjectId;
  question: string;
  answer: string;
  group: 'ogolne' | 'zamowienia' | 'aplikacja' | 'rezerwacje';
  sortOrder: number;
  visible: boolean;
}
const faqSchema = new Schema<IFaq>({
  question: String,
  answer: String,
  group: { type: String, default: 'ogolne' },
  sortOrder: { type: Number, default: 0 },
  visible: { type: Boolean, default: true }
});
export const Faq: Model<IFaq> = (models.Faq as Model<IFaq>) || model<IFaq>('Faq', faqSchema);

/* ============================================================
   META TAGI SEO PER ADRES (nadpisania z panelu)
   ============================================================ */
export interface ISeoMeta {
  path: string;
  title: string;
  description: string;
  ogImage?: string;
  noindex: boolean;
  updatedAt: Date;
}
const seoSchema = new Schema<ISeoMeta>({
  path: { type: String, required: true, unique: true },
  title: { type: String, default: '' },
  description: { type: String, default: '' },
  ogImage: String,
  noindex: { type: Boolean, default: false },
  updatedAt: { type: Date, default: Date.now }
});
export const SeoMeta: Model<ISeoMeta> = (models.SeoMeta as Model<ISeoMeta>) || model<ISeoMeta>('SeoMeta', seoSchema);

/* ============================================================
   PLIKI (zdjęcia w MongoDB, gdy brak Cloudinary)
   ============================================================ */
export interface IMedia {
  _id: Types.ObjectId;
  filename: string;
  contentType: string;
  size: number;
  data: Buffer;
  alt?: string;
  createdAt: Date;
}
const mediaSchema = new Schema<IMedia>({
  filename: String,
  contentType: String,
  size: Number,
  data: Buffer,
  alt: String,
  createdAt: { type: Date, default: Date.now }
});
export const Media: Model<IMedia> = (models.Media as Model<IMedia>) || model<IMedia>('Media', mediaSchema);

/* ============================================================
   POWIADOMIENIA: subskrypcje push, kampanie, kody logowania
   ============================================================ */
export interface IPushSubscription {
  userId?: Types.ObjectId | null;
  staffId?: Types.ObjectId | null;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  topics: string[]; // 'orders' | 'marketing'
  createdAt: Date;
}
const pushSchema = new Schema<IPushSubscription>({
  userId: { type: Schema.Types.ObjectId, default: null, index: true },
  staffId: { type: Schema.Types.ObjectId, default: null, index: true },
  endpoint: { type: String, unique: true },
  keys: { p256dh: String, auth: String },
  topics: { type: [String], default: ['orders', 'marketing'] },
  createdAt: { type: Date, default: Date.now }
});
export const PushSubscription: Model<IPushSubscription> =
  (models.PushSubscription as Model<IPushSubscription>) || model<IPushSubscription>('PushSubscription', pushSchema);

export interface ICampaign {
  _id: Types.ObjectId;
  title: string;
  body: string;
  url: string;
  channel: 'push' | 'email' | 'both';
  segment: string; // all | inactive30 | vip | birthday_month | tier_gold | tier_silver | location_rowy
  couponCode?: string;
  status: 'draft' | 'sent';
  recipients: number;
  sentAt?: Date | null;
  createdBy: string;
  createdAt: Date;
}
const campaignSchema = new Schema<ICampaign>({
  title: String,
  body: String,
  url: { type: String, default: '/app' },
  channel: { type: String, default: 'push' },
  segment: { type: String, default: 'all' },
  couponCode: String,
  status: { type: String, default: 'draft' },
  recipients: { type: Number, default: 0 },
  sentAt: { type: Date, default: null },
  createdBy: String,
  createdAt: { type: Date, default: Date.now }
});
export const Campaign: Model<ICampaign> = (models.Campaign as Model<ICampaign>) || model<ICampaign>('Campaign', campaignSchema);

export interface ILoginCode {
  email: string;
  codeHash: string;
  attempts: number;
  expiresAt: Date;
}
const loginCodeSchema = new Schema<ILoginCode>({
  email: { type: String, index: true },
  codeHash: String,
  attempts: { type: Number, default: 0 },
  expiresAt: { type: Date, index: { expires: 0 } }
});
export const LoginCode: Model<ILoginCode> = (models.LoginCode as Model<ILoginCode>) || model<ILoginCode>('LoginCode', loginCodeSchema);

/* Limit zapytań trzymany w bazie (działa przy wielu instancjach) */
export interface IRateLimit {
  key: string;
  count: number;
  expiresAt: Date;
}
const rateSchema = new Schema<IRateLimit>({
  key: { type: String, unique: true },
  count: { type: Number, default: 0 },
  expiresAt: { type: Date, index: { expires: 0 } }
});
export const RateLimit: Model<IRateLimit> = (models.RateLimit as Model<IRateLimit>) || model<IRateLimit>('RateLimit', rateSchema);

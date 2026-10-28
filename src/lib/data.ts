import 'server-only';
import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { db } from './db';
import { ensureBootstrap } from './bootstrap';
import {
  Location,
  Category,
  Product,
  SiteContent,
  Faq,
  BlogPost,
  Banner,
  SeoMeta,
  UpsellConfig,
  type ILocation,
  type ICategory,
  type IProduct,
  type ISiteContent,
  type IFaq,
  type IBlogPost
} from './models';
import { effectivePricing, inSeason, productVisibleAt } from './pricing';
import { plain } from './util';

async function ready() {
  await db();
  await ensureBootstrap();
}

// Tagi cache – panel wywołuje revalidateTag(...) po każdej zmianie
export const TAGS = { menu: 'menu', locations: 'locations', content: 'content', blog: 'blog', seo: 'seo' } as const;

// Dane współdzielone między żądaniami (5 min lub do zmiany w panelu) + deduplikacja w obrębie żądania
function cached<A extends unknown[], R>(key: string, tags: string[], fn: (...a: A) => Promise<R>) {
  return cache((...args: A) => unstable_cache(() => fn(...args), [key, ...args.map(String)], { tags, revalidate: 300 })());
}

/* ---------- Typy przekazywane do komponentów ---------- */
export interface PublicLocation {
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
  directions: string;
  photos: string[];
  seasonal: boolean;
  seasonNote: string;
  schedule: ILocation['schedule'];
  exceptions: ILocation['exceptions'];
  active: boolean;
  ordersEnabled: boolean;
  pausedUntil: string | null;
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
  reservationZones: { key: string; name: string; seats: number }[];
  reservationSlotMinutes: number;
}

export interface MenuProduct {
  id: string;
  slug: string;
  name: string;
  nameEn?: string;
  description: string;
  descriptionEn?: string;
  imageUrl: string;
  categoryId: string;
  price: number;
  fromPrice: number;
  variants: { name: string; price: number }[];
  addons: { id: string; name: string; price: number }[];
  allowSet: boolean;
  allergens: string[];
  tags: string[];
  kcal: number | null;
  isBestseller: boolean;
  available: boolean;
  location: string;
}

export interface PublicCategory {
  key: string;
  slug: string;
  name: string;
  nameEn?: string;
  parentKey: string | null;
  description: string;
  seoTitle?: string;
  seoDescription?: string;
  imageUrl?: string;
  allowSet: boolean;
  stampEligible: boolean;
}

/* ---------- Loadery ---------- */
export const getLocations = cached('locations', [TAGS.locations], async (): Promise<PublicLocation[]> => {
  await ready();
  const locs = await Location.find({ active: true }).sort({ seasonal: 1, slug: 1 }).lean<ILocation[]>();
  return plain<PublicLocation[]>(locs.map(({ _id, ...l }) => l));
});

export const getLocation = cache(async (slug: string): Promise<PublicLocation | null> => {
  const all = await getLocations();
  return all.find((l) => l.slug === slug) || null;
});

export const getCategories = cached('categories', [TAGS.menu], async (): Promise<PublicCategory[]> => {
  await ready();
  const cats = await Category.find({ visible: true }).sort({ sortOrder: 1 }).lean<ICategory[]>();
  return plain<PublicCategory[]>(
    cats.map((c) => ({
      key: c.key,
      slug: c.slug,
      name: c.name,
      nameEn: c.nameEn,
      parentKey: c.parentKey || null,
      description: c.description,
      seoTitle: c.seoTitle,
      seoDescription: c.seoDescription,
      imageUrl: c.imageUrl,
      allowSet: c.allowSet,
      stampEligible: c.stampEligible
    }))
  );
});

export function toMenuProduct(p: IProduct, location: string): MenuProduct {
  const pricing = effectivePricing(p, location);
  return {
    id: String(p._id),
    slug: p.slug || String(p._id),
    name: p.name,
    nameEn: p.nameEn,
    description: p.description || '',
    descriptionEn: p.descriptionEn,
    imageUrl: p.imageUrl || '',
    categoryId: p.categoryId,
    price: pricing.price,
    fromPrice: pricing.fromPrice,
    variants: pricing.variants,
    addons: (p.addons || []).map((a) => ({ id: String(a.id), name: a.name, price: Number(a.price) || 0 })),
    allowSet: !!p.allowSet,
    allergens: p.allergens || [],
    tags: p.tags || [],
    kcal: p.kcal ?? null,
    isBestseller: !!p.isBestseller,
    available: p.available !== false && !(p.unavailableAt || []).includes(location),
    location: p.location || 'slupsk'
  };
}

// Menu lokalu: produkty widoczne w tym lokalu i w sezonie (niedostępne zostają, ale z oznaczeniem „brak”)
export const getMenu = cached('menu', [TAGS.menu], async (location: string = 'slupsk'): Promise<MenuProduct[]> => {
  await ready();
  const products = await Product.find({}).sort({ sortOrder: 1, name: 1 }).lean<IProduct[]>();
  return products.filter((p) => productVisibleAt(p, location) && inSeason(p)).map((p) => toMenuProduct(p, location));
});

export const getProductBySlug = cached('product', [TAGS.menu], async (slug: string): Promise<{ product: MenuProduct; location: string } | null> => {
  await ready();
  const p = await Product.findOne({ slug }).lean<IProduct>();
  if (!p) return null;
  const location = p.location && p.location !== 'all' ? p.location : 'slupsk';
  return { product: toMenuProduct(p, location), location };
});

export const getBestsellers = cache(async (location = 'slupsk', limit = 6) => {
  const menu = await getMenu(location);
  const best = menu.filter((p) => p.isBestseller && p.available);
  return (best.length >= 3 ? best : [...best, ...menu.filter((p) => !p.isBestseller && p.available && p.imageUrl)]).slice(0, limit);
});

export const getContent = cached('content', [TAGS.content], async (): Promise<ISiteContent> => {
  await ready();
  const c = await SiteContent.findOne({ key: 'main' }).lean<ISiteContent>();
  return plain<ISiteContent>(c || {});
});

export const getFaqs = cached('faqs', [TAGS.content], async (): Promise<IFaq[]> => {
  await ready();
  return plain<IFaq[]>(await Faq.find({ visible: true }).sort({ sortOrder: 1 }).lean());
});

export const getPosts = cached('posts', [TAGS.blog], async (limit: number = 50): Promise<IBlogPost[]> => {
  await ready();
  return plain<IBlogPost[]>(await BlogPost.find({ published: true, publishedAt: { $lte: new Date() } }).sort({ publishedAt: -1 }).limit(limit).lean());
});

export const getPost = cached('post', [TAGS.blog], async (slug: string): Promise<IBlogPost | null> => {
  await ready();
  return plain<IBlogPost | null>(await BlogPost.findOne({ slug, published: true }).lean());
});

export const getBanner = cached('banner', [TAGS.content], async (target: 'web' | 'app') => {
  await ready();
  const b = await Banner.findOne({ target }).lean();
  if (!b || !b.isActive || !b.text) return null;
  const now = new Date();
  if (b.startsAt && now < new Date(b.startsAt)) return null;
  if (b.endsAt && now > new Date(b.endsAt)) return null;
  return { text: b.text, link: b.link || '', backgroundColor: b.backgroundColor || '#0F172A' };
});

export const getSeoOverride = cached('seo', [TAGS.seo], async (path: string) => {
  try {
    await ready();
    return plain<{ title?: string; description?: string; ogImage?: string; noindex?: boolean } | null>(await SeoMeta.findOne({ path }).lean());
  } catch {
    return null;
  }
});

export const getUpsell = cached('upsell', [TAGS.menu], async (location: string) => {
  await ready();
  const u = await UpsellConfig.findOne({ location }).lean();
  return plain<{ items: { id: string; name: string; price: number; img: string }[]; rules: { whenCategoryPrefix: string; suggestProductIds: string[] }[] }>(
    { items: u?.items || [], rules: u?.rules || [] }
  );
});

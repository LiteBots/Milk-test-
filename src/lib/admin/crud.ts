import 'server-only';
import { z, type ZodTypeAny } from 'zod';
import bcrypt from 'bcryptjs';
import type { Model } from 'mongoose';
import { Category, Reward, Coupon, Faq, BlogPost, SeoMeta, Employee, InventoryItem, GiftCard, Inquiry, Staff } from '../models';
import type { Permission } from '../auth';
import { TAGS } from '../data';
import { slugify, randomCode } from '../util';

// Jedna definicja na kolekcję: uprawnienie, walidacja, wyszukiwanie, sortowanie, cache do odświeżenia
export interface CrudDef {
  model: Model<any>;
  perm: Permission;
  schema: ZodTypeAny;
  search: string[];
  sort: Record<string, 1 | -1>;
  tags?: string[];
  hidden?: string[]; // pola nigdy nie zwracane
  beforeSave?: (data: Record<string, unknown>, isNew: boolean) => Promise<Record<string, unknown>> | Record<string, unknown>;
  canDelete?: boolean;
}

const opt = <T extends ZodTypeAny>(s: T) => s.optional();
const str = (max = 200) => z.string().trim().max(max);
const dateish = z.union([z.string(), z.date(), z.null()]).optional().transform((v) => (v ? new Date(v) : null));

export const CRUD: Record<string, CrudDef> = {
  categories: {
    model: Category,
    perm: 'menu',
    search: ['name', 'key'],
    sort: { sortOrder: 1 },
    tags: [TAGS.menu],
    schema: z.object({
      key: opt(str(60)),
      slug: opt(str(80)),
      name: str(80).min(1, 'Podaj nazwę.'),
      nameEn: opt(str(80)),
      parentKey: z.string().max(60).nullable().optional(),
      description: opt(str(600)),
      seoTitle: opt(str(120)),
      seoDescription: opt(str(300)),
      imageUrl: opt(str(500)),
      sortOrder: opt(z.number()),
      visible: opt(z.boolean()),
      allowSet: opt(z.boolean()),
      stampEligible: opt(z.boolean())
    }),
    beforeSave: (d, isNew) => {
      if (isNew && !d.key) d.key = slugify(String(d.name)).replace(/-/g, '_');
      if (!d.slug && d.name) d.slug = slugify(String(d.key || d.name).replace(/_/g, '-'));
      if (d.parentKey === '') d.parentKey = null;
      return d;
    }
  },
  rewards: {
    model: Reward,
    perm: 'loyalty',
    search: ['name'],
    sort: { sortOrder: 1, cost: 1 },
    schema: z.object({
      name: str(80).min(1),
      description: opt(str(300)),
      cost: z.number().int().min(1),
      imageUrl: opt(str(500)),
      productId: z.string().max(40).nullable().optional(),
      maxValue: z.number().min(0).nullable().optional(),
      active: opt(z.boolean()),
      sortOrder: opt(z.number())
    })
  },
  coupons: {
    model: Coupon,
    perm: 'marketing',
    search: ['code', 'name'],
    sort: { createdAt: -1 },
    schema: z.object({
      code: str(40).min(3, 'Kod musi mieć min. 3 znaki.').transform((v) => v.toUpperCase().replace(/\s/g, '')),
      name: opt(str(80)),
      type: z.enum(['percent', 'amount', 'free_product']),
      value: z.number().min(0),
      productId: z.string().max(40).nullable().optional(),
      minOrder: opt(z.number().min(0)),
      maxDiscount: z.number().min(0).nullable().optional(),
      maxUses: z.number().int().min(1).nullable().optional(),
      usesPerUser: opt(z.number().int().min(0)),
      validFrom: dateish,
      validTo: dateish,
      active: opt(z.boolean()),
      appOnly: opt(z.boolean()),
      locations: opt(z.array(z.string().max(30)))
    })
  },
  faq: {
    model: Faq,
    perm: 'content',
    search: ['question', 'answer'],
    sort: { sortOrder: 1 },
    tags: [TAGS.content],
    schema: z.object({
      question: str(200).min(3),
      answer: str(2000).min(3),
      group: z.enum(['ogolne', 'zamowienia', 'aplikacja', 'rezerwacje']),
      sortOrder: opt(z.number()),
      visible: opt(z.boolean())
    })
  },
  posts: {
    model: BlogPost,
    perm: 'content',
    search: ['title', 'slug'],
    sort: { publishedAt: -1 },
    tags: [TAGS.blog],
    schema: z.object({
      title: str(160).min(3),
      slug: opt(str(120)),
      excerpt: opt(str(400)),
      body: opt(z.string().max(50000)),
      coverImage: opt(str(500)),
      author: opt(str(80)),
      published: opt(z.boolean()),
      publishedAt: dateish,
      seoTitle: opt(str(120)),
      seoDescription: opt(str(300))
    }),
    beforeSave: (d) => {
      if (!d.slug && d.title) d.slug = slugify(String(d.title));
      if (d.slug) d.slug = slugify(String(d.slug));
      if (!d.publishedAt) delete d.publishedAt;
      d.updatedAt = new Date();
      return d;
    }
  },
  seo: {
    model: SeoMeta,
    perm: 'content',
    search: ['path', 'title'],
    sort: { path: 1 },
    tags: [TAGS.seo],
    schema: z.object({
      path: str(200).regex(/^\//, 'Adres musi zaczynać się od /'),
      title: opt(str(120)),
      description: opt(str(320)),
      ogImage: opt(str(500)),
      noindex: opt(z.boolean())
    })
  },
  employees: {
    model: Employee,
    perm: 'team',
    search: ['name', 'position'],
    sort: { active: -1, name: 1 },
    hidden: ['pin'],
    schema: z.object({
      name: str(80).min(2),
      phone: opt(str(30)),
      position: opt(str(60)),
      pin: z.string().regex(/^\d{4,6}$/, 'PIN: 4–6 cyfr.').optional().or(z.literal('')),
      hourlyRate: opt(z.number().min(0)),
      locations: opt(z.array(z.string().max(30))),
      active: opt(z.boolean())
    }),
    beforeSave: async (d) => {
      if (d.pin) d.pin = await bcrypt.hash(String(d.pin), 10);
      else delete d.pin;
      return d;
    }
  },
  inventory: {
    model: InventoryItem,
    perm: 'inventory',
    search: ['name'],
    sort: { location: 1, name: 1 },
    schema: z.object({
      name: str(80).min(1),
      unit: opt(str(10)),
      quantity: opt(z.number()),
      minQuantity: opt(z.number().min(0)),
      location: opt(str(30)),
      linkedProductIds: opt(z.array(z.string().max(40)))
    }),
    beforeSave: (d) => ({ ...d, updatedAt: new Date() })
  },
  giftcards: {
    model: GiftCard,
    perm: 'marketing',
    search: ['code', 'buyerEmail', 'recipientEmail', 'recipientName'],
    sort: { createdAt: -1 },
    canDelete: false,
    schema: z.object({
      code: opt(str(30)),
      amount: z.number().min(1).max(5000),
      balance: opt(z.number().min(0)),
      buyerName: opt(str(80)),
      buyerEmail: opt(str(120)),
      recipientName: opt(str(80)),
      recipientEmail: opt(str(120)),
      message: opt(str(300)),
      status: opt(z.enum(['awaiting_payment', 'active', 'redeemed', 'cancelled'])),
      validTo: dateish
    }),
    beforeSave: (d, isNew) => {
      if (isNew) {
        d.code = d.code || `MILK-${randomCode(4)}-${randomCode(4)}`;
        d.balance = d.balance ?? d.amount;
        d.status = d.status || 'active';
        if (!d.validTo) {
          const v = new Date();
          v.setFullYear(v.getFullYear() + 1);
          d.validTo = v;
        }
      }
      return d;
    }
  },
  inquiries: {
    model: Inquiry,
    perm: 'customers',
    search: ['name', 'email', 'message'],
    sort: { createdAt: -1 },
    schema: z.object({ status: z.enum(['new', 'in_progress', 'done']) })
  },
  staff: {
    model: Staff,
    perm: 'staff',
    search: ['name', 'email'],
    sort: { role: 1, name: 1 },
    hidden: ['password', 'totpSecret'],
    canDelete: true,
    schema: z.object({
      name: str(80).min(2),
      email: z.string().trim().toLowerCase().email('Podaj prawidłowy e-mail.'),
      password: z.string().min(10, 'Hasło: min. 10 znaków.').max(200).optional().or(z.literal('')),
      role: z.enum(['owner', 'manager', 'cashier', 'kitchen']),
      locations: opt(z.array(z.string().max(30))),
      active: opt(z.boolean())
    }),
    beforeSave: async (d, isNew) => {
      if (d.password) d.password = await bcrypt.hash(String(d.password), 12);
      else if (isNew) throw Object.assign(new Error('Podaj hasło dla nowego konta (min. 10 znaków).'), { status: 400 });
      else delete d.password;
      return d;
    }
  }
};

import 'server-only';
import { z } from 'zod';

const variant = z.object({ name: z.string().trim().min(1).max(60), price: z.number().min(0).max(10000) });
export const productSchema = z.object({
  name: z.string().trim().min(1, 'Podaj nazwę.').max(120),
  nameEn: z.string().trim().max(120).optional(),
  slug: z.string().trim().max(120).optional(),
  description: z.string().max(1000).optional().default(''),
  descriptionEn: z.string().max(1000).optional(),
  price: z.number().min(0).max(10000).nullable().optional(),
  imageUrl: z.string().max(500).optional().default(''),
  categoryId: z.string().min(1, 'Wybierz kategorię.').max(60),
  location: z.string().max(30).optional().default('slupsk'),
  hasVariants: z.boolean().optional().default(false),
  variants: z.array(variant).max(20).optional().default([]),
  allowSet: z.boolean().optional().default(false),
  addons: z.array(z.object({ id: z.string().max(40), name: z.string().trim().min(1).max(60), price: z.number().min(0).max(1000) })).max(30).optional().default([]),
  isBestseller: z.boolean().optional().default(false),
  allergens: z.array(z.string().max(40)).max(20).optional().default([]),
  tags: z.array(z.string().max(30)).max(10).optional().default([]),
  kcal: z.number().int().min(0).max(5000).nullable().optional(),
  available: z.boolean().optional().default(true),
  unavailableAt: z.array(z.string().max(30)).optional().default([]),
  sortOrder: z.number().optional(),
  seasonFrom: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/).nullable().optional(),
  seasonTo: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/).nullable().optional(),
  priceOverrides: z.array(z.object({ location: z.string().max(30), price: z.number().min(0).nullable().optional(), variants: z.array(variant).optional() })).max(5).optional().default([]),
  stampEligible: z.boolean().nullable().optional(),
  seoTitle: z.string().max(120).optional(),
  seoDescription: z.string().max(300).optional()
});

export function normalizeProduct(d: z.infer<typeof productSchema>) {
  const hasVariants = d.variants.length > 0;
  if (!hasVariants && (d.price === null || d.price === undefined)) throw Object.assign(new Error('Podaj cenę albo dodaj warianty.'), { status: 400 });
  return {
    ...d,
    hasVariants,
    price: hasVariants ? Math.min(...d.variants.map((v) => v.price)) : d.price,
    seasonFrom: d.seasonFrom || null,
    seasonTo: d.seasonTo || null,
    addons: d.addons.map((a, i) => ({ ...a, id: a.id || `a${Date.now().toString(36)}${i}` })),
    updatedAt: new Date()
  };
}

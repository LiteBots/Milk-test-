import { z } from 'zod';

const line = z.object({
  type: z.enum(['product', 'upsell']).optional(),
  productId: z.string().max(40),
  variant: z.string().max(80).nullable().optional(),
  addonIds: z.array(z.string().max(40)).max(20).optional(),
  set: z.object({ side: z.string().max(60), drink: z.string().max(60) }).nullable().optional(),
  quantity: z.number().int().min(1).max(30)
});
export const quoteSchema = z.object({
  location: z.string().max(30),
  items: z.array(line).min(1).max(60),
  couponCode: z.string().max(40).nullable().optional(),
  reward: z.string().max(40).nullable().optional(),
  deliveryMethod: z.enum(['pickup', 'delivery']).optional(),
  paymentMethod: z.string().max(20).optional(),
  source: z.enum(['web', 'app', 'kiosk']).optional()
});


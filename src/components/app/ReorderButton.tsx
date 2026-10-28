'use client';

import { useRouter } from 'next/navigation';
import { saveCart, lineKey } from '../shop/cartStore';
import type { CartLine } from '../shop/types';
import { Icon } from '../Icon';

interface Item {
  type: string;
  productId: string;
  name: string;
  variant?: string | null;
  addonIds?: string[];
  set?: { side: string; drink: string } | null;
  desc?: string;
  price: number;
  quantity: number;
}

// „Zamów ponownie” – odtwarza koszyk; ceny i dostępność i tak sprawdzi serwer
export function ReorderButton({ items, location, small = false }: { items: Item[]; location: string; small?: boolean }) {
  const router = useRouter();
  return (
    <button
      className={`btn ${small ? 'btn-soft btn-sm' : 'btn-accent'}`}
      onClick={() => {
        const lines: CartLine[] = items
          .filter((i) => i.type === 'product' || i.type === 'upsell')
          .map((i) => {
            const base = { type: i.type as 'product' | 'upsell', productId: i.productId, name: i.name, variant: i.variant || null, addonIds: i.addonIds || [], set: i.set || null, desc: i.desc || '', unitPrice: i.price };
            return { ...base, key: lineKey(base), quantity: i.quantity };
          });
        saveCart(location, lines);
        router.push(`/app/zamow?lokal=${location}`);
      }}
    >
      <Icon name="refresh" size={16} /> Zamów ponownie
    </button>
  );
}

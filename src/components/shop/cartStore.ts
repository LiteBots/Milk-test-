import type { CartLine } from './types';

const TTL = 12 * 60 * 60 * 1000;
export const cartKey = (loc: string) => `mm_cart_${loc}`;

export function lineKey(l: Omit<CartLine, 'key' | 'quantity'> & { quantity?: number }) {
  return [l.type, l.productId, l.variant || '', l.set ? `${l.set.side}/${l.set.drink}` : 'solo', [...(l.addonIds || [])].sort().join(',')].join('|');
}

export function loadCart(loc: string): CartLine[] {
  try {
    const raw = localStorage.getItem(cartKey(loc));
    if (!raw) return [];
    const d = JSON.parse(raw) as { at: number; items: CartLine[] };
    if (!d.at || Date.now() - d.at > TTL) return [];
    return Array.isArray(d.items) ? d.items : [];
  } catch {
    return [];
  }
}

export function saveCart(loc: string, items: CartLine[]) {
  try {
    if (!items.length) localStorage.removeItem(cartKey(loc));
    else localStorage.setItem(cartKey(loc), JSON.stringify({ at: Date.now(), items }));
  } catch {
    /* tryb prywatny – koszyk tylko w pamięci */
  }
}

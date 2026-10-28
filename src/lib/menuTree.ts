import type { PublicCategory } from './data';

// Mapa: categoryId produktu → slug kategorii głównej (do adresów /menu/[kategoria]/[produkt])
export function topSlugMap(categories: PublicCategory[]): Record<string, string> {
  const byKey = new Map(categories.map((c) => [c.key, c]));
  const out: Record<string, string> = {};
  for (const c of categories) {
    const top = c.parentKey ? byKey.get(c.parentKey) : c;
    out[c.key] = (top || c).slug;
  }
  return out;
}

export function topOf(categories: PublicCategory[], categoryId: string): PublicCategory | undefined {
  const c = categories.find((x) => x.key === categoryId);
  if (!c) return undefined;
  return c.parentKey ? categories.find((x) => x.key === c.parentKey) || c : c;
}

export function keysUnder(categories: PublicCategory[], topKey: string): string[] {
  return [topKey, ...categories.filter((c) => c.parentKey === topKey).map((c) => c.key)];
}

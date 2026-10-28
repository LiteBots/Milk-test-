// Stałe dane marki – używane w SEO, stopce, danych strukturalnych i e-mailach
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://milkshakebar.pl').replace(/\/$/, '');

export const BRAND = {
  name: 'Milkshakebar',
  appName: 'MilkMi',
  legalName: 'MARCIN CHOJNACKI MILKSHAKE BAR',
  owner: 'Marcin Chojnacki',
  nip: '8271982077',
  regon: '100473965',
  legalAddress: 'ul. Szczecińska 17, 76-200 Słupsk',
  email: 'kontakt@milkshakebar.pl',
  instagram: 'https://www.instagram.com/milkshake_slupsk',
  facebook: 'https://www.facebook.com/milkshakebar',
  tagline: 'Milkshake’i, burgery i desery w Słupsku i Rowach',
  description:
    'Milkshakebar w Słupsku i Rowach – kremowe milkshake’i, burgery Black Angus, śniadania, desery i kawa. Zamów online z odbiorem lub zarezerwuj stolik.'
};

export const LOCATION_SLUGS = ['slupsk', 'rowy'] as const;
export type LocationSlug = (typeof LOCATION_SLUGS)[number];

export function isLocation(v: unknown): v is LocationSlug {
  return typeof v === 'string' && (LOCATION_SLUGS as readonly string[]).includes(v);
}

export const absUrl = (path = '/') => `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;

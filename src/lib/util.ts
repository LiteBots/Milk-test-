// Drobne narzędzia współdzielone przez serwer i klienta
export const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export const formatPLN = (n: number) =>
  new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN', minimumFractionDigits: 2 }).format(Number(n) || 0);

export const slugify = (s: string) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

export const normalizePhone = (p: string) => String(p || '').replace(/[\s\-()]/g, '');
export const isValidPhone = (p: string) => /^(\+?48)?\d{9}$/.test(normalizePhone(p));
export const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e || '').trim());

// Zamienia dokumenty Mongoose (ObjectId, Date) na zwykłe obiekty dla komponentów klienta
export function plain<T>(v: unknown): T {
  return JSON.parse(JSON.stringify(v ?? null)) as T;
}

export function randomCode(len = 8, alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789') {
  const bytes = new Uint8Array(len);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

export function escapeHtml(s: string | null | undefined) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export const STATUS_LABELS: Record<string, string> = {
  awaiting_payment: 'Oczekuje na płatność',
  pending: 'Nowe',
  accepted: 'Przyjęte',
  preparing: 'W przygotowaniu',
  ready: 'Gotowe do odbioru',
  completed: 'Wydane',
  cancelled: 'Anulowane',
  rejected: 'Odrzucone',
  payment_failed: 'Płatność nieudana'
};

export const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Gotówka przy odbiorze',
  card: 'Karta przy odbiorze',
  online: 'Online (PayU / BLIK)',
  prepaid: 'Portfel MilkMi'
};

export const LOCATION_NAMES: Record<string, string> = { slupsk: 'Słupsk', rowy: 'Rowy', all: 'Wszystkie lokale' };

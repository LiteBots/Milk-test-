// Zdarzenia konwersji (koszyk, zamówienie, rezerwacja, instalacja PWA) – Plausible i GA4
type W = Window & { plausible?: (e: string, o?: { props?: Record<string, unknown>; revenue?: { currency: string; amount: number } }) => void; gtag?: (...a: unknown[]) => void };

export function track(event: string, props: Record<string, string | number> = {}, revenue?: number) {
  if (typeof window === 'undefined') return;
  const w = window as W;
  try {
    w.plausible?.(event, { props, ...(revenue ? { revenue: { currency: 'PLN', amount: revenue } } : {}) });
    w.gtag?.('event', event, { ...props, ...(revenue ? { value: revenue, currency: 'PLN' } : {}) });
  } catch {
    /* analityka nie może psuć zamówień */
  }
}

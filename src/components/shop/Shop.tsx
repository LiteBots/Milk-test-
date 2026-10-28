'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/client';
import { track } from '@/lib/track';
import { formatPLN, isValidPhone, isValidEmail, PAYMENT_LABELS } from '@/lib/util';
import { Icon } from '../Icon';
import { Modal } from '../Modal';
import { useToast } from '../Toast';
import { ProductModal } from './ProductModal';
import { CartView } from './CartView';
import type { CartLine, StoreData, Quote } from './types';
import { cartKey, loadCart, saveCart, lineKey } from './cartStore';

interface Props {
  mode: 'web' | 'app';
  locations: { slug: string; city: string; ordersEnabled: boolean }[];
  initialLocation: string;
}

export function Shop({ mode, locations, initialLocation }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const [loc, setLoc] = useState(initialLocation);
  const [data, setData] = useState<StoreData | null>(null);
  const [loadError, setLoadError] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cat, setCat] = useState<string>('all');
  const [q, setQ] = useState('');
  const [modalProduct, setModalProduct] = useState<string | null>(null);
  const [step, setStep] = useState<'menu' | 'checkout'>('menu');
  const [cartOpen, setCartOpen] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState('');
  const [coupon, setCoupon] = useState('');
  const [couponInput, setCouponInput] = useState('');
  const [reward, setReward] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', email: '', notes: '', delivery: 'pickup' as 'pickup' | 'delivery', address: '', payment: 'card' as 'cash' | 'card' | 'online' | 'prepaid', time: '' });
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const loadedCartFor = useRef<string | null>(null);
  const paymentChosen = useRef(false);

  /* ---------- Dane sklepu ---------- */
  const load = useCallback(async (slug: string) => {
    setLoadError('');
    try {
      const d = await api<StoreData>(`/api/store/${slug}`);
      setData(d);
      setForm((f) => ({
        ...f,
        name: f.name || d.user?.name || '',
        phone: f.phone || d.user?.phone || '',
        email: f.email || d.user?.email || '',
        payment: paymentChosen.current ? f.payment : d.payments.online ? 'online' : 'card',
        time: d.ordering.slots.includes(f.time) ? f.time : d.ordering.slots[0] || ''
      }));
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    load(loc);
    // Odświeżanie wolnych godzin co minutę
    const id = setInterval(() => load(loc), 60_000);
    return () => clearInterval(id);
  }, [loc, load]);

  useEffect(() => {
    if (loadedCartFor.current === loc) return;
    loadedCartFor.current = loc;
    setCart(loadCart(loc));
    try {
      const saved = localStorage.getItem('mm_checkout');
      if (saved) setForm((f) => ({ ...f, ...JSON.parse(saved), time: '' }));
    } catch {
      /* brak dostępu do pamięci */
    }
  }, [loc]);

  useEffect(() => {
    if (loadedCartFor.current === loc) saveCart(loc, cart);
  }, [cart, loc]);

  // ?produkt=<id> – otwarcie produktu z linku (strona produktu, kampania)
  useEffect(() => {
    const pid = params.get('produkt');
    if (pid && data?.menu.some((p) => p.id === pid)) setModalProduct(pid);
  }, [params, data]);

  /* ---------- Wycena na serwerze ---------- */
  const quoteBody = useMemo(
    () => ({
      location: loc,
      items: cart.map((l) => ({ type: l.type, productId: l.productId, variant: l.variant, addonIds: l.addonIds, set: l.set, quantity: l.quantity })),
      couponCode: coupon || null,
      reward,
      deliveryMethod: form.delivery,
      paymentMethod: form.payment,
      source: mode
    }),
    [loc, cart, coupon, reward, form.delivery, form.payment, mode]
  );

  useEffect(() => {
    if (!cart.length) {
      setQuote(null);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      api<{ quote: Quote }>('/api/cart/quote', { body: quoteBody, signal: ctrl.signal })
        .then((r) => {
          setQuote(r.quote);
          setQuoteError('');
          if (r.quote.warnings.length) toast(r.quote.warnings[0], 'info');
        })
        .catch((e) => {
          if (e.name === 'AbortError') return;
          setQuote(null);
          setQuoteError(e.message);
        });
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [quoteBody, cart.length, toast]);

  /* ---------- Koszyk ---------- */
  const addLine = useCallback(
    (line: Omit<CartLine, 'key' | 'quantity'>, qty: number) => {
      const key = lineKey(line);
      setCart((c) => {
        const ex = c.find((x) => x.key === key);
        if (ex) return c.map((x) => (x.key === key ? { ...x, quantity: Math.min(30, x.quantity + qty) } : x));
        return [...c, { ...line, key, quantity: qty }];
      });
      track('Dodanie do koszyka', { produkt: line.name });
      toast(`Dodano: ${line.name}`, 'success');
    },
    [toast]
  );
  const setQty = (key: string, qty: number) => setCart((c) => (qty <= 0 ? c.filter((x) => x.key !== key) : c.map((x) => (x.key === key ? { ...x, quantity: Math.min(30, qty) } : x))));
  const count = cart.reduce((s, l) => s + l.quantity, 0);
  const localTotal = cart.reduce((s, l) => s + l.unitPrice * l.quantity, 0);

  /* ---------- Filtr menu ---------- */
  const tops = useMemo(() => (data ? data.categories.filter((c) => !c.parentKey) : []), [data]);
  const topOf = useMemo(() => {
    const m: Record<string, string> = {};
    data?.categories.forEach((c) => (m[c.key] = c.parentKey || c.key));
    return m;
  }, [data]);
  const visible = useMemo(() => {
    if (!data) return [];
    const query = q.trim().toLowerCase();
    return data.menu.filter((p) => {
      if (query) return `${p.name} ${p.description}`.toLowerCase().includes(query);
      if (cat === 'fav') return data.user?.favorites.includes(p.id);
      return cat === 'all' || (topOf[p.categoryId] || p.categoryId) === cat;
    });
  }, [data, q, cat, topOf]);

  const grouped = useMemo(() => {
    if (!data) return [];
    if (q.trim() || cat === 'fav') return [{ key: 'results', name: q.trim() ? 'Wyniki wyszukiwania' : 'Ulubione', items: visible }];
    const list = cat === 'all' ? tops : tops.filter((t) => t.key === cat);
    const out = list
      .map((t) => {
        const keys = new Set([t.key, ...data.categories.filter((c) => c.parentKey === t.key).map((c) => c.key)]);
        return { key: t.key, name: t.name, items: visible.filter((p) => keys.has(p.categoryId)) };
      })
      .filter((g) => g.items.length);
    const known = new Set(data.categories.map((c) => c.key));
    const rest = visible.filter((p) => !known.has(p.categoryId));
    if (rest.length && cat === 'all') out.push({ key: 'inne', name: 'Pozostałe', items: rest });
    return out;
  }, [data, visible, tops, cat, q]);

  /* ---------- Zamówienie ---------- */
  const isDelivery = form.delivery === 'delivery';
  const errors = {
    name: form.name.trim().length < 2,
    phone: !isValidPhone(form.phone),
    email: mode === 'app' ? false : !!form.email && !isValidEmail(form.email),
    address: isDelivery && form.address.trim().length < 5,
    time: !form.time
  };
  const [showErrors, setShowErrors] = useState(false);

  async function submit() {
    setShowErrors(true);
    setSubmitError('');
    if (Object.values(errors).some(Boolean)) {
      toast('Uzupełnij zaznaczone pola.', 'error');
      return;
    }
    if (!consent) return setSubmitError('Zaakceptuj regulamin, aby złożyć zamówienie.');
    if (!quote) return setSubmitError(quoteError || 'Odświeżamy sumę koszyka – spróbuj za chwilę.');
    setSubmitting(true);
    let clientOrderId = '';
    try {
      clientOrderId = sessionStorage.getItem('mm_pending_order') || crypto.randomUUID();
      sessionStorage.setItem('mm_pending_order', clientOrderId);
    } catch {
      clientOrderId = `${Date.now()}-${Math.random()}`;
    }
    try {
      localStorage.setItem('mm_checkout', JSON.stringify({ name: form.name, phone: form.phone, email: form.email, delivery: form.delivery, address: form.address }));
    } catch {
      /* ignoruj */
    }
    try {
      const r = await api<{ orderId: string; orderNumber: string; redirectUrl: string | null; statusUrl: string; totalAmount: number }>('/api/orders', {
        body: {
          ...quoteBody,
          deliveryAddress: form.address,
          pickupTime: form.time,
          customerName: form.name,
          customerPhone: form.phone,
          customerEmail: form.email,
          notes: form.notes,
          clientOrderId
        }
      });
      track('Zamówienie', { lokal: loc, platnosc: form.payment, zrodlo: mode }, r.totalAmount);
      sessionStorage.removeItem('mm_pending_order');
      setCart([]);
      saveCart(loc, []);
      if (r.redirectUrl) window.location.href = r.redirectUrl;
      else router.push(r.statusUrl);
    } catch (e) {
      setSubmitError((e as Error).message);
      setSubmitting(false);
      if ((e as Error & { status?: number }).status === 409) load(loc);
    }
  }

  /* ---------- Widoki ---------- */
  if (loadError) {
    return (
      <div className="container empty">
        <p>{loadError}</p>
        <button className="btn btn-ghost" onClick={() => load(loc)}>
          Spróbuj ponownie
        </button>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="container section-sm stack">
        <div className="skeleton" style={{ height: 44, width: 320 }} />
        <div className="grid grid-auto" style={{ '--min': '280px' } as React.CSSProperties}>
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="skeleton" style={{ height: 96 }} />
          ))}
        </div>
      </div>
    );
  }

  const ordering = data.ordering;
  const cartView = (
    <CartView
      cart={cart}
      quote={quote}
      quoteError={quoteError}
      setQty={setQty}
      upsell={data.upsell}
      menu={data.menu}
      onAddUpsell={(u) => addLine({ type: 'upsell', productId: u.id, name: u.name, unitPrice: u.price, img: u.img, desc: '' }, 1)}
      onOpenProduct={setModalProduct}
    />
  );

  if (step === 'checkout') {
    return (
      <div className="container section-sm" style={{ paddingBottom: 120 }}>
        <button className="btn btn-ghost btn-sm mb-2" onClick={() => setStep('menu')}>
          <Icon name="arrow-left" size={16} /> Wróć do menu
        </button>
        <h1 className="h2 mb-3">Podsumowanie zamówienia</h1>
        <div className="shop-layout">
          <div className="stack" style={{ '--gap': '20px' } as React.CSSProperties}>
            {!ordering.open ? <p className="alert alert-warn">{ordering.reason}</p> : null}

            <section className="card stack">
              <h2 className="h3">1. Odbiór</h2>
              {data.location.deliveryEnabled ? (
                <div className="segmented" role="group">
                  <button type="button" aria-pressed={form.delivery === 'pickup'} onClick={() => setForm({ ...form, delivery: 'pickup' })}>
                    Odbiór osobisty
                  </button>
                  <button type="button" aria-pressed={form.delivery === 'delivery'} onClick={() => setForm({ ...form, delivery: 'delivery' })}>
                    Dostawa
                  </button>
                </div>
              ) : (
                <p className="small muted" style={{ margin: 0 }}>
                  <Icon name="pin" size={16} style={{ display: 'inline', verticalAlign: '-3px' }} /> Odbiór osobisty: {data.location.street}, {data.location.city}
                </p>
              )}
              {isDelivery ? (
                <label className="field">
                  <span className="label">Adres dostawy</span>
                  <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} aria-invalid={showErrors && errors.address} autoComplete="street-address" />
                  <span className="hint">
                    Minimalne zamówienie {formatPLN(data.location.deliveryMinOrder)} · darmowa dostawa od {formatPLN(data.location.freeDeliveryThreshold)}
                  </span>
                </label>
              ) : null}
              <div className="field">
                <span className="label">Godzina {isDelivery ? 'dostawy' : 'odbioru'} (dziś)</span>
                {ordering.slots.length ? (
                  <div className="slot-grid">
                    {ordering.slots.map((s) => (
                      <button type="button" key={s} className="slot" aria-pressed={form.time === s} onClick={() => setForm({ ...form, time: s })}>
                        {s}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="alert alert-warn small">Na dziś nie przyjmujemy już zamówień. {ordering.status.label}.</p>
                )}
                {showErrors && errors.time ? <span className="error-text">Wybierz godzinę.</span> : null}
              </div>
            </section>

            <section className="card stack">
              <h2 className="h3">2. Twoje dane</h2>
              <div className="grid grid-2" style={{ '--gap': '12px' } as React.CSSProperties}>
                <label className="field">
                  <span className="label">Imię</span>
                  <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} aria-invalid={showErrors && errors.name} autoComplete="given-name" />
                </label>
                <label className="field">
                  <span className="label">Telefon</span>
                  <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} aria-invalid={showErrors && errors.phone} type="tel" inputMode="tel" autoComplete="tel" placeholder="500 600 700" />
                  {showErrors && errors.phone ? <span className="error-text">Podaj 9-cyfrowy numer.</span> : null}
                </label>
              </div>
              {mode === 'web' ? (
                <label className="field">
                  <span className="label">E-mail (potwierdzenie i link do śledzenia)</span>
                  <input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} aria-invalid={showErrors && errors.email} type="email" autoComplete="email" />
                </label>
              ) : null}
              <label className="field">
                <span className="label">Uwagi do zamówienia</span>
                <textarea className="textarea" style={{ minHeight: 70 }} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={500} placeholder="np. bez cebuli, sztućce" />
              </label>
              {mode === 'web' && !data.user ? (
                <p className="small muted" style={{ margin: 0 }}>
                  Masz konto MilkMi?{' '}
                  <a href="/app/logowanie?next=/app/zamow" className="link">
                    Zaloguj się
                  </a>{' '}
                  i zbieraj punkty za to zamówienie.
                </p>
              ) : null}
            </section>

            <section className="card stack">
              <h2 className="h3">3. Płatność</h2>
              <div className="stack" style={{ '--gap': '8px' } as React.CSSProperties}>
                {(['online', 'prepaid', 'card', 'cash'] as const)
                  .filter((m) => data.payments[m])
                  .map((m) => (
                    <label key={m} className="option-card">
                      <input type="radio" name="payment" checked={form.payment === m} onChange={() => {
                        paymentChosen.current = true;
                        setForm({ ...form, payment: m });
                      }} />
                      <span style={{ flex: 1 }}>
                        <strong>{PAYMENT_LABELS[m]}</strong>
                        {m === 'prepaid' && data.user ? <span className="small muted"> · saldo {formatPLN(data.user.walletBalance)}</span> : null}
                        {m === 'online' ? <span className="small muted"> · BLIK, przelew, karta</span> : null}
                      </span>
                    </label>
                  ))}
              </div>
            </section>

            {data.user && (data.user.stampRewardsAvailable > 0 || data.user.rewards.length || data.user.coupons.length) ? (
              <section className="card stack">
                <h2 className="h3">Twoje nagrody i kupony</h2>
                <div className="chips" style={{ flexWrap: 'wrap' }}>
                  {data.user.stampRewardsAvailable > 0 ? (
                    <button type="button" className="chip" aria-pressed={reward === 'stamp'} onClick={() => setReward(reward === 'stamp' ? null : 'stamp')}>
                      🎁 Darmowy shake ({data.user.stampRewardsAvailable})
                    </button>
                  ) : null}
                  {data.user.rewards.map((r) => (
                    <button type="button" key={r.code} className="chip" aria-pressed={reward === r.code} onClick={() => setReward(reward === r.code ? null : r.code)}>
                      {r.name}
                    </button>
                  ))}
                  {data.user.coupons.map((c) => (
                    <button
                      type="button"
                      key={c.code}
                      className="chip"
                      aria-pressed={coupon === c.code}
                      onClick={() => {
                        setCoupon(coupon === c.code ? '' : c.code);
                        setCouponInput(coupon === c.code ? '' : c.code);
                      }}
                    >
                      <Icon name="percent" size={14} style={{ display: 'inline', verticalAlign: '-2px' }} /> {c.name}
                    </button>
                  ))}
                </div>
                {quote?.rewardError && reward ? <p className="error-text" style={{ margin: 0 }}>{quote.rewardError}</p> : null}
              </section>
            ) : null}
          </div>

          <aside className="stack" style={{ '--gap': '16px', position: 'sticky', top: 90 } as React.CSSProperties}>
            <div className="card">
              <h2 className="h3 mb-2">Koszyk ({count})</h2>
              {cartView}
              <form
                className="row mt-2"
                style={{ flexWrap: 'nowrap' }}
                onSubmit={(e) => {
                  e.preventDefault();
                  setCoupon(couponInput.trim().toUpperCase());
                }}
              >
                <input className="input" placeholder="Kod rabatowy" value={couponInput} onChange={(e) => setCouponInput(e.target.value)} aria-label="Kod rabatowy" style={{ minHeight: 40 }} />
                <button className="btn btn-ghost btn-sm">Użyj</button>
              </form>
              {coupon && quote?.couponError ? <p className="error-text">{quote.couponError}</p> : null}
              {coupon && quote?.coupon ? <p className="small" style={{ color: 'var(--mint-ink)' }}>✓ {quote.coupon.name || quote.coupon.code}</p> : null}
              <label className="check mt-2">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                <span className="small">
                  Akceptuję <a href="/regulamin" className="link" target="_blank">regulamin</a> i <a href="/polityka-prywatnosci" className="link" target="_blank">politykę prywatności</a>.
                </span>
              </label>
              {submitError ? <p className="alert alert-error mt-2" role="alert">{submitError}</p> : null}
              <button className="btn btn-accent btn-lg w-full mt-2" disabled={submitting || !cart.length || !ordering.open || !ordering.slots.length} onClick={submit}>
                {submitting ? <span className="spinner" /> : null}
                {form.payment === 'online' ? 'Zamawiam i płacę' : 'Zamawiam'} · {formatPLN(quote?.total ?? localTotal)}
              </button>
            </div>
          </aside>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="sticky-chips" style={mode === 'app' ? { top: 56 } : undefined}>
        <div className="container stack" style={{ '--gap': '10px' } as React.CSSProperties}>
          <div className="row between" style={{ flexWrap: 'nowrap' }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: 420 }}>
              <span style={{ position: 'absolute', left: 14, top: 13, color: 'var(--ink-3)' }}>
                <Icon name="search" size={18} />
              </span>
              <input className="input" style={{ paddingLeft: 42 }} placeholder="Czego szukasz?" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Szukaj w menu" />
            </div>
            {locations.length > 1 ? (
              <select className="select" style={{ width: 'auto' }} value={loc} onChange={(e) => setLoc(e.target.value)} aria-label="Lokal">
                {locations.map((l) => (
                  <option key={l.slug} value={l.slug}>
                    {l.city}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
          <div className="chips" role="tablist">
            <button className="chip" aria-pressed={cat === 'all'} onClick={() => setCat('all')}>
              Wszystko
            </button>
            {data.user?.favorites.length ? (
              <button className="chip" aria-pressed={cat === 'fav'} onClick={() => setCat('fav')}>
                ♥ Ulubione
              </button>
            ) : null}
            {tops.map((t) => (
              <button key={t.key} className="chip" aria-pressed={cat === t.key} onClick={() => setCat(t.key)}>
                {t.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="container section-sm" style={{ paddingBottom: 120 }}>
        {!ordering.open ? (
          <p className="alert alert-warn mb-2">{ordering.reason} Możesz przejrzeć menu.</p>
        ) : !ordering.slots.length ? (
          <p className="alert alert-warn mb-2">Na dziś nie przyjmujemy już zamówień online. {ordering.status.label}.</p>
        ) : (
          <p className="small muted mb-2 row" style={{ '--gap': '6px' } as React.CSSProperties}>
            <Icon name="clock" size={16} /> Najbliższy odbiór: <strong style={{ color: 'var(--ink)' }}>{ordering.slots[0]}</strong> · {data.location.street}, {data.location.city}
          </p>
        )}
        <div className="shop-layout">
          <div>
            {grouped.length === 0 ? <p className="empty">Nic nie znaleźliśmy.</p> : null}
            {grouped.map((g) => (
              <section key={g.key} className="mb-3">
                <h2 className="h3 serif" style={{ fontSize: '1.5rem', marginBottom: 6 }}>
                  {g.name}
                </h2>
                {g.items.map((p) => {
                  const inCart = cart.filter((l) => l.productId === p.id).reduce((s, l) => s + l.quantity, 0);
                  return (
                    <div key={p.id} className="menu-row" style={{ opacity: p.available ? 1 : 0.5 }}>
                      <button className="thumb" onClick={() => p.available && setModalProduct(p.id)} aria-label={p.name} style={{ border: 0, padding: 0, position: 'relative' }} disabled={!p.available}>
                        {p.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.imageUrl} alt="" loading="lazy" />
                        ) : (
                          <span className="placeholder-img">
                            <Icon name="cup" size={24} />
                          </span>
                        )}
                      </button>
                      <button onClick={() => p.available && setModalProduct(p.id)} style={{ textAlign: 'left', background: 'none', border: 0, padding: 0, cursor: 'pointer' }} disabled={!p.available}>
                        <span className="product-name" style={{ display: 'block' }}>
                          {p.name} {inCart ? <span className="badge badge-accent">{inCart} w koszyku</span> : null}
                        </span>
                        {p.description ? <span className="product-desc small">{p.description}</span> : null}
                        <span className="price small" style={{ display: 'block', marginTop: 4 }}>
                          {p.variants.length > 1 ? 'od ' : ''}
                          {formatPLN(p.fromPrice)}
                          {!p.available ? <span className="badge badge-danger" style={{ marginLeft: 8 }}>Chwilowo brak</span> : null}
                        </span>
                      </button>
                      <button className="btn btn-soft btn-icon" aria-label={`Dodaj ${p.name}`} onClick={() => setModalProduct(p.id)} disabled={!p.available}>
                        <Icon name="plus" size={18} />
                      </button>
                    </div>
                  );
                })}
              </section>
            ))}
          </div>
          <aside className="cart-panel card">
            <h2 className="h3 mb-2">Twój koszyk</h2>
            {cartView}
            <button className="btn btn-accent btn-lg w-full mt-2" disabled={!cart.length} onClick={() => setStep('checkout')}>
              Przejdź dalej · {formatPLN(quote?.total ?? localTotal)}
            </button>
          </aside>
        </div>
      </div>

      {count > 0 ? (
        <div className="cart-bar" style={mode === 'app' ? { bottom: 'calc(84px + env(safe-area-inset-bottom))' } : undefined}>
          <button className="btn btn-accent btn-lg w-full" style={{ justifyContent: 'space-between' }} onClick={() => setCartOpen(true)}>
            <span className="row" style={{ '--gap': '8px' } as React.CSSProperties}>
              <Icon name="bag" size={18} /> Koszyk · {count}
            </span>
            <span>{formatPLN(quote?.total ?? localTotal)}</span>
          </button>
        </div>
      ) : null}

      <Modal
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        title="Twój koszyk"
        footer={
          <button
            className="btn btn-accent btn-lg w-full"
            disabled={!cart.length}
            onClick={() => {
              setCartOpen(false);
              setStep('checkout');
              window.scrollTo({ top: 0 });
            }}
          >
            Przejdź dalej · {formatPLN(quote?.total ?? localTotal)}
          </button>
        }
      >
        {cartView}
      </Modal>

      <ProductModal
        product={data.menu.find((p) => p.id === modalProduct) || null}
        location={data.location}
        allowSet={(id) => !!data.categories.find((c) => c.key === id)?.allowSet}
        favorite={modalProduct ? !!data.user?.favorites.includes(modalProduct) : false}
        canFavorite={!!data.user}
        onToggleFavorite={async (id) => {
          try {
            const r = await api<{ favorites: string[] }>('/api/me/favorites', { body: { productId: id } });
            setData((d) => (d && d.user ? { ...d, user: { ...d.user, favorites: r.favorites } } : d));
          } catch (e) {
            toast((e as Error).message, 'error');
          }
        }}
        onClose={() => setModalProduct(null)}
        onAdd={addLine}
      />
    </>
  );
}

export { cartKey };

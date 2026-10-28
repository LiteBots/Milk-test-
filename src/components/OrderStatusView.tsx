'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/client';
import { formatPLN, PAYMENT_LABELS, LOCATION_NAMES } from '@/lib/util';
import { Icon } from './Icon';

interface PublicOrder {
  id: string;
  orderNumber: string;
  status: string;
  statusLabel: string;
  items: { name: string; quantity: number; price: number; desc: string }[];
  subtotal: number;
  packagingFee: number;
  deliveryFee: number;
  discount: number;
  walletUsed: number;
  totalAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  pickupTime: string;
  deliveryMethod: string;
  location: string;
  customerName: string;
  rating: number | null;
  pointsEarned: number;
  source: string;
}

const STEPS = ['pending', 'preparing', 'ready', 'completed'];
const stepIndex = (s: string) => (s === 'accepted' ? 0 : STEPS.indexOf(s));

// Status na żywo (SSE) z zapasowym odpytywaniem co 10 s
export function OrderStatusView({ id, token, backHref }: { id: string; token: string; backHref?: string }) {
  const [o, setO] = useState<PublicOrder | null>(null);
  const [error, setError] = useState('');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [rated, setRated] = useState(false);
  const q = token ? `?t=${encodeURIComponent(token)}` : '';

  useEffect(() => {
    let es: EventSource | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;
    api<{ order: PublicOrder }>(`/api/orders/${id}${q}`)
      .then((r) => setO(r.order))
      .catch((e) => setError(e.message));
    if ('EventSource' in window) {
      es = new EventSource(`/api/orders/${id}/stream${q}`);
      es.onmessage = (ev) => {
        try {
          setO(JSON.parse(ev.data));
        } catch {
          /* ignoruj */
        }
      };
      es.onerror = () => {
        es?.close();
        if (!poll) poll = setInterval(() => api<{ order: PublicOrder }>(`/api/orders/${id}${q}`).then((r) => setO(r.order)).catch(() => {}), 10_000);
      };
    }
    return () => {
      es?.close();
      if (poll) clearInterval(poll);
    };
  }, [id, q]);

  if (error) return <p className="alert alert-error">{error}</p>;
  if (!o) return <div className="skeleton" style={{ height: 320 }} />;

  const idx = stepIndex(o.status);
  const big =
    o.status === 'awaiting_payment'
      ? 'Czekamy na płatność'
      : o.status === 'payment_failed'
        ? 'Płatność nie doszła do skutku'
        : o.status === 'cancelled'
          ? 'Zamówienie anulowane'
          : o.status === 'ready'
            ? 'Gotowe do odbioru!'
            : o.status === 'completed'
              ? 'Smacznego!'
              : o.status === 'preparing'
                ? 'Przygotowujemy'
                : 'Zamówienie przyjęte';

  async function rate() {
    try {
      await api(`/api/orders/${id}/rate${q}`, { body: { rating, comment } });
      setRated(true);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="stack" style={{ '--gap': '20px' } as React.CSSProperties}>
      <div className="card stack center">
        <span className="badge" style={{ margin: '0 auto' }}>
          {o.orderNumber}
        </span>
        <h1 className="status-big">{big}</h1>
        {!['cancelled', 'payment_failed', 'awaiting_payment'].includes(o.status) ? (
          <>
            <p className="muted" style={{ margin: 0 }}>
              {o.deliveryMethod === 'delivery' ? 'Dostawa' : 'Odbiór'} ok. <strong style={{ color: 'var(--ink)' }}>{o.pickupTime}</strong> · {LOCATION_NAMES[o.location] || o.location}
            </p>
            <div className="progress-steps" aria-label={`Etap: ${o.statusLabel}`}>
              {STEPS.map((s, i) => (
                <div key={s} data-done={idx >= i} />
              ))}
            </div>
            <div className="row between tiny muted">
              <span>Przyjęte</span>
              <span>W przygotowaniu</span>
              <span>Gotowe</span>
              <span>Odebrane</span>
            </div>
          </>
        ) : null}
        {o.status === 'awaiting_payment' ? <p className="small muted">Jeśli zapłaciłeś przed chwilą, status zmieni się automatycznie w ciągu kilku sekund.</p> : null}
        {o.status === 'payment_failed' ? (
          <Link href="/zamow" className="btn btn-accent" style={{ margin: '0 auto' }}>
            Złóż zamówienie ponownie
          </Link>
        ) : null}
        {o.pointsEarned ? <p className="alert alert-success small">+{o.pointsEarned} pkt w MilkMi za to zamówienie</p> : null}
      </div>

      <div className="card">
        <h2 className="h3 mb-2">Szczegóły</h2>
        {o.items.map((i, k) => (
          <div key={k} className="summary-row">
            <span>
              {i.quantity}× {i.name}
              {i.desc ? <span className="tiny muted" style={{ display: 'block' }}>{i.desc}</span> : null}
            </span>
            <span>{formatPLN(i.price * i.quantity)}</span>
          </div>
        ))}
        {o.discount ? (
          <div className="summary-row">
            <span>Rabaty</span>
            <span className="neg">−{formatPLN(o.discount)}</span>
          </div>
        ) : null}
        {o.packagingFee ? (
          <div className="summary-row">
            <span>Opakowania</span>
            <span>{formatPLN(o.packagingFee)}</span>
          </div>
        ) : null}
        {o.deliveryFee ? (
          <div className="summary-row">
            <span>Dostawa</span>
            <span>{formatPLN(o.deliveryFee)}</span>
          </div>
        ) : null}
        <div className="summary-row total">
          <span>Razem</span>
          <span>{formatPLN(o.totalAmount)}</span>
        </div>
        <p className="small muted mt-2" style={{ marginBottom: 0 }}>
          Płatność: {PAYMENT_LABELS[o.paymentMethod] || o.paymentMethod}
          {o.paymentStatus === 'paid' ? ' · opłacone' : o.paymentStatus === 'refunded' ? ' · zwrócone' : ''}
        </p>
      </div>

      {['completed', 'ready'].includes(o.status) && o.rating == null && !rated ? (
        <div className="card stack">
          <h2 className="h3">Jak smakowało?</h2>
          <div className="row" role="radiogroup" aria-label="Ocena">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} className="btn btn-ghost btn-icon" aria-pressed={rating === n} onClick={() => setRating(n)} aria-label={`${n} na 5`} style={{ color: n <= rating ? 'var(--accent)' : undefined }}>
                <Icon name="star" />
              </button>
            ))}
          </div>
          {rating ? (
            <>
              <textarea className="textarea" style={{ minHeight: 70 }} placeholder={rating <= 3 ? 'Co możemy poprawić?' : 'Napisz kilka słów (opcjonalnie)'} value={comment} onChange={(e) => setComment(e.target.value)} />
              <button className="btn btn-accent" onClick={rate}>
                Wyślij ocenę
              </button>
            </>
          ) : null}
        </div>
      ) : null}
      {rated ? <p className="alert alert-success">Dziękujemy za ocenę!</p> : null}

      <div className="row" style={{ justifyContent: 'center' }}>
        <Link href={backHref || '/'} className="btn btn-ghost">
          {backHref ? 'Wróć' : 'Strona główna'}
        </Link>
        {o.source !== 'app' ? (
          <Link href="/aplikacja" className="btn btn-soft">
            Zbieraj punkty w MilkMi
          </Link>
        ) : null}
      </div>
    </div>
  );
}

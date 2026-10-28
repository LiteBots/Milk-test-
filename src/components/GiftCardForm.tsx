'use client';

import { useState } from 'react';
import { api } from '@/lib/client';
import { track } from '@/lib/track';
import { formatPLN } from '@/lib/util';
import { Icon } from './Icon';

const AMOUNTS = [50, 100, 150, 200];

export function GiftCardForm({ enabled }: { enabled: boolean }) {
  const [amount, setAmount] = useState(100);
  const [custom, setCustom] = useState('');
  const [f, setF] = useState({ buyerName: '', buyerEmail: '', recipientName: '', recipientEmail: '', message: '' });
  const [toSelf, setToSelf] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const value = custom ? Number(custom) : amount;
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!consent) return setError('Zaakceptuj regulamin.');
    if (!(value >= 20 && value <= 1000)) return setError('Kwota karty: od 20 do 1000 zł.');
    setBusy(true);
    try {
      const r = await api<{ redirectUrl: string }>('/api/gift-cards', {
        body: { amount: value, ...f, recipientEmail: toSelf ? f.buyerEmail : f.recipientEmail, recipientName: toSelf ? f.buyerName : f.recipientName }
      });
      track('Karta podarunkowa', { kwota: value }, value);
      window.location.href = r.redirectUrl;
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  if (!enabled) return <p className="alert alert-warn">Sprzedaż kart online jest chwilowo wyłączona. Kartę kupisz w lokalu.</p>;

  return (
    <form className="stack" onSubmit={submit} noValidate>
      <div className="field">
        <span className="label">Wartość karty</span>
        <div className="chips" style={{ flexWrap: 'wrap' }}>
          {AMOUNTS.map((a) => (
            <button
              type="button"
              key={a}
              className="chip"
              aria-pressed={!custom && amount === a}
              onClick={() => {
                setAmount(a);
                setCustom('');
              }}
            >
              {a} zł
            </button>
          ))}
          <input className="input" style={{ width: 130, minHeight: 38 }} inputMode="numeric" placeholder="Inna kwota" value={custom} onChange={(e) => setCustom(e.target.value.replace(/\D/g, ''))} aria-label="Inna kwota" />
        </div>
      </div>
      <div className="grid grid-2" style={{ '--gap': '12px' } as React.CSSProperties}>
        <label className="field">
          <span className="label">Twoje imię</span>
          <input className="input" value={f.buyerName} onChange={set('buyerName')} required autoComplete="name" />
        </label>
        <label className="field">
          <span className="label">Twój e-mail</span>
          <input className="input" type="email" value={f.buyerEmail} onChange={set('buyerEmail')} required autoComplete="email" />
        </label>
      </div>
      <label className="check">
        <input type="checkbox" checked={toSelf} onChange={(e) => setToSelf(e.target.checked)} />
        <span>Wyślij kartę na mój e-mail (wręczę ją sam/a)</span>
      </label>
      {!toSelf ? (
        <div className="grid grid-2" style={{ '--gap': '12px' } as React.CSSProperties}>
          <label className="field">
            <span className="label">Imię obdarowanego</span>
            <input className="input" value={f.recipientName} onChange={set('recipientName')} required />
          </label>
          <label className="field">
            <span className="label">E-mail obdarowanego</span>
            <input className="input" type="email" value={f.recipientEmail} onChange={set('recipientEmail')} required />
          </label>
        </div>
      ) : null}
      <label className="field">
        <span className="label">Życzenia (opcjonalnie)</span>
        <textarea className="textarea" style={{ minHeight: 80 }} value={f.message} onChange={set('message')} maxLength={300} />
      </label>
      <label className="check">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>
          Akceptuję <a href="/regulamin" className="link">regulamin</a>. Karta jest ważna 12 miesięcy.
        </span>
      </label>
      {error ? <p className="alert alert-error" role="alert">{error}</p> : null}
      <button className="btn btn-accent btn-lg" disabled={busy}>
        {busy ? <span className="spinner" /> : <Icon name="gift" size={18} />} Kupuję za {formatPLN(value || 0)}
      </button>
      <p className="tiny muted center" style={{ margin: 0 }}>Płatność przez PayU: BLIK, przelew, karta.</p>
    </form>
  );
}

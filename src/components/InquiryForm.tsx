'use client';

import { useState } from 'react';
import { api } from '@/lib/client';
import { track } from '@/lib/track';
import { Icon } from './Icon';

type Kind = 'event' | 'contact' | 'job';

export function InquiryForm({ type, positions = [] }: { type: Kind; positions?: string[] }) {
  const [f, setF] = useState({ name: '', email: '', phone: '', message: '', date: '', guests: '', location: 'slupsk', position: positions[0] || '' });
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!consent) return setError('Zaakceptuj politykę prywatności.');
    setBusy(true);
    try {
      await api('/api/inquiries', { body: { type, ...f, guests: f.guests ? Number(f.guests) : undefined, website: '' } });
      track('Zapytanie', { typ: type });
      setDone(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="alert alert-success row" role="status">
        <Icon name="check" /> Dziękujemy! Odpowiemy najszybciej, jak to możliwe – zwykle w ciągu 24 godzin.
      </div>
    );
  }

  return (
    <form className="stack" onSubmit={submit} noValidate>
      <div className="grid grid-2" style={{ '--gap': '12px' } as React.CSSProperties}>
        <label className="field">
          <span className="label">Imię i nazwisko</span>
          <input className="input" value={f.name} onChange={set('name')} autoComplete="name" required />
        </label>
        <label className="field">
          <span className="label">Telefon</span>
          <input className="input" value={f.phone} onChange={set('phone')} type="tel" autoComplete="tel" />
        </label>
      </div>
      <label className="field">
        <span className="label">E-mail</span>
        <input className="input" value={f.email} onChange={set('email')} type="email" autoComplete="email" required />
      </label>
      {type === 'event' ? (
        <div className="grid grid-3" style={{ '--gap': '12px' } as React.CSSProperties}>
          <label className="field">
            <span className="label">Data</span>
            <input className="input" type="date" value={f.date} onChange={set('date')} />
          </label>
          <label className="field">
            <span className="label">Liczba gości</span>
            <input className="input" type="number" min={1} max={500} value={f.guests} onChange={set('guests')} />
          </label>
          <label className="field">
            <span className="label">Miejsce</span>
            <select className="select" value={f.location} onChange={set('location')}>
              <option value="slupsk">Lokal w Słupsku</option>
              <option value="rowy">Lokal w Rowach</option>
              <option value="wyjazd">U nas na wyjeździe / catering</option>
            </select>
          </label>
        </div>
      ) : null}
      {type === 'job' && positions.length ? (
        <div className="grid grid-2" style={{ '--gap': '12px' } as React.CSSProperties}>
          <label className="field">
            <span className="label">Stanowisko</span>
            <select className="select" value={f.position} onChange={set('position')}>
              {positions.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="label">Lokal</span>
            <select className="select" value={f.location} onChange={set('location')}>
              <option value="slupsk">Słupsk</option>
              <option value="rowy">Rowy (sezon)</option>
            </select>
          </label>
        </div>
      ) : null}
      <label className="field">
        <span className="label">{type === 'job' ? 'Napisz kilka zdań o sobie i dostępności' : 'Wiadomość'}</span>
        <textarea className="textarea" value={f.message} onChange={set('message')} required maxLength={3000} />
      </label>
      <label className="check">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>
          Wyrażam zgodę na przetwarzanie danych w celu odpowiedzi na zapytanie zgodnie z <a href="/polityka-prywatnosci" className="link">polityką prywatności</a>.
        </span>
      </label>
      {error ? <p className="alert alert-error" role="alert">{error}</p> : null}
      <button className="btn btn-accent btn-lg" disabled={busy}>
        {busy ? <span className="spinner" /> : <Icon name="send" size={18} />} Wyślij
      </button>
    </form>
  );
}

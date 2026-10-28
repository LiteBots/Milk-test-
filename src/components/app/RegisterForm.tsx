'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/client';
import { track } from '@/lib/track';

export function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next')?.startsWith('/app') ? params.get('next')! : '/app';
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '', birthday: '', referral: params.get('ref') || '' });
  const [terms, setTerms] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [sms, setSms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!terms) return setError('Zaakceptuj regulamin.');
    setBusy(true);
    try {
      await api('/api/auth/register', {
        body: { ...f, birthday: f.birthday ? f.birthday.slice(5) : '', terms: true, marketingConsent: marketing, smsConsent: sms }
      });
      track('Rejestracja');
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={submit} noValidate>
      <label className="field">
        <span className="label">Imię</span>
        <input className="input" value={f.name} onChange={set('name')} autoComplete="given-name" required />
      </label>
      <label className="field">
        <span className="label">E-mail</span>
        <input className="input" type="email" value={f.email} onChange={set('email')} autoComplete="email" required />
      </label>
      <label className="field">
        <span className="label">Telefon</span>
        <input className="input" type="tel" value={f.phone} onChange={set('phone')} autoComplete="tel" inputMode="tel" required placeholder="500 600 700" />
      </label>
      <label className="field">
        <span className="label">Hasło</span>
        <input className="input" type="password" value={f.password} onChange={set('password')} autoComplete="new-password" minLength={8} required />
        <span className="hint">Co najmniej 8 znaków.</span>
      </label>
      <label className="field">
        <span className="label">Data urodzin (opcjonalnie)</span>
        <input className="input" type="date" value={f.birthday} onChange={set('birthday')} />
        <span className="hint">W miesiącu urodzin dostaniesz kupon rabatowy. Rok nie jest zapisywany.</span>
      </label>
      <label className="field">
        <span className="label">Kod polecający (opcjonalnie)</span>
        <input className="input" value={f.referral} onChange={set('referral')} style={{ textTransform: 'uppercase' }} />
      </label>
      <label className="check">
        <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
        <span>
          Akceptuję <a href="/regulamin" className="link" target="_blank">regulamin</a> i <a href="/polityka-prywatnosci" className="link" target="_blank">politykę prywatności</a>.
        </span>
      </label>
      <label className="check">
        <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} />
        <span>Chcę dostawać informacje o nowościach i promocjach (push, e-mail).</span>
      </label>
      <label className="check">
        <input type="checkbox" checked={sms} onChange={(e) => setSms(e.target.checked)} />
        <span>Zgadzam się na SMS-y z ofertami.</span>
      </label>
      {error ? <p className="alert alert-error" role="alert">{error}</p> : null}
      <button className="btn btn-accent btn-lg" disabled={busy}>
        {busy ? <span className="spinner" /> : null} Załóż konto
      </button>
      <p className="small center muted">
        Masz konto? <Link href="/app/logowanie" className="link">Zaloguj się</Link>
      </p>
    </form>
  );
}

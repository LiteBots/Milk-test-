'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/client';

export function AdminLoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next')?.startsWith('/admin') ? params.get('next')! : '/admin';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [needs2fa, setNeeds2fa] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const r = await api<{ needs2fa?: boolean }>('/api/admin/auth/login', { body: { email, password, code: needs2fa ? code : undefined } });
      if (r.needs2fa) {
        setNeeds2fa(true);
        setBusy(false);
        return;
      }
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={submit}>
      <label className="field">
        <span className="label">E-mail</span>
        <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required disabled={needs2fa} />
      </label>
      <label className="field">
        <span className="label">Hasło</span>
        <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required disabled={needs2fa} />
      </label>
      {needs2fa ? (
        <label className="field">
          <span className="label">Kod z aplikacji uwierzytelniającej</span>
          <input className="input" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" autoFocus style={{ letterSpacing: '.3em', fontSize: '1.2rem' }} />
        </label>
      ) : null}
      {error ? <p className="alert alert-error" role="alert">{error}</p> : null}
      <button className="btn btn-lg" disabled={busy}>
        {busy ? <span className="spinner" /> : null} Zaloguj
      </button>
    </form>
  );
}

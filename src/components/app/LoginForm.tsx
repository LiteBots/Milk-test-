'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/client';

export function LoginForm({ codeEnabled }: { codeEnabled: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') && params.get('next')!.startsWith('/app') ? params.get('next')! : '/app';
  const [mode, setMode] = useState<'password' | 'code'>('password');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  async function run(fn: () => Promise<void>) {
    setError('');
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      {codeEnabled ? (
        <div className="segmented" role="group">
          <button type="button" aria-pressed={mode === 'password'} onClick={() => setMode('password')}>
            Hasło
          </button>
          <button type="button" aria-pressed={mode === 'code'} onClick={() => setMode('code')}>
            Kod na e-mail
          </button>
        </div>
      ) : null}
      {mode === 'password' ? (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await api('/api/auth/login', { body: { login, password } });
              router.replace(next);
              router.refresh();
            });
          }}
        >
          <label className="field">
            <span className="label">E-mail</span>
            <input className="input" value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username" inputMode="email" required />
          </label>
          <label className="field">
            <span className="label">Hasło</span>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </label>
          {error ? <p className="alert alert-error" role="alert">{error}</p> : null}
          <button className="btn btn-accent btn-lg" disabled={busy}>
            {busy ? <span className="spinner" /> : null} Zaloguj się
          </button>
          {codeEnabled ? (
            <button type="button" className="link small" onClick={() => setMode('code')}>
              Nie pamiętasz hasła? Zaloguj się kodem
            </button>
          ) : null}
        </form>
      ) : (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              if (!codeSent) {
                const r = await api<{ message: string }>('/api/auth/code/request', { body: { email: login } });
                setCodeSent(true);
                setInfo(r.message);
              } else {
                await api('/api/auth/code/verify', { body: { email: login, code } });
                router.replace(next);
                router.refresh();
              }
            });
          }}
        >
          <label className="field">
            <span className="label">E-mail</span>
            <input className="input" type="email" value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="email" required disabled={codeSent} />
          </label>
          {codeSent ? (
            <label className="field">
              <span className="label">Kod z e-maila</span>
              <input className="input" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" required style={{ letterSpacing: '.3em', fontSize: '1.2rem' }} />
            </label>
          ) : null}
          {info ? <p className="alert alert-info small">{info}</p> : null}
          {error ? <p className="alert alert-error" role="alert">{error}</p> : null}
          <button className="btn btn-accent btn-lg" disabled={busy}>
            {busy ? <span className="spinner" /> : null} {codeSent ? 'Zaloguj się' : 'Wyślij kod'}
          </button>
        </form>
      )}
      <p className="small center muted">
        Nie masz konta?{' '}
        <Link href={`/app/rejestracja${next !== '/app' ? `?next=${encodeURIComponent(next)}` : ''}`} className="link">
          Załóż je w minutę
        </Link>
      </p>
    </div>
  );
}

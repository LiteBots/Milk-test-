'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/client';
import { useToast } from '../Toast';
import { PushToggle } from './PushToggle';
import { Icon } from '../Icon';

interface Profile {
  name: string;
  email: string;
  phone: string;
  birthday: string;
  marketingConsent: boolean;
  smsConsent: boolean;
}

export function AccountSettings({ profile }: { profile: Profile }) {
  const router = useRouter();
  const toast = useToast();
  const [p, setP] = useState(profile);
  const [pw, setPw] = useState({ current: '', next: '' });
  const [busy, setBusy] = useState('');

  async function act(key: string, fn: () => Promise<void>) {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="stack" style={{ '--gap': '18px' } as React.CSSProperties}>
      <form
        className="card stack"
        onSubmit={(e) => {
          e.preventDefault();
          act('profile', async () => {
            await api('/api/me', { method: 'PATCH', body: { name: p.name, phone: p.phone, birthday: p.birthday, marketingConsent: p.marketingConsent, smsConsent: p.smsConsent } });
            toast('Zapisano.', 'success');
            router.refresh();
          });
        }}
      >
        <h2 className="h3">Dane</h2>
        <label className="field">
          <span className="label">Imię</span>
          <input className="input" value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} />
        </label>
        <label className="field">
          <span className="label">E-mail</span>
          <input className="input" value={p.email} disabled />
        </label>
        <label className="field">
          <span className="label">Telefon</span>
          <input className="input" value={p.phone} onChange={(e) => setP({ ...p, phone: e.target.value })} type="tel" />
        </label>
        <label className="field">
          <span className="label">Urodziny (dzień i miesiąc)</span>
          {profile.birthday ? (
            <input className="input" value={profile.birthday.split('-').reverse().join('.')} disabled />
          ) : (
            <input className="input" type="date" onChange={(e) => setP({ ...p, birthday: e.target.value ? e.target.value.slice(5) : '' })} />
          )}
          <span className="hint">Datę urodzin można ustawić raz. Zmianę zgłoś w lokalu.</span>
        </label>
        <label className="check">
          <input type="checkbox" checked={p.marketingConsent} onChange={(e) => setP({ ...p, marketingConsent: e.target.checked })} />
          <span>Nowości i promocje (push, e-mail)</span>
        </label>
        <label className="check">
          <input type="checkbox" checked={p.smsConsent} onChange={(e) => setP({ ...p, smsConsent: e.target.checked })} />
          <span>Oferty SMS</span>
        </label>
        <button className="btn btn-accent" disabled={busy === 'profile'}>
          Zapisz
        </button>
      </form>

      <section className="card stack">
        <h2 className="h3">Powiadomienia</h2>
        <p className="small muted" style={{ margin: 0 }}>Status zamówienia na telefonie, gdy będzie gotowe do odbioru.</p>
        <PushToggle />
      </section>

      <form
        className="card stack"
        onSubmit={(e) => {
          e.preventDefault();
          act('pw', async () => {
            await api('/api/me/password', { body: pw });
            setPw({ current: '', next: '' });
            toast('Hasło zmienione.', 'success');
          });
        }}
      >
        <h2 className="h3">Zmiana hasła</h2>
        <input className="input" type="password" placeholder="Obecne hasło" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} autoComplete="current-password" />
        <input className="input" type="password" placeholder="Nowe hasło (min. 8 znaków)" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} autoComplete="new-password" />
        <button className="btn btn-ghost" disabled={busy === 'pw' || pw.next.length < 8}>
          Zmień hasło
        </button>
      </form>

      <section className="card stack">
        <h2 className="h3">Prywatność</h2>
        <a href="/api/me/export" className="btn btn-ghost">
          <Icon name="download" size={16} /> Pobierz moje dane
        </a>
        <button
          className="btn btn-ghost"
          style={{ color: 'var(--danger)' }}
          disabled={busy === 'del'}
          onClick={() => {
            if (!confirm('Usunąć konto? Punkty i środki w portfelu przepadną. Tej operacji nie można cofnąć.')) return;
            act('del', async () => {
              await api('/api/me', { method: 'DELETE' });
              router.replace('/app');
              router.refresh();
            });
          }}
        >
          Usuń konto
        </button>
      </section>

      <button
        className="btn btn-soft"
        onClick={() =>
          act('logout', async () => {
            await api('/api/auth/logout', { method: 'POST' });
            router.replace('/app');
            router.refresh();
          })
        }
      >
        <Icon name="logout" size={16} /> Wyloguj
      </button>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import type { ILocation, WeekKey } from '@/lib/models/core';
import { WEEK_LABELS, WEEK_ORDER } from '@/lib/hours';
import { PageHead, ImageInput, Switch, TagsInput, fmtDate, useData, useRun } from './ui';
import { useAdmin } from './AdminContext';
import { Icon } from '../Icon';

type L = ILocation & { _id: string };

export function LocationSettings() {
  const { location, refreshLive } = useAdmin();
  const { data, reload } = useData<{ locations: L[] }>('/api/admin/locations');
  const [l, setL] = useState<L | null>(null);
  const [tab, setTab] = useState<'orders' | 'hours' | 'info' | 'res'>('orders');
  const { busy, run } = useRun();
  useEffect(() => {
    const found = data?.locations.find((x) => x.slug === location);
    if (found) setL(JSON.parse(JSON.stringify(found)));
  }, [data, location]);
  if (!l) return <div className="skeleton" style={{ height: 300 }} />;
  const set = <K extends keyof L>(k: K, v: L[K]) => setL({ ...l, [k]: v });
  const num = (k: keyof L, label: string, hint?: string) => (
    <label className="field">
      <span className="label">{label}</span>
      <input className="input" type="number" step="any" value={Number(l[k] ?? 0)} onChange={(e) => set(k, Number(e.target.value) as L[typeof k])} />
      {hint ? <span className="hint">{hint}</span> : null}
    </label>
  );
  const txt = (k: keyof L, label: string, area = false) => (
    <label className="field">
      <span className="label">{label}</span>
      {area ? (
        <textarea className="textarea" value={String(l[k] ?? '')} onChange={(e) => set(k, e.target.value as L[typeof k])} />
      ) : (
        <input className="input" value={String(l[k] ?? '')} onChange={(e) => set(k, e.target.value as L[typeof k])} />
      )}
    </label>
  );

  async function save() {
    const { _id, slug, updatedAt, pausedUntil, ...body } = l!;
    void _id;
    void updatedAt;
    void pausedUntil;
    const ok = await run(() => api(`/api/admin/locations/${slug}`, { method: 'PATCH', body }), 'Ustawienia zapisane.');
    if (ok) {
      reload();
      refreshLive();
    }
  }

  return (
    <>
      <PageHead title={`Ustawienia: ${l.name}`} sub={`Ostatnia zmiana: ${fmtDate(l.updatedAt)}`} actions={<button className="btn btn-accent btn-sm" onClick={save} disabled={busy}>Zapisz</button>} />
      <div className="tabs">
        {(
          [
            ['orders', 'Zamówienia online'],
            ['hours', 'Godziny i wyjątki'],
            ['res', 'Rezerwacje'],
            ['info', 'Dane lokalu i SEO']
          ] as const
        ).map(([k, t]) => (
          <button key={k} aria-selected={tab === k} onClick={() => setTab(k)}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'orders' ? (
        <div className="grid grid-2">
          <section className="card stack">
            <Switch checked={l.active} onChange={(v) => set('active', v)} label="Lokal aktywny (widoczny na stronie)" />
            <Switch checked={l.ordersEnabled} onChange={(v) => set('ordersEnabled', v)} label="Przyjmuj zamówienia online" />
            <Switch checked={l.pickupEnabled} onChange={(v) => set('pickupEnabled', v)} label="Odbiór osobisty" />
            <Switch checked={l.deliveryEnabled} onChange={(v) => set('deliveryEnabled', v)} label="Dostawa" />
            <div className="grid grid-2" style={{ '--gap': '10px' } as React.CSSProperties}>
              {num('prepMinutes', 'Czas przygotowania (min)')}
              {num('slotStepMinutes', 'Odstęp godzin odbioru (min)')}
              {num('maxOrdersPerSlot', 'Maks. zamówień na godzinę odbioru', 'Ogranicza obłożenie kuchni')}
              {num('lastOrderMinutesBeforeClose', 'Ostatnie zamówienie (min przed zamknięciem)')}
              {num('packagingFee', 'Opakowania (zł)')}
              {num('mealSetPrice', 'Dopłata do zestawu (zł)')}
            </div>
          </section>
          <section className="card stack">
            <h2 className="h3">Zestawy</h2>
            <span className="label">Dodatki do wyboru</span>
            <TagsInput value={l.setSides} onChange={(v) => set('setSides', v)} />
            <span className="label">Napoje do wyboru</span>
            <TagsInput value={l.setDrinks} onChange={(v) => set('setDrinks', v)} />
            {l.deliveryEnabled ? (
              <>
                <h2 className="h3 mt-2">Dostawa</h2>
                <div className="grid grid-3" style={{ '--gap': '10px' } as React.CSSProperties}>
                  {num('deliveryFee', 'Opłata (zł)')}
                  {num('freeDeliveryThreshold', 'Darmowa od (zł)')}
                  {num('deliveryMinOrder', 'Minimum (zł)')}
                </div>
                <span className="label">Strefy / miejscowości</span>
                <TagsInput value={l.deliveryZones} onChange={(v) => set('deliveryZones', v)} />
              </>
            ) : null}
          </section>
        </div>
      ) : null}

      {tab === 'hours' ? (
        <div className="grid grid-2">
          <section className="card stack">
            <h2 className="h3">Godziny tygodniowe</h2>
            {WEEK_ORDER.map((k: WeekKey) => {
              const d = l.schedule[k];
              const upd = (patch: Partial<typeof d>) => set('schedule', { ...l.schedule, [k]: { ...d, ...patch } });
              return (
                <div key={k} className="row" style={{ flexWrap: 'nowrap' }}>
                  <span style={{ width: 120 }} className="small">
                    {WEEK_LABELS[k]}
                  </span>
                  <Switch checked={d.isOpen} onChange={(v) => upd({ isOpen: v })} />
                  <input className="input" type="time" value={d.from} disabled={!d.isOpen} onChange={(e) => upd({ from: e.target.value })} style={{ width: 120 }} />
                  <input className="input" type="time" value={d.to} disabled={!d.isOpen} onChange={(e) => upd({ to: e.target.value })} style={{ width: 120 }} />
                </div>
              );
            })}
            <Switch checked={l.seasonal} onChange={(v) => set('seasonal', v)} label="Lokal sezonowy" />
            {txt('seasonNote', 'Komunikat sezonowy (np. „Otwieramy 20 czerwca”)')}
          </section>
          <section className="card stack">
            <h2 className="h3">Wyjątki (święta, wydarzenia)</h2>
            {(l.exceptions || [])
              .slice()
              .sort((a, b) => a.date.localeCompare(b.date))
              .map((e, i) => (
                <div key={`${e.date}-${i}`} className="row" style={{ flexWrap: 'nowrap' }}>
                  <input className="input" type="date" value={e.date} onChange={(ev) => set('exceptions', l.exceptions.map((x) => (x === e ? { ...x, date: ev.target.value } : x)))} style={{ width: 160 }} />
                  <label className="check small">
                    <input type="checkbox" checked={e.closed} onChange={(ev) => set('exceptions', l.exceptions.map((x) => (x === e ? { ...x, closed: ev.target.checked } : x)))} /> zamknięte
                  </label>
                  {!e.closed ? (
                    <>
                      <input className="input" type="time" value={e.from || '10:00'} onChange={(ev) => set('exceptions', l.exceptions.map((x) => (x === e ? { ...x, from: ev.target.value } : x)))} style={{ width: 110 }} />
                      <input className="input" type="time" value={e.to || '18:00'} onChange={(ev) => set('exceptions', l.exceptions.map((x) => (x === e ? { ...x, to: ev.target.value } : x)))} style={{ width: 110 }} />
                    </>
                  ) : null}
                  <input className="input" placeholder="Opis" value={e.note || ''} onChange={(ev) => set('exceptions', l.exceptions.map((x) => (x === e ? { ...x, note: ev.target.value } : x)))} />
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={() => set('exceptions', l.exceptions.filter((x) => x !== e))} aria-label="Usuń">
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              ))}
            <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => set('exceptions', [...(l.exceptions || []), { date: new Date().toISOString().slice(0, 10), closed: true, note: '' }])}>
              + Wyjątek
            </button>
            <p className="hint">Wyjątki zmieniają godziny na stronie, w danych dla Google i w dostępnych godzinach odbioru.</p>
          </section>
        </div>
      ) : null}

      {tab === 'res' ? (
        <section className="card stack" style={{ maxWidth: 720 }}>
          <Switch checked={l.reservationsEnabled} onChange={(v) => set('reservationsEnabled', v)} label="Przyjmuj rezerwacje online" />
          <div className="grid grid-2" style={{ '--gap': '10px' } as React.CSSProperties}>
            {num('reservationSlotMinutes', 'Co ile minut można rezerwować')}
            {num('reservationDurationMinutes', 'Czas zajęcia stolika (min)')}
          </div>
          <h2 className="h3">Strefy</h2>
          {l.reservationZones.map((z, i) => (
            <div key={i} className="row" style={{ flexWrap: 'nowrap' }}>
              <input className="input" placeholder="Nazwa (np. Sala)" value={z.name} onChange={(e) => set('reservationZones', l.reservationZones.map((x, k) => (k === i ? { ...x, name: e.target.value, key: x.key || e.target.value.toLowerCase().replace(/\s+/g, '-') } : x)))} />
              <input className="input" type="number" style={{ width: 120 }} value={z.seats} onChange={(e) => set('reservationZones', l.reservationZones.map((x, k) => (k === i ? { ...x, seats: Number(e.target.value) } : x)))} />
              <span className="small muted">miejsc</span>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => set('reservationZones', l.reservationZones.filter((_, k) => k !== i))} aria-label="Usuń">
                <Icon name="trash" size={14} />
              </button>
            </div>
          ))}
          <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => set('reservationZones', [...l.reservationZones, { key: `strefa-${l.reservationZones.length + 1}`, name: 'Nowa strefa', seats: 10 }])}>
            + Strefa
          </button>
        </section>
      ) : null}

      {tab === 'info' ? (
        <div className="grid grid-2">
          <section className="card stack">
            {txt('name', 'Nazwa lokalu')}
            <div className="grid grid-2" style={{ '--gap': '10px' } as React.CSSProperties}>
              {txt('street', 'Ulica i numer')}
              {txt('postalCode', 'Kod pocztowy')}
              {txt('city', 'Miasto')}
              {txt('phone', 'Telefon')}
              {txt('email', 'E-mail')}
              {txt('mapsUrl', 'Link do Google Maps')}
              {num('lat', 'Szerokość geogr.')}
              {num('lng', 'Długość geogr.')}
            </div>
            <p className="hint" style={{ margin: 0 }}>Nazwa, adres i telefon muszą być identyczne jak w wizytówce Google (spójny NAP = lepsze SEO lokalne).</p>
          </section>
          <section className="card stack">
            {txt('description', 'Opis lokalu (strona /lokale/…)', true)}
            {txt('directions', 'Dojazd i parking (strona /lokale/…)', true)}
            <span className="label">Zdjęcia lokalu</span>
            <div className="grid grid-2">
              {Array.from({ length: 6 }, (_, i) => (
                <ImageInput
                  key={i}
                  label={`Zdjęcie ${i + 1}`}
                  value={l.photos[i] || ''}
                  onChange={(v) => {
                    const arr = [...l.photos];
                    arr[i] = v;
                    set('photos', arr.filter((x, k) => x || k < arr.length - 1));
                  }}
                />
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

// Profil pracownika: 2FA i hasło
export function StaffProfile() {
  const { session } = useAdmin();
  const { data, reload } = useData<{ enabled: boolean; secret?: string; qr?: string }>('/api/admin/auth/2fa');
  const [code, setCode] = useState('');
  const [pw, setPw] = useState({ current: '', next: '' });
  const { busy, run } = useRun();
  return (
    <>
      <PageHead title="Mój profil" sub={`${session.name} · zabezpieczenia konta`} />
      <div className="grid grid-2">
        <section className="card stack">
          <h2 className="h3">Weryfikacja dwuetapowa (2FA)</h2>
          {data?.enabled ? (
            <>
              <p className="alert alert-success small">2FA jest włączone. Przy logowaniu podajesz kod z aplikacji.</p>
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <input className="input" placeholder="Kod, aby wyłączyć" value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" />
                <button className="btn btn-ghost" disabled={busy} onClick={() => run(async () => { await api('/api/admin/auth/2fa', { method: 'DELETE', body: { code } }); setCode(''); reload(); }, 'Wyłączono 2FA.')}>
                  Wyłącz
                </button>
              </div>
            </>
          ) : data?.qr ? (
            <>
              <p className="small muted" style={{ margin: 0 }}>Zeskanuj kod w Google Authenticator, Authy lub 1Password i wpisz 6 cyfr.</p>
              <div style={{ width: 200, background: '#fff', padding: 8, borderRadius: 12 }} dangerouslySetInnerHTML={{ __html: data.qr }} />
              <code className="tiny">{data.secret}</code>
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <input className="input" placeholder="Kod z aplikacji" value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" />
                <button className="btn btn-accent" disabled={busy} onClick={() => run(async () => { await api('/api/admin/auth/2fa', { body: { code } }); setCode(''); reload(); }, 'Włączono 2FA.')}>
                  Włącz
                </button>
              </div>
            </>
          ) : (
            <div className="skeleton" style={{ height: 120 }} />
          )}
        </section>
        <section className="card stack">
          <h2 className="h3">Zmiana hasła</h2>
          <input className="input" type="password" placeholder="Obecne hasło" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} autoComplete="current-password" />
          <input className="input" type="password" placeholder="Nowe hasło (min. 10 znaków)" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} autoComplete="new-password" />
          <button className="btn btn-ghost" disabled={busy || pw.next.length < 10} onClick={() => run(async () => { await api('/api/admin/auth/password', { body: pw }); setPw({ current: '', next: '' }); }, 'Hasło zmienione.')}>
            Zmień hasło
          </button>
        </section>
      </div>
    </>
  );
}

export function AuditLogView() {
  const { data } = useData<{ items: { _id: string; at: string; staffName: string; action: string; entity: string; entityId?: string; details?: string; ip?: string }[] }>('/api/admin/audit?limit=300');
  const ACTION: Record<string, string> = { create: 'dodanie', update: 'zmiana', delete: 'usunięcie', login: 'logowanie', cancel: 'anulowanie', pause: 'pauza', import: 'import', duplicate: 'kopia', quick_update: 'szybka zmiana', award_points: 'punkty', adjust_points: 'korekta pkt', wallet: 'portfel', reward_used: 'nagroda', send: 'wysyłka', giftcard_redeem: 'karta' };
  return (
    <>
      <PageHead title="Dziennik zmian" sub="Kto, co i kiedy zmienił w panelu (ostatnie 300 wpisów)." />
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Kiedy</th>
              <th>Kto</th>
              <th>Akcja</th>
              <th>Obiekt</th>
              <th>Szczegóły</th>
            </tr>
          </thead>
          <tbody>
            {(data?.items || []).map((a) => (
              <tr key={a._id}>
                <td className="small">{fmtDate(a.at)}</td>
                <td>{a.staffName}</td>
                <td>{ACTION[a.action] || a.action}</td>
                <td className="small">{a.entity}</td>
                <td className="tiny muted" style={{ maxWidth: 420, wordBreak: 'break-word' }}>
                  {a.details}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function MigrationCard() {
  const { session } = useAdmin();
  const [oldUrl, setOldUrl] = useState('');
  const [log, setLog] = useState<string[]>([]);
  const { busy, run } = useRun();
  if (session.role !== 'owner') return null;
  return (
    <section className="card stack mt-4" style={{ maxWidth: 720 }}>
      <h2 className="h3">Migracja ze starej wersji</h2>
      <p className="small muted" style={{ margin: 0 }}>
        Uzupełnia dane klientów i zamówień ze starej aplikacji oraz przenosi zdjęcia produktów do bazy. Można uruchomić wielokrotnie.
      </p>
      <input className="input" placeholder="Adres starego serwisu (opcjonalnie, np. https://stara-domena.up.railway.app)" value={oldUrl} onChange={(e) => setOldUrl(e.target.value)} />
      <button
        className="btn btn-ghost"
        style={{ alignSelf: 'flex-start' }}
        disabled={busy}
        onClick={async () => {
          const r = await run(() => api<{ log: string[] }>('/api/admin/migrate', { body: { oldUrl } }), 'Migracja zakończona.');
          if (r) setLog(r.log);
        }}
      >
        {busy ? <span className="spinner" /> : null} Uruchom migrację
      </button>
      {log.length ? (
        <pre className="small" style={{ whiteSpace: 'pre-wrap', background: 'var(--cream)', padding: 12, borderRadius: 12 }}>
          {log.join('\n')}
        </pre>
      ) : null}
    </section>
  );
}

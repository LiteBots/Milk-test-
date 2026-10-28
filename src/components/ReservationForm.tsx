'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/client';
import { track } from '@/lib/track';
import { localParts, addDays } from '@/lib/hours';
import type { PublicLocation } from '@/lib/data';
import { Icon } from './Icon';

interface Slot {
  time: string;
  available: boolean;
}

export function ReservationForm({
  locations,
  compact = false,
  defaultLocation,
  prefill
}: {
  locations: PublicLocation[];
  compact?: boolean;
  defaultLocation?: string;
  prefill?: { name?: string; phone?: string; email?: string };
}) {
  const today = useMemo(() => localParts().date, []);
  const [loc, setLoc] = useState(defaultLocation && locations.some((l) => l.slug === defaultLocation) ? defaultLocation : locations[0]?.slug || '');
  const location = locations.find((l) => l.slug === loc);
  const [date, setDate] = useState(today);
  const [guests, setGuests] = useState(2);
  const [zone, setZone] = useState(location?.reservationZones?.[0]?.key || 'sala');
  const [time, setTime] = useState('');
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [name, setName] = useState(prefill?.name || '');
  const [phone, setPhone] = useState(prefill?.phone || '');
  const [email, setEmail] = useState(prefill?.email || '');
  const [notes, setNotes] = useState('');
  const [occasion, setOccasion] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    if (location && !location.reservationZones.some((z) => z.key === zone)) setZone(location.reservationZones[0]?.key || 'sala');
  }, [location, zone]);

  useEffect(() => {
    if (!loc) return;
    const ctrl = new AbortController();
    setSlots(null);
    setTime('');
    api<{ slots: Slot[] }>(`/api/reservations/availability?location=${loc}&date=${date}&guests=${guests}&zone=${zone}`, { signal: ctrl.signal })
      .then((d) => setSlots(d.slots))
      .catch((e) => {
        if (e.name !== 'AbortError') setSlots([]);
      });
    return () => ctrl.abort();
  }, [loc, date, guests, zone]);

  if (!locations.length) {
    return <p className="muted">Rezerwacje są chwilowo wyłączone. Zadzwoń do lokalu.</p>;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!time) return setError('Wybierz godzinę.');
    if (!consent) return setError('Zaakceptuj regulamin, aby wysłać rezerwację.');
    setBusy(true);
    try {
      const r = await api<{ message: string }>('/api/reservations', {
        body: { location: loc, date, time, guests, zone, name, phone, email, notes, occasion }
      });
      track('Rezerwacja', { lokal: loc, osoby: guests });
      setDone(r.message);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="stack center" style={{ padding: '24px 0' }}>
        <div className="feature-icon" style={{ margin: '0 auto', background: 'var(--mint)', color: 'var(--mint-ink)' }}>
          <Icon name="check" />
        </div>
        <h3 className="h3">Dziękujemy!</h3>
        <p className="muted">{done}</p>
        <button className="btn btn-ghost btn-sm" onClick={() => setDone(null)} style={{ margin: '0 auto' }}>
          Nowa rezerwacja
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="stack" noValidate>
      {locations.length > 1 ? (
        <div className="segmented" role="group" aria-label="Lokal">
          {locations.map((l) => (
            <button type="button" key={l.slug} aria-pressed={loc === l.slug} onClick={() => setLoc(l.slug)}>
              {l.city}
            </button>
          ))}
        </div>
      ) : null}
      <div className="grid grid-3" style={{ '--gap': '12px' } as React.CSSProperties}>
        <label className="field">
          <span className="label">Data</span>
          <input className="input" type="date" min={today} max={addDays(today, 60)} value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <label className="field">
          <span className="label">Liczba osób</span>
          <select className="select" value={guests} onChange={(e) => setGuests(Number(e.target.value))}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? 'osoba' : n < 5 ? 'osoby' : 'osób'}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="label">Strefa</span>
          <select className="select" value={zone} onChange={(e) => setZone(e.target.value)}>
            {(location?.reservationZones || []).map((z) => (
              <option key={z.key} value={z.key}>
                {z.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="field">
        <span className="label">Godzina</span>
        {slots === null ? (
          <div className="skeleton" style={{ height: 44 }} />
        ) : slots.filter((s) => s.available).length === 0 ? (
          <p className="alert small">Brak wolnych stolików w tym dniu – wybierz inną datę lub zadzwoń do lokalu.</p>
        ) : (
          <div className="slot-grid">
            {slots
              .filter((s) => s.available)
              .map((s) => (
                <button type="button" key={s.time} className="slot" aria-pressed={time === s.time} onClick={() => setTime(s.time)}>
                  {s.time}
                </button>
              ))}
          </div>
        )}
      </div>
      <div className="grid grid-2" style={{ '--gap': '12px' } as React.CSSProperties}>
        <label className="field">
          <span className="label">Imię i nazwisko</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required minLength={2} />
        </label>
        <label className="field">
          <span className="label">Telefon</span>
          <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" autoComplete="tel" inputMode="tel" required placeholder="500 600 700" />
        </label>
      </div>
      {!compact ? (
        <>
          <label className="field">
            <span className="label">E-mail (opcjonalnie)</span>
            <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" />
          </label>
          <label className="field">
            <span className="label">Okazja</span>
            <select className="select" value={occasion} onChange={(e) => setOccasion(e.target.value)}>
              <option value="">Bez okazji</option>
              <option value="urodziny">Urodziny</option>
              <option value="randka">Randka</option>
              <option value="spotkanie">Spotkanie firmowe</option>
              <option value="inne">Inna</option>
            </select>
          </label>
        </>
      ) : null}
      <label className="field">
        <span className="label">Uwagi (opcjonalnie)</span>
        <textarea className="textarea" style={{ minHeight: 70 }} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={400} placeholder="np. krzesełko dla dziecka" />
      </label>
      <label className="check">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>
          Akceptuję <a href="/regulamin" className="link">regulamin</a> i <a href="/polityka-prywatnosci" className="link">politykę prywatności</a>.
        </span>
      </label>
      {error ? <p className="alert alert-error" role="alert">{error}</p> : null}
      <button className="btn btn-accent btn-lg" disabled={busy}>
        {busy ? <span className="spinner" /> : <Icon name="calendar" size={18} />} Zarezerwuj{time ? ` na ${time}` : ''}
      </button>
    </form>
  );
}

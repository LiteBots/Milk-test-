'use client';

import { useMemo, useState } from 'react';
import { api } from '@/lib/client';
import { addDays, localParts, WEEK_LABELS, weekdayOf } from '@/lib/hours';
import { PageHead, useData, useRun } from './ui';
import { useAdmin } from './AdminContext';
import { Modal } from '../Modal';
import { Icon } from '../Icon';

interface R {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  datetime: string;
  guests: number;
  zone: string;
  notes: string;
  occasion?: string;
  status: string;
  smsSent?: boolean;
}

const LABEL: Record<string, string> = { pending: 'Do potwierdzenia', accepted: 'Potwierdzona', rejected: 'Odrzucona', cancelled: 'Odwołana', no_show: 'Nie przyszli', completed: 'Zakończona' };

function mondayOf(date: string) {
  const wd = weekdayOf(date);
  const idx = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].indexOf(wd);
  return addDays(date, -idx);
}

export function ReservationsAdmin() {
  const { location } = useAdmin();
  const today = localParts().date;
  const [view, setView] = useState<'day' | 'week'>('day');
  const [date, setDate] = useState(today);
  const from = view === 'day' ? date : mondayOf(date);
  const to = view === 'day' ? date : addDays(from, 6);
  const { data, reload } = useData<{ items: R[]; pending: R[] }>(`/api/admin/reservations?location=${location}&from=${from}&to=${to}`, [location, from, to]);
  const locs = useData<{ locations: { slug: string; reservationZones: { key: string; name: string; seats: number }[] }[] }>('/api/admin/locations');
  const zones = locs.data?.locations.find((l) => l.slug === location)?.reservationZones || [];
  const [sel, setSel] = useState<R | null>(null);
  const [adding, setAdding] = useState(false);
  const { busy, run } = useRun();

  const days = useMemo(() => Array.from({ length: view === 'day' ? 1 : 7 }, (_, i) => addDays(from, i)), [from, view]);
  const hours = useMemo(() => {
    const hs = new Set<string>();
    (data?.items || []).forEach((r) => hs.add(r.datetime.slice(11, 13)));
    for (let h = 10; h <= 21; h++) hs.add(String(h).padStart(2, '0'));
    return [...hs].sort();
  }, [data]);

  async function setStatus(r: R, status: string) {
    await run(async () => {
      await api(`/api/admin/reservations/${r._id}`, { method: 'PATCH', body: { status } });
      reload();
      setSel(null);
    }, `${r.name}: ${LABEL[status]}`);
  }

  const guestsToday = (data?.items || []).filter((r) => r.datetime.startsWith(today) && ['pending', 'accepted'].includes(r.status)).reduce((s, r) => s + r.guests, 0);

  return (
    <>
      <PageHead
        title="Rezerwacje"
        sub={view === 'day' ? `${WEEK_LABELS[weekdayOf(date)]}, ${date}${date === today ? ` · dziś gości: ${guestsToday}` : ''}` : `Tydzień ${from} – ${to}`}
        actions={
          <>
            <div className="segmented">
              <button aria-pressed={view === 'day'} onClick={() => setView('day')}>
                Dzień
              </button>
              <button aria-pressed={view === 'week'} onClick={() => setView('week')}>
                Tydzień
              </button>
            </div>
            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setDate(addDays(date, view === 'day' ? -1 : -7))} aria-label="Wstecz">
              <Icon name="chevron-left" size={16} />
            </button>
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: 160, minHeight: 36 }} />
            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setDate(addDays(date, view === 'day' ? 1 : 7))} aria-label="Dalej">
              <Icon name="chevron-right" size={16} />
            </button>
            <button className="btn btn-accent btn-sm" onClick={() => setAdding(true)}>
              <Icon name="plus" size={16} /> Dodaj
            </button>
          </>
        }
      />
      {data?.pending.length ? (
        <div className="card card-sm mb-3" style={{ borderColor: 'var(--amber-ink)' }}>
          <strong className="small">Do potwierdzenia ({data.pending.length})</strong>
          {data.pending.map((r) => (
            <div key={r._id} className="list-link small" style={{ padding: '8px 0' }}>
              <span>
                <strong>{r.datetime.replace('T', ' ')}</strong> · {r.name} · {r.guests} os. · {zones.find((z) => z.key === r.zone)?.name || r.zone}
                {r.notes ? <span className="muted"> · „{r.notes}”</span> : null}
              </span>
              <span className="row" style={{ flexWrap: 'nowrap' }}>
                <button className="btn btn-sm" style={{ '--bg': 'var(--mint-ink)' } as React.CSSProperties} disabled={busy} onClick={() => setStatus(r, 'accepted')}>
                  Potwierdź
                </button>
                <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setStatus(r, 'rejected')}>
                  Odrzuć
                </button>
              </span>
            </div>
          ))}
          <p className="tiny muted" style={{ margin: '6px 0 0' }}>Potwierdzenie i odmowa wysyłają SMS do gościa (gdy SMSAPI jest skonfigurowane).</p>
        </div>
      ) : null}

      <div className="cal-grid" style={{ '--cols': days.length } as React.CSSProperties}>
        <div className="cal-head" />
        {days.map((d) => (
          <div key={d} className="cal-head" style={d === today ? { color: 'var(--accent-ink)' } : undefined}>
            {WEEK_LABELS[weekdayOf(d)].slice(0, 3)} {d.slice(8)}.{d.slice(5, 7)}
          </div>
        ))}
        {hours.map((h) => (
          <div key={h} className="cal-row">
            <div className="tiny muted">{h}:00</div>
            {days.map((d) => (
              <div key={d + h}>
                {(data?.items || [])
                  .filter((r) => r.datetime.startsWith(`${d}T${h}`))
                  .map((r) => (
                    <button key={r._id} className="cal-item" data-status={r.status} onClick={() => setSel(r)}>
                      <strong>{r.datetime.slice(11)}</strong> {r.name} · {r.guests} os.
                    </button>
                  ))}
              </div>
            ))}
          </div>
        ))}
      </div>

      <Modal open={!!sel} onClose={() => setSel(null)} title={sel ? `${sel.name} · ${sel.datetime.replace('T', ' ')}` : ''}>
        {sel ? (
          <div className="stack">
            <div className="small">
              <span className="badge">{LABEL[sel.status]}</span> · {sel.guests} os. · {zones.find((z) => z.key === sel.zone)?.name || sel.zone}
              {sel.occasion ? ` · okazja: ${sel.occasion}` : ''}
            </div>
            <div className="small">
              <a className="link" href={`tel:${sel.phone}`}>{sel.phone}</a> {sel.email ? `· ${sel.email}` : ''} {sel.smsSent ? '· SMS wysłany' : ''}
            </div>
            {sel.notes ? <p className="alert small">„{sel.notes}”</p> : null}
            <div className="row">
              {sel.status !== 'accepted' ? <button className="btn btn-sm" style={{ '--bg': 'var(--mint-ink)' } as React.CSSProperties} onClick={() => setStatus(sel, 'accepted')}>Potwierdź</button> : null}
              {sel.status === 'pending' ? <button className="btn btn-ghost btn-sm" onClick={() => setStatus(sel, 'rejected')}>Odrzuć</button> : null}
              {sel.status === 'accepted' ? <button className="btn btn-ghost btn-sm" onClick={() => setStatus(sel, 'completed')}>Przyszli ✓</button> : null}
              {sel.status === 'accepted' ? <button className="btn btn-ghost btn-sm" onClick={() => setStatus(sel, 'no_show')}>Nie przyszli</button> : null}
              {['pending', 'accepted'].includes(sel.status) ? <button className="btn btn-ghost btn-sm" onClick={() => setStatus(sel, 'cancelled')}>Odwołaj</button> : null}
              <button
                className="btn btn-ghost btn-sm"
                style={{ color: 'var(--danger)' }}
                onClick={() =>
                  confirm('Usunąć rezerwację?') &&
                  run(async () => {
                    await api(`/api/admin/reservations/${sel._id}`, { method: 'DELETE' });
                    setSel(null);
                    reload();
                  }, 'Usunięto.')
                }
              >
                Usuń
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      {adding ? <AddReservation zones={zones} date={date} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); reload(); }} /> : null}
    </>
  );
}

function AddReservation({ zones, date, onClose, onSaved }: { zones: { key: string; name: string }[]; date: string; onClose: () => void; onSaved: () => void }) {
  const { location } = useAdmin();
  const [f, setF] = useState({ date, time: '18:00', guests: 2, zone: zones[0]?.key || 'sala', name: '', phone: '', notes: '' });
  const { busy, run } = useRun();
  return (
    <Modal
      open
      onClose={onClose}
      title="Nowa rezerwacja (telefoniczna)"
      footer={
        <button
          className="btn btn-accent w-full"
          disabled={busy || f.name.length < 2}
          onClick={async () => {
            const ok = await run(() => api('/api/admin/reservations', { body: { ...f, location } }), 'Dodano rezerwację.');
            if (ok) onSaved();
          }}
        >
          Zapisz
        </button>
      }
    >
      <div className="grid grid-2" style={{ '--gap': '12px' } as React.CSSProperties}>
        <label className="field">
          <span className="label">Data</span>
          <input className="input" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
        </label>
        <label className="field">
          <span className="label">Godzina</span>
          <input className="input" type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} />
        </label>
        <label className="field">
          <span className="label">Osoby</span>
          <input className="input" type="number" min={1} value={f.guests} onChange={(e) => setF({ ...f, guests: Number(e.target.value) })} />
        </label>
        <label className="field">
          <span className="label">Strefa</span>
          <select className="select" value={f.zone} onChange={(e) => setF({ ...f, zone: e.target.value })}>
            {zones.map((z) => (
              <option key={z.key} value={z.key}>
                {z.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="label">Imię i nazwisko</span>
          <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </label>
        <label className="field">
          <span className="label">Telefon</span>
          <input className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        </label>
        <label className="field" style={{ gridColumn: '1 / -1' }}>
          <span className="label">Uwagi</span>
          <input className="input" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </label>
      </div>
    </Modal>
  );
}

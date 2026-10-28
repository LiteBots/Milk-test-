'use client';

import { useMemo, useState } from 'react';
import { api } from '@/lib/client';
import { addDays, localParts, WEEK_LABELS, weekdayOf } from '@/lib/hours';
import { formatPLN } from '@/lib/util';
import { Kpi, PageHead, fmtDate, useData, useRun } from './ui';
import { useAdmin } from './AdminContext';
import { EmployeesSection } from './sections/Simple';
import { can } from '@/lib/permissions';
import { Icon } from '../Icon';

interface Shift {
  _id: string;
  employeeId: string;
  date: string;
  from: string;
  to: string;
  note?: string;
}
interface Emp {
  _id: string;
  name: string;
  position: string;
}

function monday(date: string) {
  const i = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].indexOf(weekdayOf(date));
  return addDays(date, -i);
}

export function TeamPage() {
  const [tab, setTab] = useState<'grafik' | 'czas' | 'ludzie'>('grafik');
  return (
    <>
      <div className="tabs">
        <button aria-selected={tab === 'grafik'} onClick={() => setTab('grafik')}>
          Grafik
        </button>
        <button aria-selected={tab === 'czas'} onClick={() => setTab('czas')}>
          Czas pracy i koszty
        </button>
        <button aria-selected={tab === 'ludzie'} onClick={() => setTab('ludzie')}>
          Pracownicy
        </button>
      </div>
      {tab === 'grafik' ? <Schedule /> : tab === 'czas' ? <TimeSheet /> : <EmployeesSection />}
    </>
  );
}

function Schedule() {
  const { location, session } = useAdmin();
  const [start, setStart] = useState(monday(localParts().date));
  const end = addDays(start, 6);
  const { data, reload } = useData<{ shifts: Shift[]; employees: Emp[] }>(`/api/admin/team/shifts?from=${start}&to=${end}&location=${location}`, [start, location]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(start, i)), [start]);
  const [add, setAdd] = useState<{ employeeId: string; date: string; from: string; to: string } | null>(null);
  const { busy, run } = useRun();
  const editable = can(session, 'team');
  const hours = (s: Shift) => {
    const [a, b] = [s.from, s.to].map((t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3)));
    return Math.max(0, (b - a) / 60);
  };
  return (
    <>
      <PageHead
        title="Grafik"
        sub={`${start} – ${end}`}
        actions={
          <>
            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setStart(addDays(start, -7))} aria-label="Poprzedni tydzień">
              <Icon name="chevron-left" size={16} />
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setStart(monday(localParts().date))}>
              Ten tydzień
            </button>
            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setStart(addDays(start, 7))} aria-label="Następny tydzień">
              <Icon name="chevron-right" size={16} />
            </button>
            <button className="btn btn-ghost btn-sm no-print" onClick={() => window.print()}>
              Drukuj
            </button>
          </>
        }
      />
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Pracownik</th>
              {days.map((d) => (
                <th key={d}>
                  {WEEK_LABELS[weekdayOf(d)].slice(0, 3)} {d.slice(8)}
                </th>
              ))}
              <th className="num">Godz.</th>
            </tr>
          </thead>
          <tbody>
            {(data?.employees || []).map((e) => {
              const mine = (data?.shifts || []).filter((s) => s.employeeId === e._id);
              return (
                <tr key={e._id}>
                  <td>
                    <strong>{e.name}</strong>
                    <div className="tiny muted">{e.position}</div>
                  </td>
                  {days.map((d) => (
                    <td key={d} style={{ verticalAlign: 'top' }}>
                      {mine
                        .filter((s) => s.date === d)
                        .map((s) => (
                          <div key={s._id} className="cal-item" style={{ cursor: editable ? 'pointer' : 'default' }} onClick={() => editable && confirm(`Usunąć zmianę ${s.from}–${s.to}?`) && run(async () => { await api('/api/admin/team/shifts', { method: 'DELETE', body: { id: s._id } }); reload(); })}>
                            {s.from}–{s.to}
                          </div>
                        ))}
                      {editable ? (
                        <button className="btn btn-ghost btn-sm no-print" style={{ minHeight: 26, padding: '0 8px' }} onClick={() => setAdd({ employeeId: e._id, date: d, from: '10:00', to: '18:00' })} aria-label="Dodaj zmianę">
                          +
                        </button>
                      ) : null}
                    </td>
                  ))}
                  <td className="num">{mine.reduce((s, x) => s + hours(x), 0).toFixed(1)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {data && !data.employees.length ? <p className="small muted mt-2">Dodaj pracowników w zakładce „Pracownicy”.</p> : null}
      {add ? (
        <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && setAdd(null)}>
          <div className="sheet">
            <div className="sheet-head">
              <strong>
                Zmiana: {data?.employees.find((x) => x._id === add.employeeId)?.name} · {add.date}
              </strong>
            </div>
            <div className="sheet-body row">
              <input className="input" type="time" value={add.from} onChange={(e) => setAdd({ ...add, from: e.target.value })} style={{ width: 130 }} />
              –
              <input className="input" type="time" value={add.to} onChange={(e) => setAdd({ ...add, to: e.target.value })} style={{ width: 130 }} />
              <button
                className="btn btn-accent"
                disabled={busy}
                onClick={async () => {
                  const ok = await run(() => api('/api/admin/team/shifts', { body: { ...add, location } }), 'Dodano zmianę.');
                  if (ok) {
                    setAdd(null);
                    reload();
                  }
                }}
              >
                Zapisz
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

interface TimeData {
  entries: { _id: string; employeeId: string; clockIn: string; clockOut: string | null; minutes: number | null; edited?: boolean }[];
  summary: { id: string; name: string; position: string; hourlyRate: number; minutes: number; cost: number; open: boolean }[];
  totalCost: number;
  totalMinutes: number;
}

function TimeSheet() {
  const [month, setMonth] = useState(localParts().date.slice(0, 7));
  const { data, reload } = useData<TimeData>(`/api/admin/team/time?month=${month}`, [month]);
  const { run } = useRun();
  const names = Object.fromEntries((data?.summary || []).map((s) => [s.id, s.name]));
  const hm = (m: number) => `${Math.floor(m / 60)} h ${m % 60} min`;
  return (
    <>
      <PageHead title="Czas pracy i koszty" actions={<input className="input" type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={{ minHeight: 36 }} />} />
      <div className="kpi-grid mb-3">
        <Kpi label="Przepracowane" value={hm(data?.totalMinutes || 0)} />
        <Kpi label="Koszt wynagrodzeń" value={formatPLN(data?.totalCost || 0)} hint="wg stawek godzinowych" />
      </div>
      <div className="table-wrap mb-3">
        <table className="table">
          <thead>
            <tr>
              <th>Pracownik</th>
              <th className="num">Czas</th>
              <th className="num">Stawka</th>
              <th className="num">Koszt</th>
            </tr>
          </thead>
          <tbody>
            {(data?.summary || []).map((s) => (
              <tr key={s.id}>
                <td>
                  {s.name} {s.open ? <span className="badge badge-mint">w pracy</span> : null}
                </td>
                <td className="num">{hm(s.minutes)}</td>
                <td className="num">{formatPLN(s.hourlyRate)}</td>
                <td className="num">{formatPLN(s.cost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2 className="h3 mb-2">Wpisy</h2>
      <div className="table-wrap">
        <table className="table">
          <tbody>
            {(data?.entries || []).map((t) => (
              <tr key={t._id}>
                <td>{names[t.employeeId] || '—'}</td>
                <td>{fmtDate(t.clockIn)}</td>
                <td>{t.clockOut ? fmtDate(t.clockOut) : <span className="badge badge-mint">w pracy</span>}</td>
                <td className="num">{t.minutes != null ? hm(t.minutes) : '—'}</td>
                <td>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      const ci = prompt('Wejście (RRRR-MM-DD GG:MM)', new Date(t.clockIn).toLocaleString('sv-SE').slice(0, 16));
                      if (!ci) return;
                      const co = prompt('Wyjście (RRRR-MM-DD GG:MM, puste = w pracy)', t.clockOut ? new Date(t.clockOut).toLocaleString('sv-SE').slice(0, 16) : '');
                      run(async () => {
                        await api('/api/admin/team/time', { method: 'PATCH', body: { id: t._id, clockIn: new Date(ci.replace(' ', 'T')).toISOString(), clockOut: co ? new Date(co.replace(' ', 'T')).toISOString() : null } });
                        reload();
                      }, 'Poprawiono wpis.');
                    }}
                  >
                    Popraw{t.edited ? ' (edytowany)' : ''}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// Ekran na tablet w lokalu: duża klawiatura PIN, wejście/wyjście
export function TimeClock() {
  const { location } = useAdmin();
  const [pin, setPin] = useState('');
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(p: string) {
    setBusy(true);
    try {
      const r = await api<{ message: string }>('/api/admin/timeclock', { body: { pin: p, location } });
      setMsg({ text: r.message, ok: true });
    } catch (e) {
      setMsg({ text: (e as Error).message, ok: false });
    } finally {
      setPin('');
      setBusy(false);
      setTimeout(() => setMsg(null), 5000);
    }
  }
  const press = (d: string) => {
    const next = (pin + d).slice(0, 6);
    setPin(next);
  };
  return (
    <div className="center" style={{ maxWidth: 360, margin: '0 auto' }}>
      <h1 className="admin-title mb-2">Czas pracy</h1>
      <p className="muted small">Wpisz swój PIN, aby odbić wejście lub wyjście.</p>
      <div className="card" style={{ fontSize: '2rem', letterSpacing: '.5em', minHeight: 64 }}>{pin.replace(/./g, '•') || ' '}</div>
      {msg ? <p className={`alert ${msg.ok ? 'alert-success' : 'alert-error'} mt-2`}>{msg.text}</p> : null}
      <div className="grid grid-3 mt-2" style={{ '--gap': '10px' } as React.CSSProperties}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'OK'].map((k) => (
          <button
            key={k}
            className={`btn btn-lg ${k === 'OK' ? 'btn-accent' : 'btn-soft'}`}
            style={{ minHeight: 72, fontSize: '1.4rem' }}
            disabled={busy || (k === 'OK' && pin.length < 4)}
            onClick={() => (k === 'C' ? setPin('') : k === 'OK' ? submit(pin) : press(k))}
          >
            {k}
          </button>
        ))}
      </div>
    </div>
  );
}

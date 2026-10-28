'use client';

import { useMemo, useState } from 'react';
import { addDays, localParts } from '@/lib/hours';
import { formatPLN, PAYMENT_LABELS, LOCATION_NAMES } from '@/lib/util';
import { Kpi, PageHead, useData, fmtDate } from './ui';
import { useAdmin } from './AdminContext';
import { Icon } from '../Icon';

interface Report {
  from: string;
  to: string;
  totals: { revenue: number; orders: number; avg: number; discounts: number; wallet: number; cancelled: number };
  daily: { date: string; revenue: number; orders: number }[];
  byPayment: { _id: string; revenue: number; orders: number }[];
  bySource: { _id: string; revenue: number; orders: number }[];
  byLocation: { _id: string; revenue: number; orders: number }[];
  hourly: { _id: { d: number; h: number }; n: number }[];
  topProducts: { _id: string; name: string; qty: number; revenue: number }[];
  rating: { avg: number | null; n: number };
  newCustomers: number;
  topups: { amount: number; bonus: number; n: number };
  pointsAwarded: number;
}

const DAYS = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'];

export function Reports() {
  const { locations } = useAdmin();
  const today = localParts().date;
  const [range, setRange] = useState({ from: addDays(today, -29), to: today });
  const [loc, setLoc] = useState('all');
  const qs = useMemo(() => new URLSearchParams({ ...range, location: loc }).toString(), [range, loc]);
  const { data, error } = useData<Report>(`/api/admin/reports?${qs}`, [qs]);
  const presets: [string, number][] = [
    ['7 dni', 6],
    ['30 dni', 29],
    ['90 dni', 89],
    ['Rok', 364]
  ];
  const max = data ? Math.max(1, ...data.daily.map((d) => d.revenue)) : 1;
  const heat = useMemo(() => {
    const m: Record<string, number> = {};
    let top = 1;
    data?.hourly.forEach((h) => {
      m[`${h._id.d}-${h._id.h}`] = h.n;
      top = Math.max(top, h.n);
    });
    return { m, top };
  }, [data]);
  const hours = Array.from({ length: 14 }, (_, i) => i + 9);

  return (
    <>
      <PageHead
        title="Raporty sprzedaży"
        sub="Kwoty brutto z zamówień online (strona + aplikacja), bez anulowanych i nieopłaconych."
        actions={
          <>
            <a className="btn btn-ghost btn-sm" href={`/api/admin/reports?${qs}&format=csv`}>
              <Icon name="download" size={14} /> CSV
            </a>
            <a className="btn btn-ghost btn-sm" href={`/api/admin/orders?from=${range.from}&to=${range.to}&location=${loc}&format=csv`}>
              Zamówienia CSV (księgowość)
            </a>
            <button className="btn btn-ghost btn-sm" onClick={() => window.print()}>
              PDF / drukuj
            </button>
          </>
        }
      />
      <div className="toolbar no-print">
        {presets.map(([l, d]) => (
          <button key={l} className="chip" aria-pressed={range.from === addDays(today, -d) && range.to === today} onClick={() => setRange({ from: addDays(today, -d), to: today })}>
            {l}
          </button>
        ))}
        <input className="input" type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
        <input className="input" type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
        <select className="select" value={loc} onChange={(e) => setLoc(e.target.value)}>
          <option value="all">Wszystkie lokale</option>
          {locations.map((l) => (
            <option key={l.slug} value={l.slug}>
              {l.city}
            </option>
          ))}
        </select>
      </div>
      {error ? <p className="alert alert-error">{error}</p> : null}
      {!data ? (
        <div className="skeleton" style={{ height: 300 }} />
      ) : (
        <>
          <div className="kpi-grid mb-3">
            <Kpi label="Przychód" value={formatPLN(data.totals.revenue)} />
            <Kpi label="Zamówienia" value={data.totals.orders} hint={`anulowane: ${data.totals.cancelled}`} />
            <Kpi label="Średni koszyk" value={formatPLN(data.totals.avg)} />
            <Kpi label="Rabaty" value={formatPLN(data.totals.discounts)} />
            <Kpi label="Opłacone portfelem" value={formatPLN(data.totals.wallet)} />
            <Kpi label="Nowi klienci" value={data.newCustomers} />
            <Kpi label="Doładowania portfela" value={formatPLN(data.topups.amount)} hint={`${data.topups.n} szt. · bonus ${formatPLN(data.topups.bonus)}`} />
            <Kpi label="Średnia ocena" value={data.rating.avg ? data.rating.avg.toFixed(2) : '—'} hint={`${data.rating.n} ocen`} />
          </div>

          <div className="chart-box mb-3">
            <strong>Przychód dzienny</strong>
            <div className="bars mt-2" style={{ height: 200 }} role="img" aria-label="Przychód dzienny">
              {data.daily.map((d) => (
                <div key={d.date} style={{ height: `${(d.revenue / max) * 100}%` }} title={`${d.date}: ${formatPLN(d.revenue)} · ${d.orders} zam.`} />
              ))}
            </div>
            <div className="row between tiny muted mt-1">
              <span>{data.from}</span>
              <span>{data.to}</span>
            </div>
          </div>

          <div className="grid grid-2 mb-3">
            <div className="chart-box">
              <strong>Godziny szczytu (liczba zamówień)</strong>
              <div style={{ overflowX: 'auto' }}>
                <table className="table mt-2" style={{ fontSize: '.75rem' }}>
                  <thead>
                    <tr>
                      <th />
                      {hours.map((h) => (
                        <th key={h} style={{ padding: 4, textAlign: 'center' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {DAYS.map((d, i) => (
                      <tr key={d}>
                        <td style={{ padding: 4 }}>{d}</td>
                        {hours.map((h) => {
                          const v = heat.m[`${i + 1}-${h}`] || 0;
                          return (
                            <td key={h} title={`${d} ${h}:00 – ${v}`} style={{ padding: 0, height: 26, background: v ? `rgba(255,102,0,${0.12 + (v / heat.top) * 0.88})` : 'transparent', textAlign: 'center', color: v / heat.top > 0.6 ? '#fff' : 'var(--ink-3)' }}>
                              {v || ''}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="chart-box">
              <strong>Struktura sprzedaży</strong>
              <table className="table mt-2">
                <tbody>
                  {data.bySource.map((s) => (
                    <tr key={`s-${s._id}`}>
                      <td>{s._id === 'app' ? 'Aplikacja MilkMi' : s._id === 'kiosk' ? 'Kiosk' : 'Strona'}</td>
                      <td className="num">{s.orders}</td>
                      <td className="num">{formatPLN(s.revenue)}</td>
                    </tr>
                  ))}
                  {data.byPayment.map((s) => (
                    <tr key={`p-${s._id}`}>
                      <td className="muted">{PAYMENT_LABELS[s._id] || s._id}</td>
                      <td className="num">{s.orders}</td>
                      <td className="num">{formatPLN(s.revenue)}</td>
                    </tr>
                  ))}
                  {data.byLocation.length > 1
                    ? data.byLocation.map((s) => (
                        <tr key={`l-${s._id}`}>
                          <td>{LOCATION_NAMES[s._id] || s._id}</td>
                          <td className="num">{s.orders}</td>
                          <td className="num">{formatPLN(s.revenue)}</td>
                        </tr>
                      ))
                    : null}
                </tbody>
              </table>
              <p className="tiny muted">Punkty przyznane w okresie: {data.pointsAwarded}</p>
            </div>
          </div>

          <div className="chart-box">
            <strong>Najlepiej sprzedające się produkty</strong>
            <table className="table mt-2">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Produkt</th>
                  <th className="num">Sztuk</th>
                  <th className="num">Przychód</th>
                </tr>
              </thead>
              <tbody>
                {data.topProducts.map((p, i) => (
                  <tr key={p._id || i}>
                    <td>{i + 1}</td>
                    <td>{p.name}</td>
                    <td className="num">{p.qty}</td>
                    <td className="num">{formatPLN(p.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="tiny muted mt-2">Wygenerowano {fmtDate(new Date())}</p>
        </>
      )}
    </>
  );
}

interface Review {
  _id: string;
  orderNumber: string;
  rating: number;
  ratingComment?: string;
  customerName: string;
  customerPhone: string;
  location: string;
  createdAt: string;
  items: { name: string; quantity: number }[];
}

export function Reviews() {
  const { location } = useAdmin();
  const [onlyLow, setOnlyLow] = useState(false);
  const { data } = useData<{ items: Review[]; stats: { _id: number; n: number }[] }>(`/api/admin/reviews?location=${location}`, [location]);
  const total = (data?.stats || []).reduce((s, x) => s + x.n, 0);
  const avg = total ? (data!.stats.reduce((s, x) => s + x._id * x.n, 0) / total).toFixed(2) : '—';
  const items = (data?.items || []).filter((r) => !onlyLow || r.rating <= 3);
  return (
    <>
      <PageHead title="Opinie z zamówień" sub="Klienci oceniają zamówienie po odbiorze. Ocena 1–2 wysyła powiadomienie do obsługi." />
      <div className="kpi-grid mb-3">
        <Kpi label="Średnia" value={avg} hint={`${total} ocen`} />
        {[5, 4, 3, 2, 1].map((n) => (
          <Kpi key={n} label={'★'.repeat(n)} value={data?.stats.find((s) => s._id === n)?.n || 0} />
        ))}
      </div>
      <label className="check mb-2">
        <input type="checkbox" checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} /> <span>Tylko oceny 1–3</span>
      </label>
      <div className="stack" style={{ '--gap': '10px' } as React.CSSProperties}>
        {items.map((r) => (
          <div key={r._id} className="card card-sm" style={r.rating <= 2 ? { borderColor: 'var(--danger)' } : undefined}>
            <div className="row between">
              <span>
                <span className="stars">{'★'.repeat(r.rating)}</span>
                <span className="muted">{'★'.repeat(5 - r.rating)}</span> · <strong>{r.orderNumber}</strong> · {r.customerName}
              </span>
              <span className="tiny muted">{fmtDate(r.createdAt)}</span>
            </div>
            {r.ratingComment ? <p style={{ margin: '6px 0' }}>„{r.ratingComment}”</p> : null}
            <div className="tiny muted">
              {r.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')} · <a className="link" href={`tel:${r.customerPhone}`}>{r.customerPhone}</a>
            </div>
          </div>
        ))}
        {data && !items.length ? <p className="empty card">Brak opinii.</p> : null}
      </div>
    </>
  );
}

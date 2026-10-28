'use client';

import Link from 'next/link';
import { useAdmin } from './AdminContext';
import { Kpi, PageHead, useData } from './ui';
import { formatPLN } from '@/lib/util';
import { Icon } from '../Icon';
import { PushToggle } from '../app/PushToggle';

interface Stats {
  today: { revenue?: number; orders: number; avg?: number; cancelled?: number };
  lastWeek: { revenue?: number; orders: number; avg?: number };
  daily: { date: string; revenue: number; orders: number }[];
  topProducts: { _id: string; name: string; qty: number; revenue: number }[];
  reservations: { _id: string; name: string; datetime: string; guests: number; status: string; zone: string }[];
  lowStock: { _id: string; name: string; quantity: number; unit: string }[];
  lowRatings: { _id: string; orderNumber: string; rating: number; ratingComment?: string; customerName: string }[];
  newUsers: number;
  showMoney: boolean;
}

const pct = (a?: number, b?: number) => (a != null && b ? ((a - b) / b) * 100 : null);

export function Dashboard() {
  const { location, live, session } = useAdmin();
  const { data, error } = useData<Stats>(`/api/admin/stats?location=${location}`, [live?.latestOrder?.id]);
  if (error) return <p className="alert alert-error">{error}</p>;
  const d = data;
  const max = d ? Math.max(1, ...d.daily.map((x) => (d.showMoney ? x.revenue : x.orders))) : 1;

  return (
    <>
      <PageHead
        title={`Dzień dobry, ${session.name.split(' ')[0]}`}
        sub={new Date().toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })}
        actions={
          <>
            <PushToggle audience="staff" compact />
            <Link href="/admin/zamowienia" className="btn btn-accent btn-sm">
              <Icon name="bag" size={16} /> Zamówienia {live?.pendingOrders ? `(${live.pendingOrders})` : ''}
            </Link>
          </>
        }
      />
      <div className="kpi-grid mb-3">
        {d?.showMoney ? <Kpi label="Przychód dziś" value={formatPLN(d.today.revenue || 0)} delta={pct(d.today.revenue, d.lastWeek.revenue)} hint="vs tydzień temu" /> : null}
        <Kpi label="Zamówienia dziś" value={d ? d.today.orders : '…'} delta={d ? pct(d.today.orders, d.lastWeek.orders) : null} hint="vs tydzień temu" />
        {d?.showMoney ? <Kpi label="Średni koszyk" value={formatPLN(d.today.avg || 0)} /> : null}
        <Kpi label="W realizacji" value={live?.activeOrders ?? '…'} hint={live?.pendingOrders ? `${live.pendingOrders} nowych` : 'brak nowych'} />
        <Kpi label="Nowi klienci (7 dni)" value={d?.newUsers ?? '…'} />
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr)', gap: 16 } as React.CSSProperties}>
        <div className="chart-box">
          <div className="row between mb-2">
            <strong>{d?.showMoney ? 'Przychód' : 'Zamówienia'} – ostatnie 14 dni</strong>
            {d?.showMoney ? <Link href="/admin/raporty" className="link small">Raporty</Link> : null}
          </div>
          <div className="bars" role="img" aria-label="Wykres sprzedaży z 14 dni">
            {(d?.daily || []).map((x) => {
              const v = d!.showMoney ? x.revenue : x.orders;
              return <div key={x.date} style={{ height: `${(v / max) * 100}%` }} title={`${x.date}: ${d!.showMoney ? formatPLN(x.revenue) : ''} · ${x.orders} zam.`} />;
            })}
          </div>
          <div className="row between tiny muted mt-1">
            <span>{d?.daily[0]?.date.slice(5)}</span>
            <span>dziś</span>
          </div>
        </div>
        <div className="chart-box">
          <strong>Najczęściej zamawiane (14 dni)</strong>
          <ol className="small" style={{ paddingLeft: 18, margin: '10px 0 0' }}>
            {(d?.topProducts || []).map((p) => (
              <li key={p._id} style={{ padding: '4px 0' }}>
                {p.name} <span className="muted">· {p.qty} szt.</span>
              </li>
            ))}
          </ol>
          {d && !d.topProducts.length ? <p className="small muted">Brak danych.</p> : null}
        </div>
      </div>

      <div className="grid grid-3 mt-3">
        <div className="card card-sm">
          <div className="row between mb-2">
            <strong>Rezerwacje dziś</strong>
            <Link href="/admin/rezerwacje" className="link small">Wszystkie</Link>
          </div>
          {(d?.reservations || []).map((r) => (
            <div key={r._id} className="list-link small" style={{ padding: '8px 0' }}>
              <span>
                <strong>{r.datetime.slice(11)}</strong> {r.name} · {r.guests} os.
              </span>
              <span className={`badge ${r.status === 'pending' ? 'badge-amber' : 'badge-mint'}`}>{r.status === 'pending' ? 'do potwierdzenia' : 'potwierdzona'}</span>
            </div>
          ))}
          {d && !d.reservations.length ? <p className="small muted">Brak rezerwacji na dziś.</p> : null}
        </div>
        <div className="card card-sm">
          <div className="row between mb-2">
            <strong>Niskie oceny</strong>
            <Link href="/admin/opinie" className="link small">Opinie</Link>
          </div>
          {(d?.lowRatings || []).map((r) => (
            <div key={r._id} className="small" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
              <strong>{'★'.repeat(r.rating)}</strong> {r.orderNumber} · {r.customerName}
              {r.ratingComment ? <div className="muted">„{r.ratingComment}”</div> : null}
            </div>
          ))}
          {d && !d.lowRatings.length ? <p className="small muted">Brak niskich ocen. 👍</p> : null}
        </div>
        <div className="card card-sm">
          <div className="row between mb-2">
            <strong>Niski stan magazynu</strong>
            <Link href="/admin/magazyn" className="link small">Magazyn</Link>
          </div>
          {(d?.lowStock || []).map((i) => (
            <div key={i._id} className="list-link small" style={{ padding: '6px 0' }}>
              <span>{i.name}</span>
              <span className="badge badge-danger">
                {i.quantity} {i.unit}
              </span>
            </div>
          ))}
          {d && !d.lowStock.length ? <p className="small muted">Wszystko na stanie.</p> : null}
        </div>
      </div>
    </>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/client';
import { formatPLN, STATUS_LABELS } from '@/lib/util';
import { Kpi, PageHead, TagsInput, fmtDate, useData, useRun } from './ui';
import { useAdmin } from './AdminContext';
import { can } from '@/lib/permissions';
import { Icon } from '../Icon';

interface Row {
  id: string;
  name: string;
  email: string;
  phone: string;
  points: number;
  walletBalance: number;
  tier: string;
  lifetimeSpent: number;
  lastOrderAt: string | null;
  createdAt: string;
  tags: string[];
}

export function CustomersList() {
  const { session } = useAdmin();
  const [q, setQ] = useState('');
  const [segment, setSegment] = useState('all');
  const [sort, setSort] = useState('createdAt');
  const [skip, setSkip] = useState(0);
  const qs = useMemo(() => new URLSearchParams({ q, segment, sort, skip: String(skip), limit: '50' }).toString(), [q, segment, sort, skip]);
  const { data } = useData<{ items: Row[]; total: number; stats: { users: number; points: number; wallet: number; redeemed: number }; segments: Record<string, string> }>(`/api/admin/customers?${qs}`, [qs]);
  useEffect(() => setSkip(0), [q, segment, sort]);

  return (
    <>
      <PageHead
        title="Baza klientów"
        sub="Klienci aplikacji MilkMi i dawnej aplikacji Milk."
        actions={
          can(session, 'customersEdit') ? (
            <a className="btn btn-ghost btn-sm" href={`/api/admin/customers/export?segment=${segment}&q=${encodeURIComponent(q)}`}>
              <Icon name="download" size={14} /> Eksport CSV
            </a>
          ) : null
        }
      />
      {data ? (
        <div className="kpi-grid mb-3">
          <Kpi label="Klienci" value={data.stats.users} />
          <Kpi label="Punkty w obiegu" value={data.stats.points} />
          <Kpi label="Wymienione punkty" value={data.stats.redeemed} />
          <Kpi label="Środki w portfelach" value={formatPLN(data.stats.wallet)} />
        </div>
      ) : null}
      <div className="toolbar">
        <input className="input" placeholder="Imię, e-mail, telefon" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 280 }} />
        <select className="select" value={segment} onChange={(e) => setSegment(e.target.value)}>
          {Object.entries(data?.segments || { all: 'Wszyscy' }).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select className="select" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="createdAt">Najnowsi</option>
          <option value="spent">Najwięcej wydali</option>
          <option value="points">Najwięcej punktów</option>
          <option value="last">Ostatnio zamawiali</option>
        </select>
        <span className="small muted">{data?.total ?? '…'} osób</span>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Klient</th>
              <th>Telefon</th>
              <th>Poziom</th>
              <th className="num">Punkty</th>
              <th className="num">Portfel</th>
              <th className="num">Wydane</th>
              <th>Ostatnio</th>
            </tr>
          </thead>
          <tbody>
            {(data?.items || []).map((c) => (
              <tr key={c.id} className="clickable" onClick={() => (window.location.href = `/admin/klienci/${c.id}`)}>
                <td>
                  <Link href={`/admin/klienci/${c.id}`}>
                    <strong>{c.name}</strong>
                  </Link>
                  <div className="tiny muted">{c.email}</div>
                  {c.tags.length ? (
                    <div className="row" style={{ '--gap': '4px', marginTop: 4 } as React.CSSProperties}>
                      {c.tags.map((t) => (
                        <span key={t} className="badge">{t}</span>
                      ))}
                    </div>
                  ) : null}
                </td>
                <td>{c.phone}</td>
                <td style={{ textTransform: 'capitalize' }}>{c.tier}</td>
                <td className="num">{c.points}</td>
                <td className="num">{formatPLN(c.walletBalance)}</td>
                <td className="num">{formatPLN(c.lifetimeSpent)}</td>
                <td>{c.lastOrderAt ? fmtDate(c.lastOrderAt, false) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="row mt-2">
        <button className="btn btn-ghost btn-sm" disabled={skip === 0} onClick={() => setSkip(Math.max(0, skip - 50))}>
          ← Poprzednia
        </button>
        <button className="btn btn-ghost btn-sm" disabled={!data || skip + 50 >= data.total} onClick={() => setSkip(skip + 50)}>
          Następna →
        </button>
      </div>
    </>
  );
}

interface Detail {
  customer: Row & {
    adminNotes: string;
    tags: string[];
    stamps: number;
    stampRewardsAvailable: number;
    birthday: string;
    marketingConsent: boolean;
    smsConsent: boolean;
    referralCode?: string;
    history: { text: string; date: string }[];
    rewards: { code: string; name: string }[];
  };
  orders: { _id: string; orderNumber: string; createdAt: string; totalAmount: number; status: string; source: string; location: string }[];
  reservations: { _id: string; datetime: string; guests: number; status: string }[];
  points: { _id: string; date: string; pointsAwarded: number; reason?: string; staffName?: string }[];
  wallet: { _id: string; date: string; amount: number; action: string; reason?: string; staffName?: string }[];
  coupons: { _id: string; code: string; name: string; usedCount: number; maxUses: number | null; validTo: string | null }[];
  stats: { n: number; total: number; avg: number };
}

export function CustomerDetail({ id }: { id: string }) {
  const { session } = useAdmin();
  const { data, reload } = useData<Detail>(`/api/admin/customers/${id}`, [id]);
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tab, setTab] = useState<'orders' | 'points' | 'wallet' | 'history'>('orders');
  const { busy, run } = useRun();
  const editable = can(session, 'customersEdit');
  useEffect(() => {
    if (data) {
      setNotes(data.customer.adminNotes);
      setTags(data.customer.tags);
    }
  }, [data]);
  if (!data) return <div className="skeleton" style={{ height: 300 }} />;
  const c = data.customer;
  return (
    <>
      <PageHead
        title={c.name}
        sub={
          <>
            {c.email} · <a className="link" href={`tel:${c.phone}`}>{c.phone}</a> · klient od {fmtDate(c.createdAt, false)}
            {c.birthday ? ` · urodziny ${c.birthday.split('-').reverse().join('.')}` : ''}
          </>
        }
        actions={
          <Link href="/admin/kasa" className="btn btn-ghost btn-sm">
            Kasa
          </Link>
        }
      />
      <div className="kpi-grid mb-3">
        <Kpi label="Punkty" value={c.points} />
        <Kpi label="Portfel" value={formatPLN(c.walletBalance)} />
        <Kpi label="Poziom" value={<span style={{ textTransform: 'capitalize' }}>{c.tier}</span>} />
        <Kpi label="Zamówienia (wydane)" value={data.stats.n} hint={`śr. ${formatPLN(data.stats.avg || 0)}`} />
        <Kpi label="Wydane łącznie" value={formatPLN(c.lifetimeSpent || 0)} />
        <Kpi label="Pieczątki" value={`${c.stamps}`} hint={c.stampRewardsAvailable ? `${c.stampRewardsAvailable} darmowych shake’ów` : undefined} />
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr)', gap: 16 } as React.CSSProperties}>
        <div className="card">
          <div className="tabs">
            {(
              [
                ['orders', `Zamówienia (${data.orders.length})`],
                ['points', 'Punkty'],
                ['wallet', 'Portfel'],
                ['history', 'Historia konta']
              ] as const
            ).map(([k, l]) => (
              <button key={k} aria-selected={tab === k} onClick={() => setTab(k)}>
                {l}
              </button>
            ))}
          </div>
          {tab === 'orders' ? (
            <table className="table">
              <tbody>
                {data.orders.map((o) => (
                  <tr key={o._id}>
                    <td>
                      <strong>{o.orderNumber}</strong> <span className="badge">{o.source === 'app' ? 'App' : 'Strona'}</span>
                    </td>
                    <td>{fmtDate(o.createdAt)}</td>
                    <td>{STATUS_LABELS[o.status] || o.status}</td>
                    <td className="num">{formatPLN(o.totalAmount)}</td>
                  </tr>
                ))}
                {!data.orders.length ? (
                  <tr>
                    <td className="muted">Brak zamówień online.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          ) : tab === 'points' ? (
            <table className="table">
              <tbody>
                {data.points.map((p) => (
                  <tr key={p._id}>
                    <td>{fmtDate(p.date)}</td>
                    <td>{p.reason}</td>
                    <td className="tiny muted">{p.staffName}</td>
                    <td className="num" style={{ color: p.pointsAwarded < 0 ? 'var(--danger)' : 'var(--mint-ink)' }}>
                      {p.pointsAwarded > 0 ? '+' : ''}
                      {p.pointsAwarded}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : tab === 'wallet' ? (
            <table className="table">
              <tbody>
                {data.wallet.map((w) => (
                  <tr key={w._id}>
                    <td>{fmtDate(w.date)}</td>
                    <td>{w.reason}</td>
                    <td className="tiny muted">{w.staffName}</td>
                    <td className="num" style={{ color: w.action === 'remove' ? 'var(--danger)' : 'var(--mint-ink)' }}>
                      {w.action === 'remove' ? '−' : '+'}
                      {formatPLN(w.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div>
              {c.history.map((h, i) => (
                <div key={i} className="list-link small">
                  <span>{h.text}</span>
                  <span className="tiny muted">{h.date}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="stack">
          <div className="card stack">
            <strong>Notatki i tagi</strong>
            <textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!editable} placeholder="np. alergia na orzechy, stały gość w piątki" />
            <TagsInput value={tags} onChange={setTags} placeholder="Tag (Enter)" />
            {editable ? (
              <button
                className="btn btn-soft btn-sm"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await api(`/api/admin/customers/${id}`, { method: 'PATCH', body: { adminNotes: notes, tags } });
                    reload();
                  }, 'Zapisano.')
                }
              >
                Zapisz
              </button>
            ) : null}
          </div>
          <div className="card stack small">
            <strong>Zgody</strong>
            <span>Marketing: {c.marketingConsent ? 'tak' : 'nie'} · SMS: {c.smsConsent ? 'tak' : 'nie'}</span>
            {c.referralCode ? <span>Kod polecający: {c.referralCode}</span> : null}
          </div>
          {data.coupons.length ? (
            <div className="card stack small">
              <strong>Kupony osobiste</strong>
              {data.coupons.map((k) => (
                <span key={k._id}>
                  {k.code} – {k.name} {k.maxUses != null && k.usedCount >= k.maxUses ? '(wykorzystany)' : ''}
                </span>
              ))}
            </div>
          ) : null}
          {data.reservations.length ? (
            <div className="card stack small">
              <strong>Rezerwacje</strong>
              {data.reservations.map((r) => (
                <span key={r._id}>
                  {r.datetime.replace('T', ' ')} · {r.guests} os. · {r.status}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/client';
import { formatPLN, PAYMENT_LABELS, STATUS_LABELS } from '@/lib/util';
import { useAdmin } from './AdminContext';
import { PageHead, fmtDate, useData, useRun } from './ui';
import { Modal } from '../Modal';
import { Icon } from '../Icon';
import type { IOrder } from '@/lib/models/core';

type O = IOrder & { _id: string };

const COLS: { key: string; title: string; statuses: string[] }[] = [
  { key: 'new', title: 'Nowe', statuses: ['pending'] },
  { key: 'prep', title: 'W przygotowaniu', statuses: ['accepted', 'preparing'] },
  { key: 'ready', title: 'Gotowe do odbioru', statuses: ['ready'] },
  { key: 'done', title: 'Wydane / anulowane (3 h)', statuses: ['completed', 'cancelled'] }
];

function minutesAgo(d: string | Date) {
  return Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 60000));
}

export function OrdersBoard() {
  const { location, live, refreshLive, session } = useAdmin();
  const [tab, setTab] = useState<'board' | 'history'>('board');
  const { data, reload } = useData<{ orders: O[] }>(`/api/admin/orders/board?location=${location}`, [live?.latestOrder?.id, live?.pendingOrders]);
  const [selected, setSelected] = useState<string | null>(null);
  const [, tick] = useState(0);
  const { busy, run } = useRun();

  useEffect(() => {
    const id = setInterval(() => {
      reload();
      tick((x) => x + 1);
    }, 15000);
    return () => clearInterval(id);
  }, [reload]);

  const orders = data?.orders || [];
  const awaiting = orders.filter((o) => o.status === 'awaiting_payment');

  async function setStatus(o: O, status: string, extra: Record<string, unknown> = {}) {
    if (status === 'cancelled') {
      const reason = prompt(`Powód anulowania ${o.orderNumber} (klient zobaczy go w powiadomieniu):`, 'Brak produktu');
      if (reason === null) return;
      extra.reason = reason;
    }
    await run(async () => {
      await api(`/api/admin/orders/${o._id}`, { method: 'PATCH', body: { status, ...extra } });
      await reload();
      refreshLive();
    }, `${o.orderNumber}: ${STATUS_LABELS[status]}`);
  }

  return (
    <>
      <PageHead
        title="Zamówienia"
        sub="Tablica odświeża się automatycznie. Nowe zamówienie = sygnał dźwiękowy."
        actions={
          <div className="tabs" style={{ margin: 0, border: 0 }}>
            <button aria-selected={tab === 'board'} onClick={() => setTab('board')}>
              Na żywo
            </button>
            <button aria-selected={tab === 'history'} onClick={() => setTab('history')}>
              Historia
            </button>
          </div>
        }
      />
      {tab === 'history' ? (
        <OrdersHistory onOpen={setSelected} />
      ) : (
        <>
          {awaiting.length ? (
            <p className="alert alert-info small mb-2">
              {awaiting.length} zamówień czeka na płatność online ({awaiting.map((o) => o.orderNumber).join(', ')}) – pojawią się w „Nowe” po zaksięgowaniu.
            </p>
          ) : null}
          <div className="kanban">
            {COLS.map((c) => {
              const list = orders.filter((o) => c.statuses.includes(o.status));
              return (
                <section key={c.key} className="kanban-col" aria-label={c.title}>
                  <h3>
                    {c.title} <span>{list.length}</span>
                  </h3>
                  {list.map((o) => (
                    <article key={o._id} className="order-card" data-new={o.status === 'pending'}>
                      <div className="row between">
                        <button className="link" style={{ textDecoration: 'none', fontSize: '1.05rem', color: 'var(--ink)' }} onClick={() => setSelected(o._id)}>
                          {o.orderNumber}
                        </button>
                        <span className="row" style={{ '--gap': '6px' } as React.CSSProperties}>
                          {o.source === 'app' ? <span className="badge badge-rose">App</span> : null}
                          <span className="badge badge-dark">
                            <Icon name="clock" size={12} /> {o.pickupTime}
                          </span>
                        </span>
                      </div>
                      <div className="tiny muted">
                        {o.customerName} · {minutesAgo(o.createdAt)} min temu
                        {o.deliveryMethod === 'delivery' ? ' · DOSTAWA' : ''}
                      </div>
                      <ul className="order-items">
                        {o.items.map((i, k) => (
                          <li key={k}>
                            <strong>{i.quantity}×</strong> {i.name}
                            {i.desc ? <span className="desc">{i.desc}</span> : null}
                          </li>
                        ))}
                      </ul>
                      {o.notes ? <p className="alert alert-warn small" style={{ padding: '6px 10px', margin: '0 0 8px' }}>„{o.notes}”</p> : null}
                      <div className="row between small">
                        <span className={o.paymentStatus === 'paid' ? 'badge badge-mint' : 'badge badge-amber'}>
                          {o.paymentStatus === 'paid' ? 'Opłacone' : PAYMENT_LABELS[o.paymentMethod]?.split(' ')[0] || o.paymentMethod}
                        </span>
                        <strong>{formatPLN(o.totalAmount)}</strong>
                      </div>
                      <div className="row mt-1" style={{ '--gap': '6px' } as React.CSSProperties}>
                        {o.status === 'pending' ? (
                          <>
                            <button className="btn btn-accent btn-sm" style={{ flex: 1 }} disabled={busy} onClick={() => setStatus(o, 'preparing')}>
                              Przyjmij
                            </button>
                            {session.role !== 'kitchen' ? (
                              <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setStatus(o, 'cancelled')}>
                                Odrzuć
                              </button>
                            ) : null}
                          </>
                        ) : null}
                        {['accepted', 'preparing'].includes(o.status) ? (
                          <button className="btn btn-sm" style={{ flex: 1 }} disabled={busy} onClick={() => setStatus(o, 'ready')}>
                            Gotowe
                          </button>
                        ) : null}
                        {o.status === 'ready' ? (
                          <button className="btn btn-sm" style={{ flex: 1, '--bg': 'var(--mint-ink)' } as React.CSSProperties} disabled={busy} onClick={() => setStatus(o, 'completed')}>
                            Wydane
                          </button>
                        ) : null}
                        {o.status === 'completed' && o.pointsEarned ? <span className="tiny muted">+{o.pointsEarned} pkt dla klienta</span> : null}
                        {o.status === 'cancelled' ? <span className="tiny muted">{o.cancelReason || 'Anulowane'}</span> : null}
                      </div>
                    </article>
                  ))}
                </section>
              );
            })}
          </div>
        </>
      )}
      <OrderDetail id={selected} onClose={() => setSelected(null)} onChange={reload} setStatus={setStatus} />
    </>
  );
}

function OrderDetail({ id, onClose, onChange, setStatus }: { id: string | null; onClose: () => void; onChange: () => void; setStatus: (o: O, s: string) => Promise<void> }) {
  const { data } = useData<{ order: O; customer: { _id: string; name?: string; username: string; email: string; points: number; tier: string } | null }>(id ? `/api/admin/orders/${id}` : null, [id]);
  const o = data?.order;
  if (!id) return null;
  return (
    <Modal open={!!id} onClose={onClose} title={o ? `Zamówienie ${o.orderNumber}` : 'Zamówienie'} wide>
      {!o ? (
        <div className="skeleton" style={{ height: 200 }} />
      ) : (
        <div className="grid grid-2">
          <div className="stack" style={{ '--gap': '10px' } as React.CSSProperties}>
            <div className="row">
              <span className="badge badge-dark">{STATUS_LABELS[o.status] || o.status}</span>
              <span className="badge">{o.source === 'app' ? 'Aplikacja' : o.source === 'kiosk' ? 'Kiosk' : 'Strona'}</span>
              <span className="badge">{o.deliveryMethod === 'delivery' ? 'Dostawa' : 'Odbiór'} {o.pickupTime}</span>
            </div>
            <div className="small">
              <strong>{o.customerName}</strong> · <a href={`tel:${o.customerPhone}`} className="link">{o.customerPhone}</a>
              {o.customerEmail ? <> · {o.customerEmail}</> : null}
              {o.deliveryAddress ? <div>Adres: {o.deliveryAddress}</div> : null}
            </div>
            {data?.customer ? (
              <Link href={`/admin/klienci/${data.customer._id}`} className="card card-sm small">
                Klient MilkMi: <strong>{data.customer.name || data.customer.username}</strong> · {data.customer.points} pkt · {data.customer.tier}
              </Link>
            ) : null}
            {o.notes ? <p className="alert alert-warn small">„{o.notes}”</p> : null}
            <div>
              {o.items.map((i, k) => (
                <div key={k} className="summary-row small">
                  <span>
                    {i.quantity}× {i.name}
                    {i.desc ? <span className="tiny muted" style={{ display: 'block' }}>{i.desc}</span> : null}
                  </span>
                  <span>{formatPLN(i.price * i.quantity)}</span>
                </div>
              ))}
              {o.discount ? (
                <div className="summary-row small">
                  <span>Rabat {o.couponCode || ''} {o.rewardUsed ? `· nagroda ${o.rewardUsed}` : ''}</span>
                  <span className="neg">−{formatPLN(o.discount)}</span>
                </div>
              ) : null}
              <div className="summary-row small">
                <span>Opakowania / dostawa</span>
                <span>{formatPLN((o.packagingFee || 0) + (o.deliveryFee || 0))}</span>
              </div>
              <div className="summary-row total">
                <span>Razem</span>
                <span>{formatPLN(o.totalAmount)}</span>
              </div>
              <p className="small muted">
                {PAYMENT_LABELS[o.paymentMethod]} · {o.paymentStatus === 'paid' ? 'opłacone' : o.paymentStatus === 'refunded' ? 'zwrócone' : 'do zapłaty przy odbiorze'}
                {o.walletUsed ? ` · z portfela ${formatPLN(o.walletUsed)}` : ''}
              </p>
            </div>
          </div>
          <div className="stack" style={{ '--gap': '10px' } as React.CSSProperties}>
            <strong className="small">Historia statusów</strong>
            <ol className="small" style={{ margin: 0, paddingLeft: 18 }}>
              {(o.statusHistory || []).map((h, k) => (
                <li key={k}>
                  {STATUS_LABELS[h.status] || h.status} · {fmtDate(h.at)} {h.by ? `· ${h.by}` : ''}
                </li>
              ))}
            </ol>
            {o.rating ? (
              <p className="small">
                Ocena: <strong>{'★'.repeat(o.rating)}</strong> {o.ratingComment ? `„${o.ratingComment}”` : ''}
              </p>
            ) : null}
            <div className="row">
              {!['completed', 'cancelled', 'payment_failed'].includes(o.status) ? (
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ color: 'var(--danger)' }}
                  onClick={async () => {
                    await setStatus(o, 'cancelled');
                    onChange();
                    onClose();
                  }}
                >
                  Anuluj{o.paymentStatus === 'paid' && o.paymentMethod === 'online' ? ' i zwróć płatność' : ''}
                </button>
              ) : null}
              <button className="btn btn-ghost btn-sm" onClick={() => window.print()}>
                Drukuj podgląd
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

function OrdersHistory({ onOpen }: { onOpen: (id: string) => void }) {
  const { location } = useAdmin();
  const [f, setF] = useState({ from: '', to: '', status: '', source: '', q: '' });
  const [skip, setSkip] = useState(0);
  const qs = useMemo(() => {
    const p = new URLSearchParams({ location, skip: String(skip), limit: '50' });
    Object.entries(f).forEach(([k, v]) => v && p.set(k, v));
    return p.toString();
  }, [f, location, skip]);
  const { data, loading } = useData<{ orders: O[]; total: number; revenueLabel: string }>(`/api/admin/orders?${qs}`, [qs]);
  return (
    <>
      <div className="toolbar">
        <input className="input" type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} aria-label="Od" />
        <input className="input" type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} aria-label="Do" />
        <select className="select" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} aria-label="Status">
          <option value="">Wszystkie statusy</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select className="select" value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} aria-label="Źródło">
          <option value="">Strona + aplikacja</option>
          <option value="web">Strona</option>
          <option value="app">Aplikacja</option>
        </select>
        <input className="input" placeholder="Numer, klient, telefon" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
        <a className="btn btn-ghost btn-sm" href={`/api/admin/orders?${qs}&format=csv`}>
          <Icon name="download" size={14} /> CSV
        </a>
      </div>
      <p className="small muted">
        {data ? `${data.total} zamówień · sprzedaż ${data.revenueLabel}` : loading ? 'Ładowanie…' : ''}
      </p>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Numer</th>
              <th>Data</th>
              <th>Klient</th>
              <th>Źródło</th>
              <th>Status</th>
              <th>Płatność</th>
              <th className="num">Kwota</th>
            </tr>
          </thead>
          <tbody>
            {(data?.orders || []).map((o) => (
              <tr key={o._id} className="clickable" onClick={() => onOpen(o._id)}>
                <td>
                  <strong>{o.orderNumber}</strong>
                </td>
                <td>{fmtDate(o.createdAt)}</td>
                <td>
                  {o.customerName}
                  <div className="tiny muted">{o.customerPhone}</div>
                </td>
                <td>{o.source === 'app' ? 'Aplikacja' : 'Strona'}</td>
                <td>{STATUS_LABELS[o.status] || o.status}</td>
                <td>{PAYMENT_LABELS[o.paymentMethod]?.split(' ')[0] || o.paymentMethod}</td>
                <td className="num">{formatPLN(o.totalAmount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="row mt-2">
        <button className="btn btn-ghost btn-sm" disabled={skip === 0} onClick={() => setSkip(Math.max(0, skip - 50))}>
          ← Nowsze
        </button>
        <button className="btn btn-ghost btn-sm" disabled={!data || skip + 50 >= data.total} onClick={() => setSkip(skip + 50)}>
          Starsze →
        </button>
      </div>
    </>
  );
}

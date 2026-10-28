'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import type { ILoyaltyConfig } from '@/lib/models/loyalty';
import { PageHead, Switch, fmtDate, useData, useRun } from './ui';
import { RewardsSection } from './sections/Simple';
import { Icon } from '../Icon';

/* ================= PROGRAM LOJALNOŚCIOWY ================= */
export function LoyaltyConfigForm() {
  const { data } = useData<{ config: ILoyaltyConfig }>('/api/admin/loyalty');
  const [c, setC] = useState<ILoyaltyConfig | null>(null);
  const { busy, run } = useRun();
  useEffect(() => {
    if (data) setC(data.config);
  }, [data]);
  if (!c) return <div className="skeleton" style={{ height: 300 }} />;
  const set = <K extends keyof ILoyaltyConfig>(k: K, v: ILoyaltyConfig[K]) => setC({ ...c, [k]: v });
  const n = (v: string) => Number(v.replace(',', '.')) || 0;

  return (
    <>
      <PageHead
        title="Program lojalnościowy"
        sub="Zmiany działają od razu – bez zmiany kodu."
        actions={
          <button
            className="btn btn-accent btn-sm"
            disabled={busy}
            onClick={() =>
              run(async () => {
                const { _id, key, updatedAt, ...body } = c as ILoyaltyConfig & { _id?: string };
                void _id;
                void key;
                void updatedAt;
                await api('/api/admin/loyalty', { method: 'PUT', body });
              }, 'Zapisano program.')
            }
          >
            Zapisz
          </button>
        }
      />
      <div className="grid grid-2 mb-3">
        <section className="card stack">
          <h2 className="h3">Punkty i poziomy</h2>
          <label className="field">
            <span className="label">1 punkt za każde … zł</span>
            <input className="input" type="number" value={c.pointsPerAmount} onChange={(e) => set('pointsPerAmount', n(e.target.value))} />
          </label>
          {c.tiers.map((t, i) => (
            <div key={t.key} className="card card-sm card-flat grid grid-3" style={{ '--gap': '8px' } as React.CSSProperties}>
              <label className="field">
                <span className="label">Poziom</span>
                <input className="input" value={t.name} onChange={(e) => set('tiers', c.tiers.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} />
              </label>
              <label className="field">
                <span className="label">Od (zł/rok)</span>
                <input className="input" type="number" value={t.minYearSpent} disabled={i === 0} onChange={(e) => set('tiers', c.tiers.map((x, k) => (k === i ? { ...x, minYearSpent: n(e.target.value) } : x)))} />
              </label>
              <label className="field">
                <span className="label">Mnożnik pkt</span>
                <input className="input" type="number" step="0.05" value={t.multiplier} onChange={(e) => set('tiers', c.tiers.map((x, k) => (k === i ? { ...x, multiplier: n(e.target.value) } : x)))} />
              </label>
              <label className="field" style={{ gridColumn: '1 / -1' }}>
                <span className="label">Korzyści (widoczne dla klienta)</span>
                <input className="input" value={t.perks} onChange={(e) => set('tiers', c.tiers.map((x, k) => (k === i ? { ...x, perks: e.target.value } : x)))} />
              </label>
            </div>
          ))}
          <label className="field">
            <span className="label">Ważność punktów (miesiące od ostatniego zakupu, 0 = bez limitu)</span>
            <input className="input" type="number" value={c.pointsExpiryMonths} onChange={(e) => set('pointsExpiryMonths', n(e.target.value))} />
          </label>
        </section>
        <section className="stack">
          <div className="card stack">
            <div className="row between">
              <h2 className="h3">Pieczątki</h2>
              <Switch checked={c.stampsEnabled} onChange={(v) => set('stampsEnabled', v)} />
            </div>
            <div className="grid grid-3" style={{ '--gap': '8px' } as React.CSSProperties}>
              <label className="field">
                <span className="label">Co który gratis</span>
                <input className="input" type="number" value={c.stampsRequired} onChange={(e) => set('stampsRequired', n(e.target.value))} />
              </label>
              <label className="field">
                <span className="label">Kategoria (klucz)</span>
                <input className="input" value={c.stampCategoryPrefix} onChange={(e) => set('stampCategoryPrefix', e.target.value)} />
              </label>
              <label className="field">
                <span className="label">Maks. wartość</span>
                <input className="input" type="number" value={c.stampRewardMaxValue} onChange={(e) => set('stampRewardMaxValue', n(e.target.value))} />
              </label>
            </div>
          </div>
          <div className="card stack">
            <h2 className="h3">Wymiana punktów na portfel</h2>
            <div className="chips" style={{ flexWrap: 'wrap' }}>
              {c.walletVouchers.map((v, i) => (
                <span key={i} className="row card card-sm" style={{ '--gap': '6px', flexWrap: 'nowrap', padding: 8 } as React.CSSProperties}>
                  <input className="input" style={{ width: 70, minHeight: 34 }} type="number" value={v.cost} onChange={(e) => set('walletVouchers', c.walletVouchers.map((x, k) => (k === i ? { ...x, cost: n(e.target.value) } : x)))} />
                  pkt →
                  <input className="input" style={{ width: 70, minHeight: 34 }} type="number" value={v.value} onChange={(e) => set('walletVouchers', c.walletVouchers.map((x, k) => (k === i ? { ...x, value: n(e.target.value) } : x)))} />
                  zł
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={() => set('walletVouchers', c.walletVouchers.filter((_, k) => k !== i))} aria-label="Usuń">
                    <Icon name="x" size={12} />
                  </button>
                </span>
              ))}
              <button className="btn btn-ghost btn-sm" onClick={() => set('walletVouchers', [...c.walletVouchers, { cost: 50, value: 50 }])}>
                + Bon
              </button>
            </div>
          </div>
          <div className="card stack">
            <h2 className="h3">Bonus przy doładowaniu portfela</h2>
            {c.topupBonuses.map((b, i) => (
              <div key={i} className="row" style={{ flexWrap: 'nowrap' }}>
                od <input className="input" style={{ width: 90 }} type="number" value={b.min} onChange={(e) => set('topupBonuses', c.topupBonuses.map((x, k) => (k === i ? { ...x, min: n(e.target.value) } : x)))} /> zł → +
                <input className="input" style={{ width: 70 }} type="number" value={b.bonusPercent} onChange={(e) => set('topupBonuses', c.topupBonuses.map((x, k) => (k === i ? { ...x, bonusPercent: n(e.target.value) } : x)))} />%
                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => set('topupBonuses', c.topupBonuses.filter((_, k) => k !== i))} aria-label="Usuń">
                  <Icon name="x" size={12} />
                </button>
              </div>
            ))}
            <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => set('topupBonuses', [...c.topupBonuses, { min: 300, bonusPercent: 10 }])}>
              + Próg
            </button>
          </div>
          <div className="card stack">
            <h2 className="h3">Automatyczne kupony i polecenia</h2>
            <div className="row between">
              <Switch checked={c.birthdayCouponEnabled} onChange={(v) => set('birthdayCouponEnabled', v)} label="Kupon urodzinowy (%)" />
              <input className="input" style={{ width: 80 }} type="number" value={c.birthdayCouponPercent} onChange={(e) => set('birthdayCouponPercent', n(e.target.value))} />
            </div>
            <div className="row between">
              <Switch checked={c.firstAppOrderCouponEnabled} onChange={(v) => set('firstAppOrderCouponEnabled', v)} label="Rabat na 1. zamówienie w aplikacji (%)" />
              <input className="input" style={{ width: 80 }} type="number" value={c.firstAppOrderPercent} onChange={(e) => set('firstAppOrderPercent', n(e.target.value))} />
            </div>
            <div className="row between">
              <Switch checked={c.referralEnabled} onChange={(v) => set('referralEnabled', v)} label="Polecenia: pkt polecający / polecony" />
              <span className="row" style={{ flexWrap: 'nowrap' }}>
                <input className="input" style={{ width: 70 }} type="number" value={c.referralPointsReferrer} onChange={(e) => set('referralPointsReferrer', n(e.target.value))} />
                <input className="input" style={{ width: 70 }} type="number" value={c.referralPointsReferee} onChange={(e) => set('referralPointsReferee', n(e.target.value))} />
              </span>
            </div>
          </div>
        </section>
      </div>
      <RewardsSection />
    </>
  );
}

/* ================= KAMPANIE ================= */
interface Campaign {
  _id: string;
  title: string;
  body: string;
  channel: string;
  segment: string;
  status: string;
  recipients: number;
  sentAt: string | null;
  createdBy: string;
}

export function Campaigns() {
  const { data, reload } = useData<{ items: Campaign[]; segments: Record<string, string> }>('/api/admin/campaigns');
  const [f, setF] = useState({ title: '', body: '', url: '/app/zamow', channel: 'push', segment: 'marketing', couponCode: '' });
  const [preview, setPreview] = useState<string>('');
  const { busy, run } = useRun();
  return (
    <>
      <PageHead title="Kampanie push i e-mail" sub="Wiadomości trafiają tylko do klientów, którzy wyrazili zgodę marketingową." />
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.2fr)', gap: 16 } as React.CSSProperties}>
        <section className="card stack">
          <h2 className="h3">Nowa kampania</h2>
          <label className="field">
            <span className="label">Tytuł (max ~40 znaków w powiadomieniu)</span>
            <input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={80} />
          </label>
          <label className="field">
            <span className="label">Treść</span>
            <textarea className="textarea" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} maxLength={500} />
          </label>
          <div className="grid grid-2" style={{ '--gap': '10px' } as React.CSSProperties}>
            <label className="field">
              <span className="label">Kanał</span>
              <select className="select" value={f.channel} onChange={(e) => setF({ ...f, channel: e.target.value })}>
                <option value="push">Push</option>
                <option value="email">E-mail</option>
                <option value="both">Push + e-mail</option>
              </select>
            </label>
            <label className="field">
              <span className="label">Do kogo</span>
              <select className="select" value={f.segment} onChange={(e) => setF({ ...f, segment: e.target.value })}>
                {Object.entries(data?.segments || {}).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="label">Link po kliknięciu</span>
              <input className="input" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} />
            </label>
            <label className="field">
              <span className="label">Kod rabatowy (opcjonalnie)</span>
              <input className="input" value={f.couponCode} onChange={(e) => setF({ ...f, couponCode: e.target.value.toUpperCase() })} />
            </label>
          </div>
          {preview ? <p className="alert alert-info small">{preview}</p> : null}
          <div className="row">
            <button
              className="btn btn-ghost"
              disabled={busy || f.title.length < 2}
              onClick={async () => {
                const r = await run(() => api<{ message: string }>('/api/admin/campaigns', { body: { ...f, test: true } }));
                if (r) setPreview(r.message);
              }}
            >
              Policz odbiorców
            </button>
            <button
              className="btn btn-accent"
              disabled={busy || f.title.length < 2 || f.body.length < 2}
              onClick={async () => {
                if (!confirm('Wysłać kampanię teraz?')) return;
                const r = await run(() => api<{ message: string }>('/api/admin/campaigns', { body: f }));
                if (r) {
                  setPreview(r.message);
                  setF({ ...f, title: '', body: '' });
                  reload();
                }
              }}
            >
              <Icon name="send" size={16} /> Wyślij
            </button>
          </div>
        </section>
        <section className="card">
          <h2 className="h3 mb-2">Wysłane</h2>
          <table className="table">
            <tbody>
              {(data?.items || []).map((c) => (
                <tr key={c._id}>
                  <td>
                    <strong>{c.title}</strong>
                    <div className="tiny muted">{c.body.slice(0, 80)}</div>
                  </td>
                  <td className="small">{data?.segments[c.segment] || c.segment}</td>
                  <td className="small">{c.channel}</td>
                  <td className="num">{c.recipients}</td>
                  <td className="tiny muted">{fmtDate(c.sentAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data && !data.items.length ? <p className="small muted">Brak kampanii.</p> : null}
        </section>
      </div>
    </>
  );
}

/* ================= PASKI INFORMACYJNE ================= */
interface BannerT {
  target: 'web' | 'app';
  isActive: boolean;
  text: string;
  link: string;
  backgroundColor: string;
  startsAt: string | null;
  endsAt: string | null;
}

export function Banners() {
  const { data } = useData<{ items: BannerT[] }>('/api/admin/banners');
  const [b, setB] = useState<Record<'web' | 'app', BannerT>>({
    web: { target: 'web', isActive: false, text: '', link: '', backgroundColor: '#0F172A', startsAt: null, endsAt: null },
    app: { target: 'app', isActive: false, text: '', link: '', backgroundColor: '#FF6600', startsAt: null, endsAt: null }
  });
  const { busy, run } = useRun();
  useEffect(() => {
    if (!data) return;
    const next = { ...b };
    data.items.forEach((x) => {
      if (x.target === 'web' || x.target === 'app') next[x.target] = { ...next[x.target], ...x, link: x.link || '' };
    });
    setB(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);
  const dt = (v: string | null) => (v ? new Date(new Date(v).getTime() - new Date(v).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');
  return (
    <>
      <PageHead title="Paski informacyjne" sub="Krótki komunikat nad stroną lub na ekranie startowym aplikacji, z opcjonalnym harmonogramem." />
      <div className="grid grid-2">
        {(['web', 'app'] as const).map((k) => {
          const x = b[k];
          const set = (patch: Partial<BannerT>) => setB({ ...b, [k]: { ...x, ...patch } });
          return (
            <section key={k} className="card stack">
              <div className="row between">
                <h2 className="h3">{k === 'web' ? 'Strona internetowa' : 'Aplikacja MilkMi'}</h2>
                <Switch checked={x.isActive} onChange={(v) => set({ isActive: v })} label={x.isActive ? 'włączony' : 'wyłączony'} />
              </div>
              <div className="announcement" style={{ background: x.backgroundColor, borderRadius: 12 }}>
                {x.text || 'Podgląd paska'}
              </div>
              <input className="input" placeholder="Treść, np. Nowy smak: pistacja!" value={x.text} onChange={(e) => set({ text: e.target.value })} maxLength={200} />
              <input className="input" placeholder="Link (opcjonalnie), np. /menu/shakes" value={x.link} onChange={(e) => set({ link: e.target.value })} />
              <label className="row small">
                Kolor: <input type="color" value={x.backgroundColor} onChange={(e) => set({ backgroundColor: e.target.value })} />
              </label>
              <div className="grid grid-2" style={{ '--gap': '8px' } as React.CSSProperties}>
                <label className="field">
                  <span className="label">Od</span>
                  <input className="input" type="datetime-local" value={dt(x.startsAt)} onChange={(e) => set({ startsAt: e.target.value ? new Date(e.target.value).toISOString() : null })} />
                </label>
                <label className="field">
                  <span className="label">Do</span>
                  <input className="input" type="datetime-local" value={dt(x.endsAt)} onChange={(e) => set({ endsAt: e.target.value ? new Date(e.target.value).toISOString() : null })} />
                </label>
              </div>
              <button className="btn btn-accent" disabled={busy} onClick={() => run(() => api('/api/admin/banners', { method: 'PUT', body: x }), 'Zapisano.')}>
                Zapisz
              </button>
            </section>
          );
        })}
      </div>
    </>
  );
}

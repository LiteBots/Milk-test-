'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { PageHead, ImageInput, useData, useRun } from './ui';
import { useAdmin } from './AdminContext';
import { Icon } from '../Icon';

interface Upsell {
  items: { id: string; name: string; price: number; img: string }[];
  rules: { whenCategoryPrefix: string; suggestProductIds: string[] }[];
}

// Sugestie w koszyku: stałe dodatki (sosy, napoje) + reguły „do burgera zaproponuj frytki”
export function UpsellEditor() {
  const { location } = useAdmin();
  const { data } = useData<Upsell>(`/api/admin/upsell?location=${location}`, [location]);
  const products = useData<{ items: { _id: string; name: string; categoryId: string }[] }>('/api/admin/products');
  const cats = useData<{ items: { key: string; name: string; parentKey: string | null }[] }>('/api/admin/crud/categories?limit=500');
  const [u, setU] = useState<Upsell>({ items: [], rules: [] });
  const { busy, run } = useRun();
  useEffect(() => {
    if (data) setU({ items: data.items, rules: data.rules });
  }, [data]);

  return (
    <>
      <PageHead
        title="Sugestie w koszyku"
        sub="Zwiększają średnią wartość zamówienia. Klient widzi je w koszyku pod listą produktów."
        actions={
          <button className="btn btn-accent btn-sm" disabled={busy} onClick={() => run(() => api('/api/admin/upsell', { method: 'PUT', body: { location, ...u } }), 'Zapisano.')}>
            Zapisz
          </button>
        }
      />
      <div className="grid grid-2">
        <section className="card stack">
          <h2 className="h3">Szybkie dodatki</h2>
          <p className="small muted" style={{ margin: 0 }}>Pozycje dodawane jednym kliknięciem (np. sos, woda, dodatkowa porcja).</p>
          {u.items.map((it, i) => (
            <div key={i} className="card card-sm stack" style={{ '--gap': '8px' } as React.CSSProperties}>
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <input className="input" placeholder="Nazwa" value={it.name} onChange={(e) => setU({ ...u, items: u.items.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)) })} />
                <input className="input" style={{ width: 110 }} type="number" step="0.01" value={it.price} onChange={(e) => setU({ ...u, items: u.items.map((x, k) => (k === i ? { ...x, price: Number(e.target.value) } : x)) })} />
                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setU({ ...u, items: u.items.filter((_, k) => k !== i) })} aria-label="Usuń">
                  <Icon name="trash" size={14} />
                </button>
              </div>
              <ImageInput value={it.img} onChange={(v) => setU({ ...u, items: u.items.map((x, k) => (k === i ? { ...x, img: v } : x)) })} />
            </div>
          ))}
          <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setU({ ...u, items: [...u.items, { id: `u${Date.now().toString(36)}`, name: '', price: 0, img: '' }] })}>
            + Dodatek
          </button>
        </section>
        <section className="card stack">
          <h2 className="h3">Reguły podpowiedzi</h2>
          <p className="small muted" style={{ margin: 0 }}>Gdy w koszyku jest produkt z kategorii, zaproponuj wybrane produkty.</p>
          {u.rules.map((r, i) => (
            <div key={i} className="card card-sm stack" style={{ '--gap': '8px' } as React.CSSProperties}>
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <select className="select" value={r.whenCategoryPrefix} onChange={(e) => setU({ ...u, rules: u.rules.map((x, k) => (k === i ? { ...x, whenCategoryPrefix: e.target.value } : x)) })}>
                  <option value="">Gdy w koszyku…</option>
                  {(cats.data?.items || []).map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.parentKey ? '— ' : ''}
                      {c.name}
                    </option>
                  ))}
                </select>
                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setU({ ...u, rules: u.rules.filter((_, k) => k !== i) })} aria-label="Usuń regułę">
                  <Icon name="trash" size={14} />
                </button>
              </div>
              <select
                className="select"
                value=""
                onChange={(e) => e.target.value && setU({ ...u, rules: u.rules.map((x, k) => (k === i ? { ...x, suggestProductIds: [...new Set([...x.suggestProductIds, e.target.value])].slice(0, 6) } : x)) })}
              >
                <option value="">+ zaproponuj produkt…</option>
                {(products.data?.items || []).map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <div className="chips" style={{ flexWrap: 'wrap' }}>
                {r.suggestProductIds.map((id) => (
                  <button key={id} className="chip" aria-pressed onClick={() => setU({ ...u, rules: u.rules.map((x, k) => (k === i ? { ...x, suggestProductIds: x.suggestProductIds.filter((y) => y !== id) } : x)) })}>
                    {(products.data?.items || []).find((p) => p._id === id)?.name || id} ×
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setU({ ...u, rules: [...u.rules, { whenCategoryPrefix: '', suggestProductIds: [] }] })}>
            + Reguła
          </button>
        </section>
      </div>
    </>
  );
}

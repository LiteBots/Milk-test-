'use client';

import { useMemo, useRef, useState } from 'react';
import { api } from '@/lib/client';
import { formatPLN, LOCATION_NAMES } from '@/lib/util';
import { ALLERGENS, DIET_TAGS } from '@/lib/constants';
import type { IProduct } from '@/lib/models/core';
import { PageHead, ImageInput, Switch, useData, useRun } from './ui';
import { useAdmin } from './AdminContext';
import { Modal } from '../Modal';
import { Icon } from '../Icon';

type P = IProduct & { _id: string };
interface Cat {
  _id: string;
  key: string;
  name: string;
  parentKey: string | null;
  sortOrder: number;
  allowSet: boolean;
}

const plural = (n: number, one: string, few: string, many: string) => `${n} ${n === 1 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? few : many}`;

const EMPTY: Partial<P> = {
  name: '',
  description: '',
  categoryId: '',
  location: 'slupsk',
  price: 0,
  variants: [],
  addons: [],
  allowSet: false,
  isBestseller: false,
  allergens: [],
  tags: [],
  kcal: null,
  available: true,
  unavailableAt: [],
  imageUrl: '',
  priceOverrides: [],
  seasonFrom: null,
  seasonTo: null
};

export function ProductsManager() {
  const { locations } = useAdmin();
  const { data, reload, setData } = useData<{ items: P[] }>('/api/admin/products');
  const cats = useData<{ items: Cat[] }>('/api/admin/crud/categories?limit=500');
  const [q, setQ] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [locFilter, setLocFilter] = useState('');
  const [edit, setEdit] = useState<Partial<P> | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const { busy, run } = useRun();
  const importRef = useRef<HTMLInputElement>(null);

  const categories = cats.data?.items || [];
  const catName = (k: string) => categories.find((c) => c.key === k)?.name || k;
  const ordered = useMemo(() => {
    // Kolejność kategorii jak w menu: główna, potem jej podkategorie
    const tops = categories.filter((c) => !c.parentKey).sort((a, b) => a.sortOrder - b.sortOrder);
    const out: Cat[] = [];
    tops.forEach((t) => {
      out.push(t);
      categories.filter((c) => c.parentKey === t.key).sort((a, b) => a.sortOrder - b.sortOrder).forEach((c) => out.push(c));
    });
    categories.filter((c) => c.parentKey && !tops.some((t) => t.key === c.parentKey)).forEach((c) => out.push(c));
    return out;
  }, [categories]);

  const products = (data?.items || []).filter(
    (p) =>
      (!q || p.name.toLowerCase().includes(q.toLowerCase())) &&
      (!catFilter || p.categoryId === catFilter || categories.find((c) => c.key === p.categoryId)?.parentKey === catFilter) &&
      (!locFilter || (p.location || 'slupsk') === locFilter || p.location === 'all')
  );
  const groups = [
    ...ordered.map((c) => ({ key: c.key, name: c.parentKey ? `${catName(c.parentKey)} › ${c.name}` : c.name, items: products.filter((p) => p.categoryId === c.key) })),
    { key: '__other', name: 'Bez kategorii', items: products.filter((p) => !categories.some((c) => c.key === p.categoryId)) }
  ].filter((g) => g.items.length);

  async function quick(p: P, body: Record<string, unknown>) {
    setData((d) => (d ? { items: d.items.map((x) => (x._id === p._id ? ({ ...x, ...body } as P) : x)) } : d));
    await run(() => api(`/api/admin/products/${p._id}`, { method: 'PATCH', body }));
  }

  async function drop(groupKey: string, targetId: string) {
    if (!dragId || dragId === targetId) return;
    const items = products.filter((p) => p.categoryId === groupKey).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    const from = items.findIndex((p) => p._id === dragId);
    const to = items.findIndex((p) => p._id === targetId);
    if (from < 0 || to < 0) return;
    const [m] = items.splice(from, 1);
    items.splice(to, 0, m);
    const ids = items.map((p) => p._id);
    setData((d) => (d ? { items: d.items.map((x) => (ids.includes(x._id) ? { ...x, sortOrder: ids.indexOf(x._id) } : x)).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)) } : d));
    await run(() => api('/api/admin/products/reorder', { body: { kind: 'products', ids } }), 'Zapisano kolejność.');
  }

  return (
    <>
      <PageHead
        title="Produkty"
        sub="Przeciągnij wiersz, aby zmienić kolejność w kategorii. Zmiany są widoczne na stronie w ciągu kilku sekund."
        actions={
          <>
            <a className="btn btn-ghost btn-sm" href="/api/admin/products/export">
              <Icon name="download" size={14} /> Eksport CSV
            </a>
            <button className="btn btn-ghost btn-sm" onClick={() => importRef.current?.click()} disabled={busy}>
              Import CSV
            </button>
            <button className="btn btn-accent btn-sm" onClick={() => setEdit({ ...EMPTY, categoryId: catFilter || ordered[0]?.key || '' })}>
              <Icon name="plus" size={16} /> Dodaj produkt
            </button>
          </>
        }
      />
      <input
        ref={importRef}
        type="file"
        accept=".csv,text/csv"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          const fd = new FormData();
          fd.append('file', f);
          const r = await run(() => api<{ created: number; updated: number; errors: string[] }>('/api/admin/products/import', { body: fd }));
          if (r) {
            alert(`Import: nowe ${r.created}, zmienione ${r.updated}.${r.errors.length ? `\n\nPominięte:\n${r.errors.join('\n')}` : ''}`);
            reload();
          }
          e.target.value = '';
        }}
      />
      <div className="toolbar">
        <input className="input" placeholder="Szukaj produktu" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 260 }} />
        <select className="select" value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
          <option value="">Wszystkie kategorie</option>
          {ordered.map((c) => (
            <option key={c.key} value={c.key}>
              {c.parentKey ? '— ' : ''}
              {c.name}
            </option>
          ))}
        </select>
        <select className="select" value={locFilter} onChange={(e) => setLocFilter(e.target.value)}>
          <option value="">Wszystkie lokale</option>
          {locations.map((l) => (
            <option key={l.slug} value={l.slug}>
              {l.city}
            </option>
          ))}
        </select>
        <span className="small muted">{products.length} produktów</span>
      </div>

      {groups.map((g) => (
        <section key={g.key} className="mb-3">
          <h2 className="h3 mb-2">{g.name}</h2>
          <div className="table-wrap">
            <table className="table">
              <tbody>
                {g.items.map((p) => (
                  <tr
                    key={p._id}
                    draggable
                    onDragStart={() => setDragId(p._id)}
                    onDragEnd={() => setDragId(null)}
                    onDragOver={(e: React.DragEvent) => e.preventDefault()}
                    onDrop={() => drop(g.key, p._id)}
                    className={dragId === p._id ? 'dragging' : undefined}
                  >
                    <td style={{ width: 28 }}>
                      <span className="drag-handle" aria-hidden>
                        ⋮⋮
                      </span>
                    </td>
                    <td style={{ width: 56 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 10, overflow: 'hidden', background: 'var(--cream-2)' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {p.imageUrl ? <img src={p.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
                      </div>
                    </td>
                    <td>
                      <button className="link" style={{ textDecoration: 'none', color: 'var(--ink)', textAlign: 'left' }} onClick={() => setEdit(p)}>
                        {p.name}
                      </button>
                      <div className="tiny muted">
                        {LOCATION_NAMES[p.location || 'slupsk']}
                        {p.variants?.length ? ` · ${plural(p.variants.length, 'wariant', 'warianty', 'wariantów')}` : ''}
                        {p.addons?.length ? ` · ${plural(p.addons.length, 'dodatek', 'dodatki', 'dodatków')}` : ''}
                        {p.seasonFrom || p.seasonTo ? ` · sezon ${p.seasonFrom || '…'} – ${p.seasonTo || '…'}` : ''}
                      </div>
                    </td>
                    <td className="num">{p.variants?.length ? `od ${formatPLN(Math.min(...p.variants.map((v) => v.price)))}` : formatPLN(p.price || 0)}</td>
                    <td>
                      <button className="btn btn-ghost btn-icon btn-sm" title="Bestseller" aria-pressed={p.isBestseller} onClick={() => quick(p, { isBestseller: !p.isBestseller })}>
                        <Icon name="star" size={16} style={{ color: p.isBestseller ? 'var(--accent)' : 'var(--line-2)' }} />
                      </button>
                    </td>
                    <td>
                      <Switch checked={p.available !== false} onChange={(v) => quick(p, { available: v })} label={p.available !== false ? 'w menu' : 'ukryty'} />
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setEdit(p)} aria-label="Edytuj">
                        <Icon name="edit" size={16} />
                      </button>
                      <button
                        className="btn btn-ghost btn-icon btn-sm"
                        aria-label="Duplikuj"
                        onClick={async () => {
                          await run(() => api(`/api/admin/products/${p._id}/duplicate`, { method: 'POST' }), 'Skopiowano (kopia jest ukryta).');
                          reload();
                        }}
                      >
                        <Icon name="layers" size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      {data && !groups.length ? <p className="empty card">Brak produktów dla wybranych filtrów.</p> : null}

      {edit ? (
        <ProductEditor
          product={edit}
          categories={ordered}
          locations={locations}
          onClose={() => setEdit(null)}
          onSaved={() => {
            setEdit(null);
            reload();
          }}
        />
      ) : null}
    </>
  );
}

function ProductEditor({ product, categories, locations, onClose, onSaved }: { product: Partial<P>; categories: Cat[]; locations: { slug: string; city: string }[]; onClose: () => void; onSaved: () => void }) {
  const [p, setP] = useState<Partial<P>>({ ...EMPTY, ...product });
  const [useVariants, setUseVariants] = useState(!!product.variants?.length);
  const { busy, run } = useRun();
  const isNew = !product._id;
  const set = <K extends keyof P>(k: K, v: P[K] | null) => setP((x) => ({ ...x, [k]: v }));
  const cat = categories.find((c) => c.key === p.categoryId);

  async function save() {
    const body = {
      name: p.name,
      nameEn: p.nameEn || undefined,
      slug: isNew ? undefined : p.slug,
      description: p.description || '',
      descriptionEn: p.descriptionEn || undefined,
      price: useVariants ? null : Number(p.price || 0),
      imageUrl: p.imageUrl || '',
      categoryId: p.categoryId,
      location: p.location || 'slupsk',
      variants: useVariants ? (p.variants || []).filter((v) => v.name).map((v) => ({ name: v.name, price: Number(v.price) || 0 })) : [],
      allowSet: !!p.allowSet,
      addons: (p.addons || []).filter((a) => a.name).map((a) => ({ id: a.id || '', name: a.name, price: Number(a.price) || 0 })),
      isBestseller: !!p.isBestseller,
      allergens: p.allergens || [],
      tags: p.tags || [],
      kcal: p.kcal ? Number(p.kcal) : null,
      available: p.available !== false,
      unavailableAt: p.unavailableAt || [],
      seasonFrom: p.seasonFrom || null,
      seasonTo: p.seasonTo || null,
      priceOverrides: (p.priceOverrides || []).filter((o) => o.price != null || o.variants?.length),
      seoTitle: p.seoTitle || undefined,
      seoDescription: p.seoDescription || undefined
    };
    const ok = await run(async () => {
      if (isNew) await api('/api/admin/products', { body });
      else await api(`/api/admin/products/${product._id}`, { method: 'PUT', body });
      return true;
    }, 'Produkt zapisany.');
    if (ok) onSaved();
  }

  async function remove() {
    if (!confirm(`Usunąć „${p.name}”? Zamiast usuwać możesz go ukryć.`)) return;
    const ok = await run(() => api(`/api/admin/products/${product._id}`, { method: 'DELETE' }), 'Usunięto.');
    if (ok) onSaved();
  }

  const otherLocs = locations.filter((l) => l.slug !== (p.location || 'slupsk'));

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={isNew ? 'Nowy produkt' : `Edycja: ${product.name}`}
      footer={
        <div className="row between">
          {!isNew ? (
            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={remove} disabled={busy}>
              <Icon name="trash" size={14} /> Usuń
            </button>
          ) : (
            <span />
          )}
          <div className="row">
            <button className="btn btn-ghost" onClick={onClose}>
              Anuluj
            </button>
            <button className="btn btn-accent" onClick={save} disabled={busy || !p.name || !p.categoryId}>
              {busy ? <span className="spinner" /> : null} Zapisz
            </button>
          </div>
        </div>
      }
    >
      <div className="grid grid-2" style={{ '--gap': '14px' } as React.CSSProperties}>
        <label className="field">
          <span className="label">Nazwa *</span>
          <input className="input" value={p.name || ''} onChange={(e) => set('name', e.target.value)} />
        </label>
        <label className="field">
          <span className="label">Nazwa po angielsku</span>
          <input className="input" value={p.nameEn || ''} onChange={(e) => set('nameEn', e.target.value)} />
        </label>
        <label className="field">
          <span className="label">Kategoria *</span>
          <select className="select" value={p.categoryId || ''} onChange={(e) => set('categoryId', e.target.value)}>
            <option value="">Wybierz…</option>
            {categories.map((c) => (
              <option key={c.key} value={c.key}>
                {c.parentKey ? '— ' : ''}
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="label">Lokal</span>
          <select className="select" value={p.location || 'slupsk'} onChange={(e) => set('location', e.target.value)}>
            {locations.map((l) => (
              <option key={l.slug} value={l.slug}>
                {l.city}
              </option>
            ))}
            <option value="all">Wszystkie lokale</option>
          </select>
        </label>
        <div style={{ gridColumn: '1 / -1' }}>
          <ImageInput value={p.imageUrl || ''} onChange={(v) => set('imageUrl', v)} />
        </div>
        <label className="field" style={{ gridColumn: '1 / -1' }}>
          <span className="label">Opis (skład, smak – widoczny w menu i Google)</span>
          <textarea className="textarea" value={p.description || ''} onChange={(e) => set('description', e.target.value)} />
        </label>

        <div className="field" style={{ gridColumn: '1 / -1' }}>
          <span className="label">Cena</span>
          <div className="segmented" role="group">
            <button type="button" aria-pressed={!useVariants} onClick={() => setUseVariants(false)}>
              Jedna cena
            </button>
            <button type="button" aria-pressed={useVariants} onClick={() => { setUseVariants(true); if (!p.variants?.length) set('variants', [{ name: '300 ml', price: Number(p.price) || 0 }, { name: '500 ml', price: 0 }]); }}>
              Warianty (rozmiary)
            </button>
          </div>
          {!useVariants ? (
            <input className="input mt-1" style={{ maxWidth: 180 }} type="number" step="0.01" min={0} value={p.price ?? ''} onChange={(e) => set('price', e.target.value === '' ? null : Number(e.target.value))} />
          ) : (
            <div className="stack mt-1" style={{ '--gap': '6px' } as React.CSSProperties}>
              {(p.variants || []).map((v, i) => (
                <div key={i} className="row" style={{ flexWrap: 'nowrap' }}>
                  <input className="input" placeholder="Nazwa wariantu" value={v.name} onChange={(e) => set('variants', (p.variants || []).map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} />
                  <input className="input" style={{ width: 120 }} type="number" step="0.01" value={v.price} onChange={(e) => set('variants', (p.variants || []).map((x, k) => (k === i ? { ...x, price: Number(e.target.value) } : x)))} />
                  <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => set('variants', (p.variants || []).filter((_, k) => k !== i))} aria-label="Usuń wariant">
                    <Icon name="x" size={14} />
                  </button>
                </div>
              ))}
              <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => set('variants', [...(p.variants || []), { name: '', price: 0 }])}>
                + Wariant
              </button>
            </div>
          )}
        </div>

        <div className="field" style={{ gridColumn: '1 / -1' }}>
          <span className="label">Dodatki płatne</span>
          <div className="stack" style={{ '--gap': '6px' } as React.CSSProperties}>
            {(p.addons || []).map((a, i) => (
              <div key={i} className="row" style={{ flexWrap: 'nowrap' }}>
                <input className="input" placeholder="np. Podwójny ser" value={a.name} onChange={(e) => set('addons', (p.addons || []).map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} />
                <input className="input" style={{ width: 120 }} type="number" step="0.01" value={a.price} onChange={(e) => set('addons', (p.addons || []).map((x, k) => (k === i ? { ...x, price: Number(e.target.value) } : x)))} />
                <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => set('addons', (p.addons || []).filter((_, k) => k !== i))} aria-label="Usuń dodatek">
                  <Icon name="x" size={14} />
                </button>
              </div>
            ))}
            <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => set('addons', [...(p.addons || []), { id: '', name: '', price: 0 }])}>
              + Dodatek
            </button>
          </div>
        </div>

        <div className="field" style={{ gridColumn: '1 / -1' }}>
          <span className="label">Alergeny</span>
          <div className="chips" style={{ flexWrap: 'wrap' }}>
            {ALLERGENS.map((a) => (
              <button type="button" key={a} className="chip" aria-pressed={(p.allergens || []).includes(a)} onClick={() => set('allergens', (p.allergens || []).includes(a) ? (p.allergens || []).filter((x) => x !== a) : [...(p.allergens || []), a])}>
                {a}
              </button>
            ))}
          </div>
        </div>
        <div className="field" style={{ gridColumn: '1 / -1' }}>
          <span className="label">Oznaczenia</span>
          <div className="chips" style={{ flexWrap: 'wrap' }}>
            {DIET_TAGS.map((a) => (
              <button type="button" key={a} className="chip" aria-pressed={(p.tags || []).includes(a)} onClick={() => set('tags', (p.tags || []).includes(a) ? (p.tags || []).filter((x) => x !== a) : [...(p.tags || []), a])}>
                {a}
              </button>
            ))}
          </div>
        </div>
        <label className="field">
          <span className="label">Kalorie (kcal)</span>
          <input className="input" type="number" value={p.kcal ?? ''} onChange={(e) => set('kcal', e.target.value === '' ? null : Number(e.target.value))} />
        </label>
        <div className="stack" style={{ '--gap': '8px', paddingTop: 22 } as React.CSSProperties}>
          <label className="check">
            <input type="checkbox" checked={!!p.isBestseller} onChange={(e) => set('isBestseller', e.target.checked)} />
            <span>Bestseller (strona główna)</span>
          </label>
          <label className="check">
            <input type="checkbox" checked={!!p.allowSet || !!cat?.allowSet} disabled={!!cat?.allowSet} onChange={(e) => set('allowSet', e.target.checked)} />
            <span>Zestaw z dodatkiem i napojem{cat?.allowSet ? ' (z kategorii)' : ''}</span>
          </label>
          <label className="check">
            <input type="checkbox" checked={p.available !== false} onChange={(e) => set('available', e.target.checked)} />
            <span>Widoczny w menu</span>
          </label>
        </div>
        <label className="field">
          <span className="label">Sezon od (opcjonalnie)</span>
          <input className="input" type="date" value={p.seasonFrom || ''} onChange={(e) => set('seasonFrom', e.target.value || null)} />
        </label>
        <label className="field">
          <span className="label">Sezon do</span>
          <input className="input" type="date" value={p.seasonTo || ''} onChange={(e) => set('seasonTo', e.target.value || null)} />
        </label>

        {p.location === 'all' && otherLocs.length ? (
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <span className="label">Inna cena w lokalu</span>
            {locations.map((l) => {
              const o = (p.priceOverrides || []).find((x) => x.location === l.slug);
              return (
                <div key={l.slug} className="row" style={{ flexWrap: 'nowrap' }}>
                  <span className="small" style={{ width: 90 }}>
                    {l.city}
                  </span>
                  <input
                    className="input"
                    style={{ width: 140 }}
                    type="number"
                    step="0.01"
                    placeholder="jak bazowa"
                    value={o?.price ?? ''}
                    onChange={(e) => {
                      const val = e.target.value === '' ? null : Number(e.target.value);
                      const rest = (p.priceOverrides || []).filter((x) => x.location !== l.slug);
                      set('priceOverrides', val == null ? rest : [...rest, { location: l.slug, price: val }]);
                    }}
                  />
                </div>
              );
            })}
            <span className="hint">Dla produktów z wariantami ceny wariantów ustawisz po eksporcie CSV lub w osobnych produktach per lokal.</span>
          </div>
        ) : null}

        <details style={{ gridColumn: '1 / -1' }}>
          <summary className="label" style={{ cursor: 'pointer' }}>
            SEO i wersja angielska
          </summary>
          <div className="grid grid-2 mt-2" style={{ '--gap': '12px' } as React.CSSProperties}>
            <label className="field">
              <span className="label">Adres (/menu/…/adres)</span>
              <input className="input" value={p.slug || ''} onChange={(e) => set('slug', e.target.value)} disabled={isNew} placeholder={isNew ? 'utworzy się z nazwy' : ''} />
            </label>
            <label className="field">
              <span className="label">Tytuł SEO</span>
              <input className="input" value={p.seoTitle || ''} onChange={(e) => set('seoTitle', e.target.value)} />
            </label>
            <label className="field" style={{ gridColumn: '1 / -1' }}>
              <span className="label">Opis SEO</span>
              <input className="input" value={p.seoDescription || ''} onChange={(e) => set('seoDescription', e.target.value)} />
            </label>
            <label className="field" style={{ gridColumn: '1 / -1' }}>
              <span className="label">Opis po angielsku</span>
              <textarea className="textarea" value={p.descriptionEn || ''} onChange={(e) => set('descriptionEn', e.target.value)} />
            </label>
          </div>
        </details>
      </div>
    </Modal>
  );
}

// Szybki widok dla kuchni/kasy: „chwilowo brak” w wybranym lokalu bez edycji menu
export function AvailabilityManager() {
  const { location, locations } = useAdmin();
  const { data, setData } = useData<{ items: P[] }>('/api/admin/products');
  const [q, setQ] = useState('');
  const { run } = useRun();
  const items = (data?.items || []).filter((p) => (!p.location || p.location === 'all' || p.location === location) && p.available !== false && (!q || p.name.toLowerCase().includes(q.toLowerCase())));
  const out = items.filter((p) => (p.unavailableAt || []).includes(location));
  async function toggle(p: P) {
    const has = (p.unavailableAt || []).includes(location);
    const unavailableAt = has ? (p.unavailableAt || []).filter((x) => x !== location) : [...(p.unavailableAt || []), location];
    setData((d) => (d ? { items: d.items.map((x) => (x._id === p._id ? { ...x, unavailableAt } : x)) } : d));
    await run(() => api(`/api/admin/products/${p._id}`, { method: 'PATCH', body: { unavailableAt } }), has ? `${p.name} znów dostępny` : `${p.name}: chwilowo brak`);
  }
  return (
    <>
      <PageHead title="Dostępność produktów" sub={`Lokal: ${locations.find((l) => l.slug === location)?.city}. Produkt oznaczony „brak” jest widoczny w menu, ale nie da się go zamówić.`} />
      {out.length ? (
        <div className="alert alert-warn mb-2 small">
          Chwilowo brak: {out.map((p) => p.name).join(', ')}
        </div>
      ) : null}
      <input className="input mb-2" placeholder="Szukaj" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 320 }} />
      <div className="grid grid-auto" style={{ '--min': '260px', '--gap': '8px' } as React.CSSProperties}>
        {items.map((p) => {
          const off = (p.unavailableAt || []).includes(location);
          return (
            <button key={p._id} className="card card-sm row between" style={{ textAlign: 'left', cursor: 'pointer', borderColor: off ? 'var(--danger)' : undefined, background: off ? 'var(--danger-soft)' : undefined }} onClick={() => toggle(p)}>
              <span className="small">{p.name}</span>
              <span className={`badge ${off ? 'badge-danger' : 'badge-mint'}`}>{off ? 'brak' : 'jest'}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

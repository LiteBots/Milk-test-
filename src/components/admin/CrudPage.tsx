'use client';

import { useMemo, useState } from 'react';
import { api } from '@/lib/client';
import { PageHead, ImageInput, TagsInput, useData, useRun, Empty, fmtDate } from './ui';
import { Modal } from '../Modal';
import { Icon } from '../Icon';

export interface Field {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'select' | 'checkbox' | 'date' | 'datetime' | 'image' | 'tags' | 'multiselect' | 'password' | 'markdown';
  options?: { value: string; label: string }[];
  hint?: string;
  required?: boolean;
  nullable?: boolean;
  half?: boolean;
  readOnlyOnEdit?: boolean;
}

export interface Column {
  key: string;
  label: string;
  render?: (item: Record<string, unknown>) => React.ReactNode;
  num?: boolean;
}

type Item = Record<string, unknown> & { _id: string };

function toInput(f: Field, v: unknown) {
  if (v === undefined || v === null) return f.type === 'checkbox' ? false : f.type === 'tags' || f.type === 'multiselect' ? [] : '';
  if (f.type === 'date') return String(v).slice(0, 10);
  if (f.type === 'datetime') {
    const d = new Date(String(v));
    if (isNaN(d.getTime())) return '';
    const off = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - off).toISOString().slice(0, 16);
  }
  return v;
}

function fromInput(f: Field, v: unknown) {
  if (f.type === 'number') return v === '' || v === null ? (f.nullable ? null : undefined) : Number(v);
  if (f.type === 'datetime' || f.type === 'date') return v ? new Date(String(v)).toISOString() : null;
  if (f.type === 'password') return v || undefined;
  if (f.type === 'select' && f.nullable && v === '') return null;
  return v;
}

export function CrudPage({
  entity,
  title,
  sub,
  fields,
  columns,
  defaults = {},
  canCreate = true,
  canDelete = true,
  searchPlaceholder = 'Szukaj…',
  query = '',
  extraActions,
  rowActions
}: {
  entity: string;
  title: string;
  sub?: React.ReactNode;
  fields: Field[];
  columns: Column[];
  defaults?: Record<string, unknown>;
  canCreate?: boolean;
  canDelete?: boolean;
  searchPlaceholder?: string;
  query?: string;
  extraActions?: React.ReactNode;
  rowActions?: (item: Item, reload: () => void) => React.ReactNode;
}) {
  const [q, setQ] = useState('');
  const url = useMemo(() => `/api/admin/crud/${entity}?q=${encodeURIComponent(q)}${query ? `&${query}` : ''}`, [entity, q, query]);
  const { data, error, loading, reload } = useData<{ items: Item[]; total: number }>(url, [url]);
  const [editing, setEditing] = useState<Item | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const { busy, run } = useRun();

  const open = (item: Item | null) => {
    setIsNew(!item);
    const base = item || ({ _id: '', ...defaults } as Item);
    setEditing(base);
    setForm(Object.fromEntries(fields.map((f) => [f.name, toInput(f, base[f.name] ?? defaults[f.name])])));
  };

  async function save() {
    const body: Record<string, unknown> = {};
    for (const f of fields) {
      if (!isNew && f.readOnlyOnEdit) continue;
      const v = fromInput(f, form[f.name]);
      if (v !== undefined) body[f.name] = v;
    }
    const ok = await run(async () => {
      if (isNew) await api(`/api/admin/crud/${entity}`, { body });
      else await api(`/api/admin/crud/${entity}/${editing!._id}`, { method: 'PATCH', body });
      return true;
    }, 'Zapisano.');
    if (ok) {
      setEditing(null);
      reload();
    }
  }

  async function remove(item: Item) {
    if (!confirm('Usunąć ten wpis?')) return;
    const ok = await run(() => api(`/api/admin/crud/${entity}/${item._id}`, { method: 'DELETE' }), 'Usunięto.');
    if (ok) {
      setEditing(null);
      reload();
    }
  }

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <>
      <PageHead
        title={title}
        sub={sub}
        actions={
          <>
            {extraActions}
            {canCreate ? (
              <button className="btn btn-accent btn-sm" onClick={() => open(null)}>
                <Icon name="plus" size={16} /> Dodaj
              </button>
            ) : null}
          </>
        }
      />
      <div className="toolbar">
        <input className="input" placeholder={searchPlaceholder} value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 320 }} />
        <span className="small muted">{data ? `${data.total} pozycji` : loading ? 'Ładowanie…' : ''}</span>
      </div>
      {error ? <p className="alert alert-error">{error}</p> : null}
      {data && !data.items.length ? (
        <Empty>Brak wpisów.{canCreate ? ' Dodaj pierwszy przyciskiem „Dodaj”.' : ''}</Empty>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c.key} className={c.num ? 'num' : undefined}>
                    {c.label}
                  </th>
                ))}
                {rowActions ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {(data?.items || []).map((it) => (
                <tr key={it._id} className="clickable" onClick={() => open(it)}>
                  {columns.map((c) => (
                    <td key={c.key} className={c.num ? 'num' : undefined}>
                      {c.render ? c.render(it) : typeof it[c.key] === 'boolean' ? (it[c.key] ? '✓' : '—') : String(it[c.key] ?? '—')}
                    </td>
                  ))}
                  {rowActions ? <td onClick={(e) => e.stopPropagation()}>{rowActions(it, reload)}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={isNew ? `Nowy wpis – ${title}` : `Edycja – ${title}`}
        wide={fields.length > 6}
        footer={
          <div className="row between">
            {!isNew && canDelete ? (
              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => remove(editing!)} disabled={busy}>
                <Icon name="trash" size={14} /> Usuń
              </button>
            ) : (
              <span />
            )}
            <div className="row">
              <button className="btn btn-ghost" onClick={() => setEditing(null)}>
                Anuluj
              </button>
              <button className="btn btn-accent" onClick={save} disabled={busy}>
                {busy ? <span className="spinner" /> : null} Zapisz
              </button>
            </div>
          </div>
        }
      >
        <div className="grid grid-2" style={{ '--gap': '14px' } as React.CSSProperties}>
          {fields.map((f) => {
            const v = form[f.name];
            const full = !f.half && ['textarea', 'markdown', 'image', 'tags', 'multiselect'].includes(f.type);
            const disabled = !isNew && f.readOnlyOnEdit;
            return (
              <div key={f.name} style={full || (!f.half && f.type !== 'checkbox' && fields.length <= 4) ? { gridColumn: '1 / -1' } : undefined}>
                {f.type === 'checkbox' ? (
                  <label className="check" style={{ marginTop: 26 }}>
                    <input type="checkbox" checked={!!v} onChange={(e) => set(f.name, e.target.checked)} disabled={disabled} />
                    <span>{f.label}</span>
                  </label>
                ) : f.type === 'image' ? (
                  <ImageInput label={f.label} value={String(v || '')} onChange={(x) => set(f.name, x)} />
                ) : (
                  <label className="field">
                    <span className="label">
                      {f.label}
                      {f.required ? ' *' : ''}
                    </span>
                    {f.type === 'textarea' || f.type === 'markdown' ? (
                      <textarea className="textarea" style={f.type === 'markdown' ? { minHeight: 320, fontFamily: 'ui-monospace, monospace', fontSize: '.88rem' } : undefined} value={String(v ?? '')} onChange={(e) => set(f.name, e.target.value)} disabled={disabled} />
                    ) : f.type === 'select' ? (
                      <select className="select" value={String(v ?? '')} onChange={(e) => set(f.name, e.target.value)} disabled={disabled}>
                        {f.nullable ? <option value="">—</option> : null}
                        {(f.options || []).map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    ) : f.type === 'tags' ? (
                      <TagsInput value={(v as string[]) || []} onChange={(x) => set(f.name, x)} />
                    ) : f.type === 'multiselect' ? (
                      <div className="chips" style={{ flexWrap: 'wrap' }}>
                        {(f.options || []).map((o) => {
                          const arr = (v as string[]) || [];
                          return (
                            <button type="button" key={o.value} className="chip" aria-pressed={arr.includes(o.value)} onClick={() => set(f.name, arr.includes(o.value) ? arr.filter((x) => x !== o.value) : [...arr, o.value])}>
                              {o.label}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <input
                        className="input"
                        type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : f.type === 'datetime' ? 'datetime-local' : f.type === 'password' ? 'password' : 'text'}
                        step={f.type === 'number' ? 'any' : undefined}
                        value={String(v ?? '')}
                        onChange={(e) => set(f.name, e.target.value)}
                        disabled={disabled}
                        autoComplete={f.type === 'password' ? 'new-password' : undefined}
                      />
                    )}
                    {f.hint ? <span className="hint">{f.hint}</span> : null}
                  </label>
                )}
              </div>
            );
          })}
        </div>
        {!isNew && editing?.createdAt ? <p className="tiny muted mt-2">Utworzono: {fmtDate(editing.createdAt as string)}</p> : null}
      </Modal>
    </>
  );
}

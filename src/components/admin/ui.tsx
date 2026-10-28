'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/client';
import { Icon } from '../Icon';
import { useToast } from '../Toast';

export function PageHead({ title, sub, actions }: { title: string; sub?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="row between mb-3" style={{ alignItems: 'flex-end' }}>
      <div>
        <h1 className="admin-title">{title}</h1>
        {sub ? <p className="small muted" style={{ margin: '2px 0 0' }}>{sub}</p> : null}
      </div>
      {actions ? <div className="row">{actions}</div> : null}
    </div>
  );
}

export function Kpi({ label, value, delta, hint }: { label: string; value: React.ReactNode; delta?: number | null; hint?: string }) {
  return (
    <div className="kpi">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {delta != null && Number.isFinite(delta) ? (
        <div className={`delta ${delta >= 0 ? 'up' : 'down'}`}>
          {delta >= 0 ? '▲' : '▼'} {Math.abs(Math.round(delta))}% {hint || ''}
        </div>
      ) : hint ? (
        <div className="tiny muted">{hint}</div>
      ) : null}
    </div>
  );
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: string; disabled?: boolean }) {
  return (
    <label className="row" style={{ '--gap': '10px', cursor: disabled ? 'not-allowed' : 'pointer' } as React.CSSProperties}>
      <span className="switch">
        <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
        <span />
      </span>
      {label ? <span className="small">{label}</span> : null}
    </label>
  );
}

// Pobieranie danych z API panelu z odświeżaniem
export function useData<T>(url: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    try {
      setData(await api<T>(url));
      setError('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, ...deps]);
  useEffect(() => {
    load();
  }, [load]);
  return { data, error, loading, reload: load, setData };
}

// Akcja z komunikatem o sukcesie/błędzie
export function useRun() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = useCallback(
    async <R,>(fn: () => Promise<R>, success?: string): Promise<R | undefined> => {
      setBusy(true);
      try {
        const r = await fn();
        if (success) toast(success, 'success');
        return r;
      } catch (e) {
        toast((e as Error).message, 'error');
        return undefined;
      } finally {
        setBusy(false);
      }
    },
    [toast]
  );
  return { busy, run };
}

export function ImageInput({ value, onChange, label = 'Zdjęcie' }: { value: string; onChange: (v: string) => void; label?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const { busy, run } = useRun();
  return (
    <div className="field">
      <span className="label">{label}</span>
      <div className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
        <div style={{ width: 72, height: 72, borderRadius: 12, overflow: 'hidden', background: 'var(--cream-2)', flex: 'none' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {value ? <img src={value} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
        </div>
        <div className="stack" style={{ '--gap': '6px', flex: 1 } as React.CSSProperties}>
          <input className="input" value={value} onChange={(e) => onChange(e.target.value)} placeholder="Adres zdjęcia lub wgraj plik" />
          <div className="row">
            <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => ref.current?.click()}>
              {busy ? <span className="spinner" /> : <Icon name="download" size={14} style={{ transform: 'rotate(180deg)' }} />} Wgraj
            </button>
            {value ? (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange('')}>
                Usuń
              </button>
            ) : null}
          </div>
        </div>
      </div>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          const fd = new FormData();
          fd.append('file', f);
          run(async () => {
            const r = await api<{ url: string }>('/api/admin/upload', { body: fd });
            onChange(r.url);
          }, 'Zdjęcie wgrane.');
          e.target.value = '';
        }}
      />
    </div>
  );
}

export function TagsInput({ value, onChange, options, placeholder }: { value: string[]; onChange: (v: string[]) => void; options?: readonly string[]; placeholder?: string }) {
  const [txt, setTxt] = useState('');
  if (options) {
    return (
      <div className="chips" style={{ flexWrap: 'wrap' }}>
        {options.map((o) => (
          <button type="button" key={o} className="chip" aria-pressed={value.includes(o)} onClick={() => onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o])}>
            {o}
          </button>
        ))}
      </div>
    );
  }
  return (
    <div className="stack" style={{ '--gap': '6px' } as React.CSSProperties}>
      <div className="chips" style={{ flexWrap: 'wrap' }}>
        {value.map((v) => (
          <button type="button" key={v} className="chip" aria-pressed onClick={() => onChange(value.filter((x) => x !== v))}>
            {v} ×
          </button>
        ))}
      </div>
      <input
        className="input"
        value={txt}
        placeholder={placeholder || 'Wpisz i naciśnij Enter'}
        onChange={(e) => setTxt(e.target.value)}
        onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
          if (e.key === 'Enter' && txt.trim()) {
            e.preventDefault();
            if (!value.includes(txt.trim())) onChange([...value, txt.trim()]);
            setTxt('');
          }
        }}
      />
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="empty card">{children}</div>;
}

export const fmtDate = (d: string | Date | null | undefined, withTime = true) =>
  d ? new Date(d).toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw', day: '2-digit', month: '2-digit', year: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}) }) : '—';

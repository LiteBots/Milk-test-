'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/client';
import { formatPLN } from '@/lib/util';
import { PageHead, useRun } from './ui';
import { useAdmin } from './AdminContext';
import { Icon } from '../Icon';

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  points: number;
  walletBalance: number;
  tier: string;
  stamps: number;
  stampRewardsAvailable: number;
  rewards: { code: string; name: string }[];
  birthday: string;
}

type BarcodeDetectorT = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };

// Skaner QR z kamery (BarcodeDetector – Chrome/Android/Safari 17+); gdy brak, wpis ręczny lub czytnik USB
function QrScanner({ onCode, onClose }: { onCode: (c: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    let stream: MediaStream | null = null;
    let stop = false;
    const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => BarcodeDetectorT }).BarcodeDetector;
    if (!BD) {
      setErr('Ta przeglądarka nie obsługuje skanowania kamerą. Użyj czytnika lub wpisz telefon.');
      return;
    }
    const det = new BD({ formats: ['qr_code'] });
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then(async (s) => {
        stream = s;
        if (!video.current) return;
        video.current.srcObject = s;
        await video.current.play();
        const loop = async () => {
          if (stop || !video.current) return;
          try {
            const codes = await det.detect(video.current);
            if (codes[0]?.rawValue) {
              onCode(codes[0].rawValue);
              return;
            }
          } catch {
            /* klatka bez kodu */
          }
          requestAnimationFrame(loop);
        };
        loop();
      })
      .catch(() => setErr('Brak dostępu do kamery.'));
    return () => {
      stop = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onCode]);
  return (
    <div className="card stack">
      {err ? <p className="alert alert-warn">{err}</p> : <video ref={video} playsInline muted style={{ width: '100%', borderRadius: 16, background: '#000', maxHeight: 360 }} />}
      <button className="btn btn-ghost btn-sm" onClick={onClose}>
        Zamknij kamerę
      </button>
    </div>
  );
}

export function Pos() {
  const { session } = useAdmin();
  const [query, setQuery] = useState('');
  const [c, setC] = useState<Customer | null>(null);
  const [scan, setScan] = useState(false);
  const [amount, setAmount] = useState('');
  const [stamps, setStamps] = useState(0);
  const [walletAmt, setWalletAmt] = useState('');
  const [adj, setAdj] = useState({ delta: '', reason: '' });
  const [gc, setGc] = useState({ code: '', amount: '' });
  const [gcInfo, setGcInfo] = useState<{ code: string; balance: number; status: string; validTo: string } | null>(null);
  const { busy, run } = useRun();
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => input.current?.focus(), []);

  const lookup = async (q: string) => {
    const r = await run(() => api<{ customer: Customer }>('/api/admin/pos/lookup', { body: { query: q } }));
    if (r) {
      setC(r.customer);
      setQuery('');
      setScan(false);
    }
  };

  const post = async (url: string, body: Record<string, unknown>) => {
    const r = await run(() => api<{ customer: Customer; message: string }>(url, { body }), undefined);
    if (r) {
      setC(r.customer);
      return r.message;
    }
  };

  return (
    <>
      <PageHead title="Kasa i Milk ID" sub="Zeskanuj kod QR z aplikacji klienta albo wpisz telefon / e-mail." />
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)', gap: 16 } as React.CSSProperties}>
        <div className="stack">
          <form
            className="row card card-sm"
            style={{ flexWrap: 'nowrap' }}
            onSubmit={(e) => {
              e.preventDefault();
              if (query.trim()) lookup(query.trim());
            }}
          >
            <input ref={input} className="input" placeholder="Kod QR (czytnik), telefon lub e-mail" value={query} onChange={(e) => setQuery(e.target.value)} />
            <button className="btn" disabled={busy}>
              Szukaj
            </button>
            <button type="button" className="btn btn-ghost btn-icon" onClick={() => setScan(true)} aria-label="Skanuj kamerą">
              <Icon name="scan" />
            </button>
          </form>
          {scan ? <QrScanner onCode={lookup} onClose={() => setScan(false)} /> : null}

          {c ? (
            <div className="card stack">
              <div className="row between">
                <div>
                  <strong style={{ fontSize: '1.2rem' }}>{c.name}</strong>
                  <div className="small muted">
                    {c.phone} · {c.email}
                  </div>
                </div>
                <Link href={`/admin/klienci/${c.id}`} className="btn btn-ghost btn-sm">
                  Karta klienta
                </Link>
              </div>
              <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' } as React.CSSProperties}>
                <div className="kpi">
                  <div className="label">Punkty</div>
                  <div className="value">{c.points}</div>
                </div>
                <div className="kpi">
                  <div className="label">Portfel</div>
                  <div className="value" style={{ fontSize: '1.3rem' }}>{formatPLN(c.walletBalance)}</div>
                </div>
                <div className="kpi">
                  <div className="label">Poziom</div>
                  <div className="value" style={{ fontSize: '1.3rem', textTransform: 'capitalize' }}>{c.tier}</div>
                </div>
                <div className="kpi">
                  <div className="label">Pieczątki</div>
                  <div className="value" style={{ fontSize: '1.3rem' }}>{c.stamps}</div>
                </div>
              </div>
              {c.birthday && c.birthday.slice(0, 2) === String(new Date().getMonth() + 1).padStart(2, '0') ? <p className="alert alert-info small">🎂 Klient ma urodziny w tym miesiącu ({c.birthday.split('-').reverse().join('.')}).</p> : null}

              <form
                className="card card-sm card-flat stack"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const a = Number(amount.replace(',', '.'));
                  if (!(a > 0)) return;
                  const m = await post('/api/admin/pos/points', { userId: c.id, amountSpent: a, stamps });
                  if (m) {
                    setAmount('');
                    setStamps(0);
                  }
                }}
              >
                <strong className="small">Zakup w lokalu – nalicz punkty</strong>
                <div className="row" style={{ flexWrap: 'nowrap' }}>
                  <input className="input" inputMode="decimal" placeholder="Kwota z paragonu (zł)" value={amount} onChange={(e) => setAmount(e.target.value)} />
                  <label className="row small" style={{ flexWrap: 'nowrap', '--gap': '6px' } as React.CSSProperties}>
                    Shake’i:
                    <input className="input" type="number" min={0} max={20} value={stamps} onChange={(e) => setStamps(Number(e.target.value))} style={{ width: 70 }} />
                  </label>
                  <button className="btn btn-accent" disabled={busy}>
                    Nalicz
                  </button>
                </div>
              </form>

              <div className="card card-sm card-flat stack">
                <strong className="small">Portfel</strong>
                <div className="row" style={{ flexWrap: 'nowrap' }}>
                  <input className="input" inputMode="decimal" placeholder="Kwota (zł)" value={walletAmt} onChange={(e) => setWalletAmt(e.target.value)} />
                  <button
                    className="btn"
                    disabled={busy}
                    onClick={async () => {
                      const a = Number(walletAmt.replace(',', '.'));
                      if (a > 0 && (await post('/api/admin/pos/wallet', { userId: c.id, delta: -a, reason: 'Płatność w lokalu' }))) setWalletAmt('');
                    }}
                  >
                    Pobierz
                  </button>
                  <button
                    className="btn btn-ghost"
                    disabled={busy}
                    onClick={async () => {
                      const a = Number(walletAmt.replace(',', '.'));
                      if (a > 0 && confirm(`Przyjąć ${a} zł gotówką na portfel klienta?`) && (await post('/api/admin/pos/wallet', { userId: c.id, delta: a, reason: 'Wpłata gotówkowa w lokalu' }))) setWalletAmt('');
                    }}
                  >
                    Doładuj
                  </button>
                </div>
              </div>

              {c.stampRewardsAvailable || c.rewards.length ? (
                <div className="card card-sm card-flat stack">
                  <strong className="small">Nagrody do wydania</strong>
                  <div className="chips" style={{ flexWrap: 'wrap' }}>
                    {c.stampRewardsAvailable ? (
                      <button className="chip" onClick={() => confirm('Wydać darmowego shake’a?') && post('/api/admin/pos/reward', { userId: c.id, code: 'stamp' })}>
                        🎁 Darmowy shake ({c.stampRewardsAvailable})
                      </button>
                    ) : null}
                    {c.rewards.map((r) => (
                      <button key={r.code} className="chip" onClick={() => confirm(`Wydać: ${r.name}?`) && post('/api/admin/pos/reward', { userId: c.id, code: r.code })}>
                        {r.name} · {r.code}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {['owner', 'manager'].includes(session.role) ? (
                <details className="small">
                  <summary style={{ cursor: 'pointer' }}>Ręczna korekta punktów</summary>
                  <div className="row mt-1" style={{ flexWrap: 'nowrap' }}>
                    <input className="input" type="number" placeholder="+/- pkt" value={adj.delta} onChange={(e) => setAdj({ ...adj, delta: e.target.value })} style={{ width: 110 }} />
                    <input className="input" placeholder="Powód" value={adj.reason} onChange={(e) => setAdj({ ...adj, reason: e.target.value })} />
                    <button
                      className="btn btn-ghost"
                      disabled={busy || !Number(adj.delta)}
                      onClick={async () => {
                        if (await post('/api/admin/pos/points', { userId: c.id, delta: Math.round(Number(adj.delta)), reason: adj.reason || 'Korekta' })) setAdj({ delta: '', reason: '' });
                      }}
                    >
                      Zapisz
                    </button>
                  </div>
                </details>
              ) : null}
            </div>
          ) : (
            <div className="empty card">Wyszukaj klienta, aby naliczyć punkty, przyjąć płatność portfelem lub wydać nagrodę.</div>
          )}
        </div>

        <div className="card stack">
          <strong>Karta podarunkowa</strong>
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <input className="input" placeholder="MILK-XXXX-XXXX" value={gc.code} onChange={(e) => setGc({ ...gc, code: e.target.value.toUpperCase() })} />
            <button
              className="btn btn-ghost"
              disabled={busy || gc.code.length < 6}
              onClick={async () => {
                const r = await run(() => api<{ card: { code: string; balance: number; status: string; validTo: string } }>('/api/admin/pos/giftcard', { body: { code: gc.code } }));
                if (r) setGcInfo(r.card);
              }}
            >
              Sprawdź
            </button>
          </div>
          {gcInfo ? (
            <div className="stack" style={{ '--gap': '8px' } as React.CSSProperties}>
              <p className="small" style={{ margin: 0 }}>
                Saldo: <strong>{formatPLN(gcInfo.balance)}</strong> · {gcInfo.status === 'active' ? 'aktywna' : gcInfo.status === 'redeemed' ? 'wykorzystana' : gcInfo.status} · ważna do {new Date(gcInfo.validTo).toLocaleDateString('pl-PL')}
              </p>
              {gcInfo.status === 'active' ? (
                <div className="row" style={{ flexWrap: 'nowrap' }}>
                  <input className="input" inputMode="decimal" placeholder="Kwota do pobrania" value={gc.amount} onChange={(e) => setGc({ ...gc, amount: e.target.value })} />
                  <button
                    className="btn"
                    disabled={busy}
                    onClick={async () => {
                      const a = Number(gc.amount.replace(',', '.'));
                      if (!(a > 0)) return;
                      const r = await run(() => api<{ card: { code: string; balance: number; status: string; validTo: string }; message: string }>('/api/admin/pos/giftcard', { body: { code: gc.code, amount: a } }), 'Pobrano z karty.');
                      if (r) {
                        setGcInfo(r.card);
                        setGc({ ...gc, amount: '' });
                      }
                    }}
                  >
                    Pobierz
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
          <hr className="divider" />
          <p className="small muted" style={{ margin: 0 }}>
            Tip: czytnik kodów QR podłączony przez USB działa jak klawiatura – zeskanuj kod przy aktywnym polu wyszukiwania.
          </p>
        </div>
      </div>
    </>
  );
}

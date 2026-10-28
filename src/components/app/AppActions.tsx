'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/client';
import { useToast } from '../Toast';
import { formatPLN } from '@/lib/util';
import { Icon } from '../Icon';

// Przyciski akcji w aplikacji (wymiana punktów, nagrody, doładowania, karty, rezerwacje)
function useAction() {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<string | void>) => {
    setBusy(true);
    try {
      const msg = await fn();
      if (msg) toast(msg, 'success');
      router.refresh();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
}

export function VoucherButton({ cost, value, disabled }: { cost: number; value: number; disabled: boolean }) {
  const { busy, run } = useAction();
  return (
    <button
      className="btn btn-soft btn-sm"
      disabled={disabled || busy}
      onClick={() =>
        confirm(`Wymienić ${cost} pkt na ${formatPLN(value)} w portfelu?`) &&
        run(async () => (await api<{ message: string }>('/api/me/voucher', { body: { cost } })).message)
      }
    >
      {cost} pkt → {formatPLN(value)}
    </button>
  );
}

export function ClaimRewardButton({ rewardId, cost, disabled }: { rewardId: string; cost: number; disabled: boolean }) {
  const { busy, run } = useAction();
  return (
    <button className="btn btn-accent btn-sm" disabled={disabled || busy} onClick={() => run(async () => (await api<{ message: string }>('/api/me/reward', { body: { rewardId } })).message)}>
      Odbierz za {cost} pkt
    </button>
  );
}

export function TopupForm({ bonuses, enabled }: { bonuses: { min: number; bonusPercent: number }[]; enabled: boolean }) {
  const toast = useToast();
  const [amount, setAmount] = useState(100);
  const [busy, setBusy] = useState(false);
  const bonus = [...bonuses].sort((a, b) => b.min - a.min).find((b) => amount >= b.min);
  if (!enabled) return <p className="small muted">Doładowania online są chwilowo niedostępne – doładujesz portfel przy kasie.</p>;
  return (
    <div className="stack" style={{ '--gap': '10px' } as React.CSSProperties}>
      <div className="chips" style={{ flexWrap: 'wrap' }}>
        {[50, 100, 150, 200, 300].map((a) => (
          <button key={a} className="chip" aria-pressed={amount === a} onClick={() => setAmount(a)}>
            {a} zł
          </button>
        ))}
      </div>
      {bonus ? <p className="small" style={{ margin: 0, color: 'var(--mint-ink)' }}>+{bonus.bonusPercent}% bonusu = {formatPLN(amount * (1 + bonus.bonusPercent / 100))} w portfelu</p> : null}
      <button
        className="btn btn-accent"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const r = await api<{ redirectUrl: string }>('/api/me/topup', { body: { amount } });
            window.location.href = r.redirectUrl;
          } catch (e) {
            toast((e as Error).message, 'error');
            setBusy(false);
          }
        }}
      >
        {busy ? <span className="spinner" /> : <Icon name="wallet" size={16} />} Doładuj {formatPLN(amount)}
      </button>
    </div>
  );
}

export function GiftRedeemForm() {
  const { busy, run } = useAction();
  const [code, setCode] = useState('');
  return (
    <form
      className="row"
      style={{ flexWrap: 'nowrap' }}
      onSubmit={(e) => {
        e.preventDefault();
        run(async () => {
          const r = await api<{ message: string }>('/api/me/giftcard', { body: { code } });
          setCode('');
          return r.message;
        });
      }}
    >
      <input className="input" placeholder="MILK-XXXX-XXXX" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} aria-label="Kod karty podarunkowej" />
      <button className="btn btn-ghost" disabled={busy || code.length < 6}>
        Dodaj
      </button>
    </form>
  );
}

export function CancelReservationButton({ id }: { id: string }) {
  const { busy, run } = useAction();
  return (
    <button
      className="btn btn-ghost btn-sm"
      disabled={busy}
      onClick={() => confirm('Odwołać rezerwację?') && run(async () => (await api<{ message: string }>('/api/me/reservations', { method: 'DELETE', body: { id } })).message)}
    >
      Odwołaj
    </button>
  );
}

export function ShareReferral({ code, url }: { code: string; url: string }) {
  const toast = useToast();
  const text = `Dołącz do MilkMi z moim kodem ${code} – dostaniesz punkty na start!`;
  return (
    <div className="stack" style={{ '--gap': '10px' } as React.CSSProperties}>
      <div className="card card-flat center" style={{ fontSize: '1.8rem', fontWeight: 700, letterSpacing: '.2em' }}>{code}</div>
      <button
        className="btn btn-accent"
        onClick={async () => {
          if (navigator.share) {
            try {
              await navigator.share({ title: 'MilkMi', text, url });
            } catch {
              /* anulowane */
            }
          } else {
            await navigator.clipboard.writeText(`${text} ${url}`);
            toast('Skopiowano link polecający.', 'success');
          }
        }}
      >
        <Icon name="send" size={16} /> Wyślij znajomym
      </button>
    </div>
  );
}

'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { StaffSession } from '@/lib/auth';

export interface LiveCounts {
  pendingOrders: number;
  activeOrders: number;
  pendingReservations: number;
  newInquiries: number;
  lowStock: number;
  lowRatings: number;
  ordersEnabled: boolean;
  pausedUntil: string | null;
  latestOrder: { id: string; number: string; at: string } | null;
}

interface Ctx {
  session: StaffSession;
  location: string;
  setLocation: (l: string) => void;
  locations: { slug: string; city: string }[];
  live: LiveCounts | null;
  refreshLive: () => void;
  soundOn: boolean;
  setSoundOn: (v: boolean) => void;
}

const AdminCtx = createContext<Ctx | null>(null);
export const useAdmin = () => useContext(AdminCtx)!;

// Krótki sygnał dźwiękowy (Web Audio) – bez plików, działa na tablecie w kuchni
export function beep() {
  try {
    const Ac = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ac();
    [0, 0.25, 0.5].forEach((t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.2);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.22);
    });
    setTimeout(() => ctx.close(), 1200);
  } catch {
    /* brak audio */
  }
}

export function AdminProvider({ session, locations, children }: { session: StaffSession; locations: { slug: string; city: string }[]; children: React.ReactNode }) {
  const allowed = locations.filter((l) => session.role === 'owner' || !session.locations.length || session.locations.includes(l.slug));
  const [location, setLoc] = useState(allowed[0]?.slug || 'slupsk');
  const [live, setLive] = useState<LiveCounts | null>(null);
  const [soundOn, setSound] = useState(true);
  const lastPending = useRef<number | null>(null);
  const lastLatest = useRef<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('mm_admin_loc');
      if (saved && allowed.some((l) => l.slug === saved)) setLoc(saved);
      setSound(localStorage.getItem('mm_admin_sound') !== 'off');
    } catch {
      /* ignoruj */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLocation = (l: string) => {
    setLoc(l);
    lastPending.current = null;
    lastLatest.current = null;
    try {
      localStorage.setItem('mm_admin_loc', l);
    } catch {
      /* ignoruj */
    }
  };
  const setSoundOn = (v: boolean) => {
    setSound(v);
    try {
      localStorage.setItem('mm_admin_sound', v ? 'on' : 'off');
    } catch {
      /* ignoruj */
    }
  };

  const refreshLive = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/live?location=${location}`, { cache: 'no-store' });
      if (res.status === 401) {
        window.location.href = `/admin/logowanie?next=${encodeURIComponent(location ? window.location.pathname : '/admin')}`;
        return;
      }
      const d = (await res.json()) as LiveCounts & { success: boolean };
      if (!d.success) return;
      setLive(d);
      const latestId = d.latestOrder?.id || null;
      if (lastLatest.current !== null && latestId && latestId !== lastLatest.current && soundOn) {
        beep();
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(`Nowe zamówienie ${d.latestOrder!.number}`, { body: 'Otwórz panel zamówień', tag: 'mm-order' });
        }
      }
      lastLatest.current = latestId || '';
      lastPending.current = d.pendingOrders;
      document.title = d.pendingOrders ? `(${d.pendingOrders}) Panel MilkMi` : 'Panel MilkMi';
    } catch {
      /* chwilowy brak sieci */
    }
  }, [location, soundOn]);

  useEffect(() => {
    refreshLive();
    const id = setInterval(refreshLive, 8000);
    return () => clearInterval(id);
  }, [refreshLive]);

  return <AdminCtx.Provider value={{ session, location, setLocation, locations: allowed, live, refreshLive, soundOn, setSoundOn }}>{children}</AdminCtx.Provider>;
}

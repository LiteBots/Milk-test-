'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { useToast } from '../Toast';
import { Icon } from '../Icon';

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

// Włączanie powiadomień push (status zamówienia, nowości) – dla klientów i obsługi
export function PushToggle({ audience = 'user', compact = false }: { audience?: 'user' | 'staff'; compact?: boolean }) {
  const toast = useToast();
  const [state, setState] = useState<'unsupported' | 'off' | 'on' | 'denied' | 'loading'>('loading');
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    if (!key || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return setState('unsupported');
    if (Notification.permission === 'denied') return setState('denied');
    navigator.serviceWorker.ready.then((reg) => reg.pushManager.getSubscription()).then((s) => setState(s ? 'on' : 'off')).catch(() => setState('off'));
  }, [key]);

  async function enable() {
    try {
      setState('loading');
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return setState(perm === 'denied' ? 'denied' : 'off');
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key!) });
      await api('/api/me/push', { body: { subscription: sub.toJSON(), audience } });
      setState('on');
      toast('Powiadomienia włączone.', 'success');
    } catch (e) {
      setState('off');
      toast((e as Error).message || 'Nie udało się włączyć powiadomień.', 'error');
    }
  }
  async function disable() {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await api('/api/me/push', { method: 'DELETE', body: { endpoint: sub.endpoint } }).catch(() => {});
      await sub.unsubscribe();
    }
    setState('off');
  }

  if (state === 'unsupported') return compact ? null : <p className="small muted">Ta przeglądarka nie obsługuje powiadomień push.</p>;
  if (state === 'denied') return compact ? null : <p className="small muted">Powiadomienia są zablokowane w ustawieniach przeglądarki.</p>;
  if (compact && state === 'on') return null;
  return (
    <button className={`btn ${state === 'on' ? 'btn-ghost' : 'btn-soft'} btn-sm`} onClick={state === 'on' ? disable : enable} disabled={state === 'loading'}>
      <Icon name="bell" size={16} /> {state === 'on' ? 'Wyłącz powiadomienia' : 'Włącz powiadomienia'}
    </button>
  );
}

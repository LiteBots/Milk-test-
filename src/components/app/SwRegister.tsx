'use client';

import { useEffect } from 'react';
import { track } from '@/lib/track';

// Rejestracja service workera (PWA, powiadomienia push, praca offline)
export function SwRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
    const onInstalled = () => track('Instalacja PWA');
    window.addEventListener('appinstalled', onInstalled);
    return () => window.removeEventListener('appinstalled', onInstalled);
  }, []);
  return null;
}

'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Icon } from '../Icon';
import { useAdmin } from './AdminContext';
import { can, type Permission } from '@/lib/permissions';
import { api } from '@/lib/client';
import { useToast } from '../Toast';

const NAV: { group: string; items: { href: string; label: string; icon: string; perm?: Permission; count?: 'orders' | 'reservations' | 'inquiries' | 'stock' }[] }[] = [
  {
    group: 'Operacje',
    items: [
      { href: '/admin', label: 'Pulpit', icon: 'home' },
      { href: '/admin/zamowienia', label: 'Zamówienia', icon: 'bag', perm: 'orders', count: 'orders' },
      { href: '/admin/kasa', label: 'Kasa i Milk ID', icon: 'scan', perm: 'pos' },
      { href: '/admin/rezerwacje', label: 'Rezerwacje', icon: 'calendar', perm: 'reservations', count: 'reservations' },
      { href: '/admin/zapytania', label: 'Zapytania', icon: 'mail', perm: 'customers', count: 'inquiries' }
    ]
  },
  {
    group: 'Menu',
    items: [
      { href: '/admin/menu', label: 'Produkty', icon: 'cup', perm: 'menu' },
      { href: '/admin/menu/dostepnosc', label: 'Dostępność', icon: 'pause', perm: 'inventory' },
      { href: '/admin/menu/kategorie', label: 'Kategorie', icon: 'layers', perm: 'menu' },
      { href: '/admin/menu/dodatki', label: 'Sugestie w koszyku', icon: 'plus', perm: 'menu' },
      { href: '/admin/magazyn', label: 'Magazyn', icon: 'box', perm: 'inventory', count: 'stock' }
    ]
  },
  {
    group: 'Klienci',
    items: [
      { href: '/admin/klienci', label: 'Baza klientów', icon: 'users', perm: 'customers' },
      { href: '/admin/lojalnosc', label: 'Program lojalnościowy', icon: 'star', perm: 'loyalty' },
      { href: '/admin/opinie', label: 'Opinie', icon: 'heart', perm: 'customers' }
    ]
  },
  {
    group: 'Marketing',
    items: [
      { href: '/admin/marketing', label: 'Kody rabatowe', icon: 'percent', perm: 'marketing' },
      { href: '/admin/marketing/kampanie', label: 'Kampanie push i e-mail', icon: 'megaphone', perm: 'marketing' },
      { href: '/admin/marketing/banery', label: 'Paski informacyjne', icon: 'info', perm: 'marketing' },
      { href: '/admin/karty', label: 'Karty podarunkowe', icon: 'gift', perm: 'marketing' }
    ]
  },
  {
    group: 'Strona i SEO',
    items: [
      { href: '/admin/tresci', label: 'Treści strony', icon: 'file', perm: 'content' },
      { href: '/admin/tresci/blog', label: 'Blog', icon: 'edit', perm: 'content' },
      { href: '/admin/tresci/faq', label: 'FAQ', icon: 'clipboard', perm: 'content' },
      { href: '/admin/tresci/seo', label: 'SEO – meta tagi', icon: 'globe', perm: 'content' }
    ]
  },
  {
    group: 'Firma',
    items: [
      { href: '/admin/raporty', label: 'Raporty', icon: 'chart', perm: 'reports' },
      { href: '/admin/zespol', label: 'Zespół i grafik', icon: 'briefcase', perm: 'team' },
      { href: '/admin/zespol/zegar', label: 'Czas pracy (PIN)', icon: 'timer', perm: 'timeclock' },
      { href: '/admin/ustawienia', label: 'Lokale i godziny', icon: 'settings', perm: 'settings' },
      { href: '/admin/ustawienia/konta', label: 'Konta i role', icon: 'shield', perm: 'staff' },
      { href: '/admin/ustawienia/dziennik', label: 'Dziennik zmian', icon: 'history', perm: 'audit' }
    ]
  }
];

const ROLE: Record<string, string> = { owner: 'Właściciel', manager: 'Kierownik', cashier: 'Kasjer', kitchen: 'Kuchnia' };

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { session, location, setLocation, locations, live, refreshLive, soundOn, setSoundOn } = useAdmin();
  const path = usePathname() || '/admin';
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);

  const counts: Record<string, number> = {
    orders: live?.pendingOrders || 0,
    reservations: live?.pendingReservations || 0,
    inquiries: live?.newInquiries || 0,
    stock: live?.lowStock || 0
  };
  const active = (href: string) => (href === '/admin' ? path === '/admin' : path === href || (path.startsWith(`${href}/`) && !NAV.some((g) => g.items.some((i) => i.href !== href && path.startsWith(i.href) && i.href.length > href.length))));
  const paused = live?.pausedUntil ? new Date(live.pausedUntil) : null;

  async function togglePause() {
    try {
      if (paused) await api(`/api/admin/locations/${location}/pause`, { body: { minutes: 0 } });
      else {
        const m = prompt('Wstrzymać zamówienia online na ile minut?', '30');
        if (!m) return;
        await api(`/api/admin/locations/${location}/pause`, { body: { minutes: Math.min(480, Math.max(5, Number(m) || 30)) } });
      }
      refreshLive();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }

  return (
    <div className="admin-shell">
      <aside className="admin-side" data-open={open}>
        <Link href="/admin" className="logo admin-logo" style={{ padding: '4px 12px 8px' }}>
          <span>
            MilkMi<span className="dot-accent">.</span>
          </span>
          <span className="admin-tag">panel</span>
        </Link>
        {NAV.map((g) => {
          const items = g.items.filter((i) => !i.perm || can(session, i.perm));
          if (!items.length) return null;
          return (
            <div key={g.group}>
              <div className="group">{g.group}</div>
              {items.map((i) => (
                <Link key={i.href} href={i.href} aria-current={active(i.href) ? 'page' : undefined}>
                  <Icon name={i.icon} size={18} /> {i.label}
                  {i.count && counts[i.count] ? <span className="count">{counts[i.count]}</span> : null}
                </Link>
              ))}
            </div>
          );
        })}
        <div style={{ marginTop: 'auto', padding: '16px 12px 4px' }} className="stack">
          <div className="small">
            <strong>{session.name}</strong>
            <div className="tiny muted">{ROLE[session.role]}</div>
          </div>
          <div className="row">
            <Link href="/admin/ustawienia/profil" className="btn btn-ghost btn-sm">
              <Icon name="lock" size={14} /> 2FA
            </Link>
            <button
              className="btn btn-ghost btn-sm"
              onClick={async () => {
                await api('/api/admin/auth/logout', { method: 'POST' }).catch(() => {});
                router.replace('/admin/logowanie');
              }}
            >
              <Icon name="logout" size={14} /> Wyloguj
            </button>
          </div>
        </div>
      </aside>
      {open ? <div className="overlay" style={{ zIndex: 99, background: 'rgba(0,0,0,.3)' }} onClick={() => setOpen(false)} /> : null}
      <div className="admin-main">
        <div className="admin-top">
          <button className="btn btn-ghost btn-icon btn-sm admin-mobile-toggle" onClick={() => setOpen(true)} aria-label="Menu">
            <Icon name="menu" size={18} />
          </button>
          {locations.length > 1 ? (
            <div className="segmented" role="group" aria-label="Lokal">
              {locations.map((l) => (
                <button key={l.slug} aria-pressed={location === l.slug} onClick={() => setLocation(l.slug)}>
                  {l.city}
                </button>
              ))}
            </div>
          ) : (
            <strong>{locations[0]?.city}</strong>
          )}
          <div className="row" style={{ marginLeft: 'auto' }}>
            {live ? (
              live.ordersEnabled ? (
                paused ? (
                  <button className="btn btn-sm" style={{ '--bg': 'var(--amber-ink)' } as React.CSSProperties} onClick={togglePause} disabled={session.role === 'kitchen'}>
                    <Icon name="play" size={14} /> Pauza do {paused.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })} – wznów
                  </button>
                ) : (
                  <button className="btn btn-ghost btn-sm" onClick={togglePause} disabled={session.role === 'kitchen'}>
                    <span className="dot status-open" /> Przyjmujemy zamówienia · <Icon name="pause" size={14} /> Pauza
                  </button>
                )
              ) : (
                <span className="badge badge-danger">Zamówienia online wyłączone</span>
              )
            ) : null}
            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setSoundOn(!soundOn)} aria-label={soundOn ? 'Wycisz alarmy' : 'Włącz dźwięk'} title={soundOn ? 'Dźwięk włączony' : 'Dźwięk wyłączony'}>
              <Icon name="bell" size={16} style={{ opacity: soundOn ? 1 : 0.35 }} />
            </button>
          </div>
        </div>
        <div className="admin-content">{children}</div>
      </div>
    </div>
  );
}

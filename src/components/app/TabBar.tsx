'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '../Icon';

const TABS = [
  { href: '/app', label: 'Start', icon: 'home' },
  { href: '/app/zamow', label: 'Zamów', icon: 'bag' },
  { href: '/app/nagrody', label: 'Nagrody', icon: 'gift' },
  { href: '/app/portfel', label: 'Portfel', icon: 'wallet' },
  { href: '/app/konto', label: 'Konto', icon: 'user' }
];

export function TabBar() {
  const path = usePathname() || '/app';
  if (path.startsWith('/app/logowanie') || path.startsWith('/app/rejestracja')) return null;
  return (
    <nav className="tabbar" aria-label="Nawigacja aplikacji">
      {TABS.map((t) => {
        const active = t.href === '/app' ? path === '/app' : path.startsWith(t.href) || (t.href === '/app/konto' && /\/app\/(zamowienia|rezerwacje|kupony|polec|ustawienia)/.test(path));
        return (
          <Link key={t.href} href={t.href} aria-current={active ? 'page' : undefined}>
            <Icon name={t.icon} size={22} />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

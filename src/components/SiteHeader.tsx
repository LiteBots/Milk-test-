'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Icon } from './Icon';
import { dictionary, type Lang } from '@/lib/i18n';

// Odpowiednik strony w drugim języku (hreflang) – tylko dla stron, które mają wersję EN
function alternate(pathname: string): string | null {
  if (pathname === '/') return '/en';
  if (pathname === '/en') return '/';
  if (pathname === '/menu') return '/en/menu';
  if (pathname === '/en/menu') return '/menu';
  let m = pathname.match(/^\/lokale\/([a-z-]+)$/);
  if (m) return `/en/locations/${m[1]}`;
  m = pathname.match(/^\/en\/locations\/([a-z-]+)$/);
  if (m) return `/lokale/${m[1]}`;
  return null;
}

export function SiteHeader({ lang = 'pl', banner }: { lang?: Lang; banner?: { text: string; link: string; backgroundColor: string } | null }) {
  const d = dictionary(lang);
  const pathname = usePathname() || '/';
  const altHref = alternate(pathname);
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
  }, [open]);

  const base = lang === 'en' ? '/en' : '';
  const links =
    lang === 'en'
      ? [
          { href: '/en/menu', label: d.nav_menu },
          { href: '/en#locations', label: d.nav_locations },
          { href: '/rezerwacja', label: d.nav_reservation },
          { href: '/aplikacja', label: d.nav_app }
        ]
      : [
          { href: '/menu', label: d.nav_menu },
          { href: '/lokale/slupsk', label: d.nav_locations },
          { href: '/rezerwacja', label: d.nav_reservation },
          { href: '/aplikacja', label: d.nav_app },
          { href: '/imprezy', label: d.nav_events },
          { href: '/karty-podarunkowe', label: d.nav_gift }
        ];
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href.split('#')[0]) && href.split('#')[0] !== base);

  return (
    <>
      {banner ? (
        <div className="announcement" style={{ background: banner.backgroundColor }}>
          {banner.link ? <Link href={banner.link}>{banner.text}</Link> : banner.text}
        </div>
      ) : null}
      <header className="site-header" data-scrolled={scrolled}>
        <div className="container inner">
          <Link href={base || '/'} className="logo" aria-label="Milkshakebar – strona główna">
            Milkshakebar<span className="dot-accent">.</span>
          </Link>
          <nav className="nav" aria-label="Główna nawigacja">
            {links.map((l) => (
              <Link key={l.href} href={l.href} aria-current={isActive(l.href) ? 'page' : undefined}>
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="header-actions">
            {altHref ? (
              <Link href={altHref} className="lang-switch hide-mobile" hrefLang={lang === 'pl' ? 'en' : 'pl'} aria-label={d.lang_switch_label}>
                {d.lang_switch}
              </Link>
            ) : null}
            <Link href="/app" className="btn btn-ghost btn-sm hide-mobile">
              <Icon name="user" size={16} /> MilkMi
            </Link>
            <Link href="/zamow" className="btn btn-accent btn-sm">
              <Icon name="bag" size={16} /> {d.order_online}
            </Link>
            <button className="btn btn-ghost btn-icon menu-toggle" aria-label="Menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
              <Icon name={open ? 'x' : 'menu'} />
            </button>
          </div>
        </div>
      </header>
      <div className="mobile-nav" data-open={open} aria-hidden={!open}>
        {links.map((l) => (
          <Link key={l.href} href={l.href}>
            {l.label}
          </Link>
        ))}
        <Link href="/o-nas">{d.nav_about}</Link>
        <Link href="/kontakt">{d.nav_contact}</Link>
        <Link href="/app">Aplikacja MilkMi</Link>
        {altHref ? <Link href={altHref}>{d.lang_switch_label}</Link> : null}
      </div>
    </>
  );
}

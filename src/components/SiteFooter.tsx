import Link from 'next/link';
import { Icon } from './Icon';
import { BRAND } from '@/lib/site';
import { dictionary, type Lang } from '@/lib/i18n';
import type { PublicLocation } from '@/lib/data';

export function SiteFooter({ lang = 'pl', locations }: { lang?: Lang; locations: PublicLocation[] }) {
  const d = dictionary(lang);
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div className="stack" style={{ '--gap': '14px' } as React.CSSProperties}>
            <Link href={lang === 'en' ? '/en' : '/'} className="logo">
              Milkshakebar<span className="dot-accent">.</span>
            </Link>
            <p className="small" style={{ maxWidth: 320 }}>
              {lang === 'en'
                ? 'Thick milkshakes, Black Angus burgers, breakfasts and coffee in Słupsk and Rowy.'
                : 'Gęste shake’i, burgery Black Angus, śniadania i kawa w Słupsku i Rowach.'}
            </p>
            <div className="row">
              <a href={BRAND.instagram} className="social" aria-label="Instagram" rel="noopener" target="_blank">
                <Icon name="instagram" size={18} />
              </a>
              <a href={BRAND.facebook} className="social" aria-label="Facebook" rel="noopener" target="_blank">
                <Icon name="facebook" size={18} />
              </a>
            </div>
          </div>
          <div>
            <h4>{d.nav_locations}</h4>
            <ul className="footer-list">
              {locations.map((l) => (
                <li key={l.slug}>
                  <Link href={lang === 'en' ? `/en/locations/${l.slug}` : `/lokale/${l.slug}`}>
                    <strong style={{ color: 'var(--ink)', fontWeight: 800 }}>{l.city}</strong>
                    <br />
                    <span className="small">
                      {l.street}, {l.postalCode} {l.city}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4>{d.guests}</h4>
            <ul className="footer-list">
              <li><Link href={lang === 'en' ? '/en/menu' : '/menu'}>{d.nav_menu}</Link></li>
              <li><Link href="/zamow">{d.order_online}</Link></li>
              <li><Link href="/rezerwacja">{d.nav_reservation}</Link></li>
              <li><Link href="/aplikacja">{d.nav_app}</Link></li>
              <li><Link href="/karty-podarunkowe">{d.nav_gift}</Link></li>
              <li><Link href="/faq">{d.nav_faq}</Link></li>
            </ul>
          </div>
          <div>
            <h4>{d.company}</h4>
            <ul className="footer-list">
              <li><Link href="/o-nas">{d.nav_about}</Link></li>
              <li><Link href="/imprezy">{d.nav_events}</Link></li>
              <li><Link href="/blog">{d.nav_blog}</Link></li>
              <li><Link href="/praca">{d.nav_jobs}</Link></li>
              <li><Link href="/kontakt">{d.nav_contact}</Link></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <span>
            © {year} {BRAND.legalName} · NIP {BRAND.nip}
          </span>
          <span className="row" style={{ '--gap': '16px' } as React.CSSProperties}>
            <Link href="/regulamin">{d.legal_terms}</Link>
            <Link href="/polityka-prywatnosci">{d.legal_privacy}</Link>
          </span>
        </div>
      </div>
    </footer>
  );
}

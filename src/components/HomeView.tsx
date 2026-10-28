import Link from 'next/link';
import { Icon } from './Icon';
import { Img } from './Img';
import { ProductCard } from './ProductCard';
import { OpenStatus } from './OpenStatus';
import { HoursTable } from './HoursTable';
import { ReservationForm } from './ReservationForm';
import { dictionary, type Lang } from '@/lib/i18n';
import type { MenuProduct, PublicCategory, PublicLocation } from '@/lib/data';
import type { ISiteContent } from '@/lib/models/content';

export function HomeView({
  lang,
  content,
  bestsellers,
  categories,
  locations,
  categoryOf,
  shakeCount
}: {
  lang: Lang;
  content: ISiteContent;
  bestsellers: MenuProduct[];
  categories: PublicCategory[];
  locations: PublicLocation[];
  categoryOf: Record<string, string>; // categoryId → slug kategorii głównej
  shakeCount: number;
}) {
  const d = dictionary(lang);
  const en = lang === 'en';
  const main = locations.find((l) => l.slug === 'slupsk') || locations[0];
  const tops = categories.filter((c) => !c.parentKey);
  const menuBase = en ? '/en/menu' : '/menu';

  return (
    <>
      {/* HERO */}
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <p className="eyebrow">{en ? 'Słupsk · Rowy' : 'Słupsk · Rowy'}</p>
            <h1 className="display mt-2">{gradientLast(en ? 'The art of the perfect milkshake.' : content.heroTitle)}</h1>
            <p className="lead mt-3">
              {en
                ? 'Thick milkshakes made with real ice cream, Black Angus burgers and breakfasts. In Słupsk all year round, in Rowy during the summer.'
                : content.heroSubtitle}
            </p>
            <div className="hero-actions">
              <Link href="/zamow" className="btn btn-accent btn-lg">
                <Icon name="bag" size={18} /> {en ? 'Order for pickup' : 'Zamów z odbiorem'}
              </Link>
              <Link href="/rezerwacja" className="btn btn-ghost btn-lg">
                <Icon name="calendar" size={18} /> {d.book_table}
              </Link>
            </div>
            <div className="hero-meta">
              <div>
                <strong>{Math.max(shakeCount, 1)}+</strong>
                <span className="small muted">{en ? 'shake flavours' : 'smaków shake’ów'}</span>
              </div>
              <div>
                <strong>{locations.length}</strong>
                <span className="small muted">{en ? (locations.length === 1 ? 'location' : 'locations') : locations.length === 1 ? 'lokal' : 'lokale'}</span>
              </div>
              <div>
                <strong>1 pkt</strong>
                <span className="small muted">{en ? 'for every 10 zł in the app' : 'za każde 10 zł w aplikacji'}</span>
              </div>
            </div>
          </div>
          <div className="hero-media">
            <Img src={content.heroImage} alt={content.heroImageAlt || 'Milkshake'} priority sizes="(max-width: 860px) 100vw, 50vw" />
            {main ? (
              <div className="hero-status">
                {main.city}: <OpenStatus location={main} />
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* BESTSELLERY */}
      {bestsellers.length ? (
        <section className="section" style={{ paddingTop: 0 }}>
          <div className="container">
            <div className="section-head">
              <div>
                <p className="eyebrow">{d.bestsellers}</p>
                <h2 className="h2 mt-1">{d.bestsellers_lead}</h2>
              </div>
              <Link href={menuBase} className="link-arrow">
                {d.full_menu} <Icon name="arrow-right" size={18} />
              </Link>
            </div>
            <div className="grid grid-3">
              {bestsellers.map((p, i) => (
                <ProductCard key={p.id} p={p} lang={lang} priority={i < 3} href={`${en ? '/menu' : '/menu'}/${categoryOf[p.categoryId] || 'inne'}/${p.slug}`} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* KATEGORIE */}
      <section className="section" style={{ background: 'var(--paper)', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
        <div className="container">
          <div className="section-head">
            <h2 className="h2">{d.categories}</h2>
          </div>
          <div className="grid grid-4">
            {tops.map((c) => (
              <Link key={c.key} href={`${menuBase}${en ? `#${c.slug}` : `/${c.slug}`}`} className={`cat-tile ${c.imageUrl ? 'has-img' : 'no-img'}`}>
                {c.imageUrl ? <Img src={c.imageUrl} alt="" sizes="(max-width: 620px) 100vw, 25vw" /> : null}
                <span className="h3">{en && c.nameEn ? c.nameEn : c.name}</span>
                <span className="small" style={{ opacity: 0.8 }}>
                  {en ? 'See dishes' : 'Zobacz pozycje'} →
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* LOKALE */}
      <section className="section" id="locations">
        <div className="container">
          <div className="section-head">
            <div>
              <p className="eyebrow">{d.our_locations}</p>
              <h2 className="h2 mt-1">{en ? 'Find us in Słupsk and Rowy' : 'Znajdziesz nas w Słupsku i w Rowach'}</h2>
            </div>
          </div>
          <div className="grid grid-2">
            {locations.map((l) => (
              <article key={l.slug} className="loc-card">
                <iframe
                  className="map"
                  title={`Mapa – ${l.name}`}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  src={`https://www.google.com/maps?q=${encodeURIComponent(`${l.street}, ${l.postalCode} ${l.city}`)}&output=embed`}
                />
                <div style={{ padding: 24 }} className="stack">
                  <div className="row between">
                    <h3 className="h3 serif" style={{ fontSize: '1.6rem' }}>
                      {l.city}
                    </h3>
                    {l.seasonal ? <span className="badge badge-sky">{d.seasonal}</span> : null}
                  </div>
                  <OpenStatus location={l} className="small" />
                  <p className="muted small" style={{ margin: 0 }}>
                    {l.street}, {l.postalCode} {l.city}
                    {l.phone ? (
                      <>
                        {' · '}
                        <a href={`tel:${l.phone.replace(/\s/g, '')}`}>{l.phone}</a>
                      </>
                    ) : null}
                  </p>
                  <HoursTable location={l} lang={lang} />
                  <div className="row">
                    <a href={l.mapsUrl} target="_blank" rel="noopener" className="btn btn-ghost btn-sm">
                      <Icon name="pin" size={16} /> {d.open_map}
                    </a>
                    <Link href={en ? `/en/locations/${l.slug}` : `/lokale/${l.slug}`} className="btn btn-soft btn-sm">
                      {en ? 'Details' : 'Szczegóły lokalu'}
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* APLIKACJA */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="card card-dark" style={{ padding: 'clamp(28px, 5vw, 56px)', borderRadius: 32 }}>
            <div className="split">
              <div>
                <p className="eyebrow" style={{ color: 'var(--rose)' }}>
                  MilkMi
                </p>
                <h2 className="h2 mt-1">{en ? 'Collect points with every order' : content.appTitle}</h2>
                <p className="mt-2" style={{ color: 'rgba(255,255,255,.75)', maxWidth: '48ch' }}>
                  {en
                    ? 'Earn points with every order, get every 10th shake free and pay with your wallet. No app store needed – it works in your browser.'
                    : content.appText}
                </p>
                <div className="hero-actions">
                  <Link href="/app" className="btn btn-accent">
                    {d.app_cta}
                  </Link>
                  <Link href="/aplikacja" className="btn btn-ghost" style={{ color: '#fff', borderColor: 'rgba(255,255,255,.3)' }}>
                    {en ? 'How it works' : 'Jak to działa'}
                  </Link>
                </div>
              </div>
              <div className="grid" style={{ '--gap': '14px' } as React.CSSProperties}>
                {[
                  { icon: 'star', t: en ? 'Points & tiers' : 'Punkty i poziomy', d: en ? 'Milk, Silver and Gold – the more you visit, the faster you earn.' : 'Milk, Silver i Gold – im częściej wpadasz, tym szybciej zbierasz.' },
                  { icon: 'cup', t: en ? 'Every 10th shake free' : 'Co 10. shake gratis', d: en ? 'A digital stamp card that never gets lost.' : 'Cyfrowa karta z pieczątkami, która się nie zgubi.' },
                  { icon: 'wallet', t: en ? 'Wallet & gift cards' : 'Portfel i karty podarunkowe', d: en ? 'Top up with a bonus and pay with one tap.' : 'Doładuj z bonusem i płać jednym dotknięciem.' }
                ].map((f) => (
                  <div key={f.t} className="feature">
                    <div className="feature-icon" style={{ background: 'rgba(255,255,255,.08)', color: 'var(--rose)' }}>
                      <Icon name={f.icon} />
                    </div>
                    <div>
                      <strong>{f.t}</strong>
                      <p className="small" style={{ margin: 0, color: 'rgba(255,255,255,.65)' }}>
                        {f.d}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* OPINIE */}
      {content.testimonials?.length || content.googleReviewsUrl ? (
        <section className="section" style={{ paddingTop: 0 }}>
          <div className="container">
            <div className="section-head">
              <div>
                <p className="eyebrow">{d.reviews}</p>
                {content.googleRating ? (
                  <h2 className="h2 mt-1">
                    {content.googleRating.toFixed(1).replace('.', ',')} / 5{' '}
                    <span className="muted" style={{ fontSize: '1rem', fontFamily: 'var(--font-sans)' }}>
                      {content.googleReviewsCount ? `· ${content.googleReviewsCount} ${en ? 'Google reviews' : 'opinii w Google'}` : ''}
                    </span>
                  </h2>
                ) : null}
              </div>
              {content.googleReviewsUrl ? (
                <a href={content.googleReviewsUrl} target="_blank" rel="noopener" className="link-arrow">
                  {en ? 'Read on Google' : 'Zobacz w Google'} <Icon name="external" size={16} />
                </a>
              ) : null}
            </div>
            <div className="grid grid-3">
              {(content.testimonials || []).slice(0, 3).map((t, i) => (
                <figure key={i} className="quote-card" style={{ margin: 0 }}>
                  <div className="stars" aria-label={`${t.rating} na 5`}>
                    {'★'.repeat(Math.round(t.rating || 5))}
                  </div>
                  <blockquote style={{ margin: 0 }}>{t.text}</blockquote>
                  <figcaption className="small muted">
                    {t.author} · {t.source || 'Google'}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* INSTAGRAM */}
      {content.instagramImages?.length ? (
        <section className="section" style={{ paddingTop: 0 }}>
          <div className="container">
            <div className="section-head">
              <h2 className="h2">@milkshake_slupsk</h2>
              <a href="https://www.instagram.com/milkshake_slupsk" target="_blank" rel="noopener" className="link-arrow">
                Instagram <Icon name="external" size={16} />
              </a>
            </div>
            <div className="ig-grid">
              {content.instagramImages.slice(0, 6).map((src, i) => (
                <div key={i} style={{ position: 'relative' }}>
                  <Img src={src} alt="" sizes="(max-width: 760px) 33vw, 16vw" />
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* REZERWACJA */}
      <section className="section" style={{ background: 'var(--paper)', borderTop: '1px solid var(--line)' }}>
        <div className="container split">
          <div>
            <p className="eyebrow">{d.nav_reservation}</p>
            <h2 className="h2 mt-1">{en ? 'Save a table for you' : 'Zarezerwuj stolik w minutę'}</h2>
            <p className="lead mt-2">
              {en
                ? 'Pick a location, time and number of guests. We confirm by text message.'
                : 'Wybierz lokal, godzinę i liczbę osób. Potwierdzenie wyślemy SMS-em – zwykle w kilka minut.'}
            </p>
            <p className="small muted mt-2">
              {en ? 'Larger party or a birthday?' : 'Większa grupa albo urodziny?'}{' '}
              <Link href="/imprezy" className="link">
                {en ? 'Ask about events' : 'Zapytaj o imprezę'}
              </Link>
            </p>
          </div>
          <div className="card">
            <ReservationForm locations={locations.filter((l) => l.reservationsEnabled)} compact />
          </div>
        </div>
      </section>
    </>
  );
}

/** Ostatnie słowo nagłówka w pomarańczowym gradiencie – jak na dotychczasowej stronie. */
function gradientLast(title: string) {
  const t = (title || '').trim();
  const i = t.lastIndexOf(' ');
  if (i < 0) return <span className="text-gradient">{t}</span>;
  return (
    <>
      {t.slice(0, i + 1)}
      <span className="text-gradient">{t.slice(i + 1)}</span>
    </>
  );
}

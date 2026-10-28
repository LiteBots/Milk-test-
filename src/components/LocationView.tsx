import Link from 'next/link';
import { Icon } from './Icon';
import { Img } from './Img';
import { OpenStatus } from './OpenStatus';
import { HoursTable } from './HoursTable';
import { ProductCard } from './ProductCard';
import type { MenuProduct, PublicLocation } from '@/lib/data';
import type { Lang } from '@/lib/i18n';

export function LocationView({ l, lang, bestsellers, productHref, others }: { l: PublicLocation; lang: Lang; bestsellers: MenuProduct[]; productHref: Record<string, string>; others: PublicLocation[] }) {
  const en = lang === 'en';
  return (
    <>
      <section className="container" style={{ paddingTop: 36 }}>
        <div className="split" style={{ alignItems: 'start' }}>
          <div className="stack" style={{ '--gap': '18px' } as React.CSSProperties}>
            <p className="eyebrow">{l.seasonal ? (en ? 'Seasonal location' : 'Lokal sezonowy') : en ? 'Open all year' : 'Czynny cały rok'}</p>
            <h1 className="h1">{en ? `Milkshakebar ${l.city}` : l.name}</h1>
            <OpenStatus location={l} />
            <p className="lead">{en ? `Milkshakes, burgers and desserts at ${l.street}, ${l.city}.` : l.description}</p>
            {l.seasonNote ? <p className="alert alert-info">{l.seasonNote}</p> : null}
            <div className="stack" style={{ '--gap': '8px' } as React.CSSProperties}>
              <span className="row small">
                <Icon name="pin" size={18} /> {l.street}, {l.postalCode} {l.city}
              </span>
              {l.phone ? (
                <a className="row small" href={`tel:${l.phone.replace(/\s/g, '')}`}>
                  <Icon name="phone" size={18} /> {l.phone}
                </a>
              ) : null}
              {l.email ? (
                <a className="row small" href={`mailto:${l.email}`}>
                  <Icon name="mail" size={18} /> {l.email}
                </a>
              ) : null}
            </div>
            <div className="row">
              {l.ordersEnabled ? (
                <Link href={`/zamow?lokal=${l.slug}`} className="btn btn-accent">
                  <Icon name="bag" size={18} /> {en ? 'Order for pickup' : 'Zamów z odbiorem'}
                </Link>
              ) : null}
              {l.reservationsEnabled ? (
                <Link href={`/rezerwacja?lokal=${l.slug}`} className="btn btn-ghost">
                  <Icon name="calendar" size={18} /> {en ? 'Book a table' : 'Zarezerwuj stolik'}
                </Link>
              ) : null}
              <a href={l.mapsUrl} target="_blank" rel="noopener" className="btn btn-ghost">
                <Icon name="map" size={18} /> {en ? 'Directions' : 'Wyznacz trasę'}
              </a>
            </div>
          </div>
          <div className="card">
            <h2 className="h3 mb-2">{en ? 'Opening hours' : 'Godziny otwarcia'}</h2>
            <HoursTable location={l} lang={lang} />
          </div>
        </div>
      </section>

      <section className="container section-sm">
        <div className="loc-card">
          <iframe
            className="map"
            style={{ aspectRatio: '21 / 9', minHeight: 280 }}
            title={`Mapa – ${l.name}`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            src={`https://www.google.com/maps?q=${encodeURIComponent(`${l.street}, ${l.postalCode} ${l.city}`)}&output=embed`}
          />
        </div>
      </section>

      {l.directions ? (
        <section className="container section-sm">
          <div className="prose">
            <h2>{en ? 'Getting here' : 'Jak do nas trafić'}</h2>
            {l.directions.split(/\n{2,}/).map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
        </section>
      ) : null}

      {l.photos?.length ? (
        <section className="container section-sm">
          <div className="ig-grid">
            {l.photos.slice(0, 6).map((src, i) => (
              <div key={i} style={{ position: 'relative' }}>
                <Img src={src} alt={`${l.name} – zdjęcie ${i + 1}`} sizes="33vw" />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {bestsellers.length ? (
        <section className="container section">
          <div className="section-head">
            <h2 className="h2">{en ? `Popular in ${l.city}` : `Najczęściej zamawiane w ${l.city === 'Rowy' ? 'Rowach' : 'Słupsku'}`}</h2>
            <Link href={en ? '/en/menu' : `/menu?lokal=${l.slug}`} className="link-arrow">
              {en ? 'Full menu' : 'Pełne menu'} <Icon name="arrow-right" size={18} />
            </Link>
          </div>
          <div className="grid grid-3">
            {bestsellers.map((p) => (
              <ProductCard key={p.id} p={p} lang={lang} href={productHref[p.id]} />
            ))}
          </div>
        </section>
      ) : null}

      {others.length ? (
        <section className="container section-sm" style={{ paddingBottom: 80 }}>
          <p className="muted">
            {en ? 'See also:' : 'Zobacz też:'}{' '}
            {others.map((o) => (
              <Link key={o.slug} href={en ? `/en/locations/${o.slug}` : `/lokale/${o.slug}`} className="link">
                {o.name}
              </Link>
            ))}
          </p>
        </section>
      ) : null}
    </>
  );
}

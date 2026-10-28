import type { Metadata } from 'next';
import { BRAND, SITE_URL, absUrl } from './site';
import { getSeoOverride, type MenuProduct, type PublicCategory, type PublicLocation } from './data';
import { SCHEMA_DAYS, WEEK_ORDER } from './hours';

interface MetaInput {
  path: string;
  title: string;
  description: string;
  image?: string;
  noindex?: boolean;
  enPath?: string | null; // odpowiednik angielski (hreflang)
  plPath?: string | null;
  type?: 'website' | 'article';
}

// Metadane strony + nadpisania ustawione w panelu (Treści → SEO)
export async function buildMetadata(m: MetaInput): Promise<Metadata> {
  const o = await getSeoOverride(m.path);
  const title = o?.title || m.title;
  const description = o?.description || m.description;
  const image = o?.ogImage || m.image || '/og-default.png';
  const languages: Record<string, string> = {};
  if (m.enPath) {
    languages['pl-PL'] = absUrl(m.path);
    languages['en'] = absUrl(m.enPath);
    languages['x-default'] = absUrl(m.path);
  } else if (m.plPath) {
    languages['pl-PL'] = absUrl(m.plPath);
    languages['en'] = absUrl(m.path);
    languages['x-default'] = absUrl(m.plPath);
  }
  return {
    title,
    description,
    alternates: { canonical: absUrl(m.path), ...(Object.keys(languages).length ? { languages } : {}) },
    robots: o?.noindex || m.noindex ? { index: false, follow: true } : undefined,
    openGraph: {
      title,
      description,
      url: absUrl(m.path),
      siteName: BRAND.name,
      locale: m.plPath ? 'en_GB' : 'pl_PL',
      type: m.type || 'website',
      images: [{ url: image.startsWith('http') ? image : absUrl(image), width: 1200, height: 630, alt: title }]
    },
    twitter: { card: 'summary_large_image', title, description, images: [image.startsWith('http') ? image : absUrl(image)] }
  };
}

const img = (u?: string) => (u ? (u.startsWith('http') ? u : absUrl(u)) : undefined);

export function organizationLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organization`,
    name: BRAND.name,
    legalName: BRAND.legalName,
    url: SITE_URL,
    logo: absUrl('/icons/icon-512.png'),
    taxID: BRAND.nip,
    sameAs: [BRAND.instagram, BRAND.facebook]
  };
}

export function websiteLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    url: SITE_URL,
    name: BRAND.name,
    inLanguage: 'pl-PL',
    publisher: { '@id': `${SITE_URL}/#organization` }
  };
}

export function localBusinessLd(l: PublicLocation, rating?: { value: number; count: number } | null) {
  return {
    '@context': 'https://schema.org',
    '@type': ['CafeOrCoffeeShop', 'Restaurant'],
    '@id': absUrl(`/lokale/${l.slug}#place`),
    name: l.name,
    url: absUrl(`/lokale/${l.slug}`),
    image: (l.photos || []).map(img).filter(Boolean).length ? l.photos.map(img) : [absUrl('/og-default.png')],
    telephone: l.phone || undefined,
    email: l.email || undefined,
    priceRange: '$$',
    servesCuisine: ['Desery', 'Milkshake', 'Burgery', 'Kawa', 'Śniadania'],
    acceptsReservations: l.reservationsEnabled ? 'True' : 'False',
    hasMenu: absUrl(`/menu?lokal=${l.slug}`),
    address: {
      '@type': 'PostalAddress',
      streetAddress: l.street,
      addressLocality: l.city,
      postalCode: l.postalCode,
      addressCountry: 'PL'
    },
    geo: l.lat && l.lng ? { '@type': 'GeoCoordinates', latitude: l.lat, longitude: l.lng } : undefined,
    openingHoursSpecification: WEEK_ORDER.filter((k) => l.schedule?.[k]?.isOpen).map((k) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: `https://schema.org/${SCHEMA_DAYS[k]}`,
      opens: l.schedule[k].from,
      closes: l.schedule[k].to
    })),
    potentialAction: [
      l.ordersEnabled
        ? {
            '@type': 'OrderAction',
            target: { '@type': 'EntryPoint', urlTemplate: absUrl(`/zamow?lokal=${l.slug}`), actionPlatform: ['http://schema.org/DesktopWebPlatform', 'http://schema.org/MobileWebPlatform'] },
            deliveryMethod: 'http://purl.org/goodrelations/v1#DeliveryModePickUp'
          }
        : null,
      l.reservationsEnabled
        ? { '@type': 'ReserveAction', target: { '@type': 'EntryPoint', urlTemplate: absUrl(`/rezerwacja?lokal=${l.slug}`) }, result: { '@type': 'FoodEstablishmentReservation', name: 'Rezerwacja stolika' } }
        : null
    ].filter(Boolean),
    aggregateRating: rating && rating.count > 0 ? { '@type': 'AggregateRating', ratingValue: rating.value, reviewCount: rating.count } : undefined,
    parentOrganization: { '@id': `${SITE_URL}/#organization` }
  };
}

export function menuLd(categories: PublicCategory[], products: MenuProduct[], location: string) {
  const tops = categories.filter((c) => !c.parentKey);
  return {
    '@context': 'https://schema.org',
    '@type': 'Menu',
    '@id': absUrl(`/menu#${location}`),
    name: `Menu ${BRAND.name}`,
    inLanguage: 'pl-PL',
    hasMenuSection: tops
      .map((top) => {
        const keys = [top.key, ...categories.filter((c) => c.parentKey === top.key).map((c) => c.key)];
        const items = products.filter((p) => keys.includes(p.categoryId));
        if (!items.length) return null;
        return {
          '@type': 'MenuSection',
          name: top.name,
          url: absUrl(`/menu/${top.slug}`),
          hasMenuItem: items.map((p) => menuItemLd(p, top.slug))
        };
      })
      .filter(Boolean)
  };
}

export function menuItemLd(p: MenuProduct, categorySlug: string) {
  return {
    '@type': 'MenuItem',
    name: p.name,
    description: p.description || undefined,
    url: absUrl(`/menu/${categorySlug}/${p.slug}`),
    image: img(p.imageUrl),
    nutrition: p.kcal ? { '@type': 'NutritionInformation', calories: `${p.kcal} kcal` } : undefined,
    suitableForDiet: [
      p.tags.includes('weganskie') ? 'https://schema.org/VeganDiet' : null,
      p.tags.includes('wege') ? 'https://schema.org/VegetarianDiet' : null,
      p.tags.includes('bez-laktozy') ? 'https://schema.org/LowLactoseDiet' : null,
      p.tags.includes('bez-glutenu') ? 'https://schema.org/GlutenFreeDiet' : null
    ].filter(Boolean),
    offers: { '@type': 'Offer', price: p.fromPrice.toFixed(2), priceCurrency: 'PLN', availability: p.available ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock' }
  };
}

export function productLd(p: MenuProduct, categorySlug: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    description: p.description || `${p.name} w ${BRAND.name}`,
    image: img(p.imageUrl) || absUrl('/og-default.png'),
    brand: { '@type': 'Brand', name: BRAND.name },
    category: categorySlug,
    url: absUrl(`/menu/${categorySlug}/${p.slug}`),
    offers: p.variants.length
      ? {
          '@type': 'AggregateOffer',
          lowPrice: Math.min(...p.variants.map((v) => v.price)).toFixed(2),
          highPrice: Math.max(...p.variants.map((v) => v.price)).toFixed(2),
          offerCount: p.variants.length,
          priceCurrency: 'PLN',
          availability: p.available ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock'
        }
      : {
          '@type': 'Offer',
          price: p.price.toFixed(2),
          priceCurrency: 'PLN',
          availability: p.available ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
          url: absUrl(`/menu/${categorySlug}/${p.slug}`)
        }
  };
}

export function breadcrumbLd(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: absUrl(it.path) }))
  };
}

export function faqLd(faqs: { question: string; answer: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.question, acceptedAnswer: { '@type': 'Answer', text: f.answer } }))
  };
}

export function articleLd(a: { title: string; excerpt: string; slug: string; coverImage?: string; publishedAt: string | Date; updatedAt?: string | Date; author: string }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: a.title,
    description: a.excerpt,
    image: img(a.coverImage) || absUrl('/og-default.png'),
    datePublished: new Date(a.publishedAt).toISOString(),
    dateModified: new Date(a.updatedAt || a.publishedAt).toISOString(),
    author: { '@type': 'Organization', name: a.author || BRAND.name },
    publisher: { '@id': `${SITE_URL}/#organization` },
    mainEntityOfPage: absUrl(`/blog/${a.slug}`)
  };
}

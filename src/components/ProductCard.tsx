import Link from 'next/link';
import { Img } from './Img';
import { formatPLN } from '@/lib/util';
import type { MenuProduct } from '@/lib/data';
import type { Lang } from '@/lib/i18n';

const TAG_LABELS: Record<string, string> = {
  wege: 'Wege',
  weganskie: 'Wegańskie',
  'bez-laktozy': 'Bez laktozy',
  'bez-glutenu': 'Bez glutenu',
  ostre: 'Ostre',
  nowosc: 'Nowość',
  sezonowe: 'Sezonowe'
};
export const tagLabel = (t: string) => TAG_LABELS[t] || t;

export function ProductCard({ p, href, lang = 'pl', priority = false }: { p: MenuProduct; href: string; lang?: Lang; priority?: boolean }) {
  const name = lang === 'en' && p.nameEn ? p.nameEn : p.name;
  const desc = lang === 'en' && p.descriptionEn ? p.descriptionEn : p.description;
  return (
    <Link href={href} className="product-card">
      <div className="product-media">
        <Img src={p.imageUrl} alt={name} priority={priority} sizes="(max-width: 620px) 100vw, (max-width: 900px) 50vw, 300px" />
        <div className="badges">
          {p.isBestseller ? <span className="badge badge-dark">Bestseller</span> : null}
          {p.tags.includes('nowosc') ? <span className="badge badge-accent">Nowość</span> : null}
          {!p.available ? <span className="badge badge-danger">{lang === 'en' ? 'Sold out' : 'Chwilowo brak'}</span> : null}
        </div>
      </div>
      <div className="product-body">
        <h3 className="product-name">{name}</h3>
        {desc ? <p className="product-desc">{desc}</p> : null}
        <div className="product-foot">
          <span className="price">
            {p.variants.length > 1 ? <span className="price-from">{lang === 'en' ? 'from' : 'od'}</span> : null}
            {formatPLN(p.fromPrice)}
          </span>
          <span className="row" style={{ '--gap': '4px' } as React.CSSProperties}>
            {p.tags
              .filter((t) => ['wege', 'weganskie', 'bez-laktozy', 'bez-glutenu'].includes(t))
              .slice(0, 2)
              .map((t) => (
                <span key={t} className="badge badge-mint">
                  {tagLabel(t)}
                </span>
              ))}
          </span>
        </div>
      </div>
    </Link>
  );
}

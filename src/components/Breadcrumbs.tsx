import Link from 'next/link';
import { JsonLd } from './JsonLd';
import { breadcrumbLd } from '@/lib/seo';

export function Breadcrumbs({ items }: { items: { name: string; path: string }[] }) {
  return (
    <>
      <nav className="breadcrumbs" aria-label="Okruszki">
        {items.map((it, i) => (
          <span key={it.path} className="row" style={{ '--gap': '8px' } as React.CSSProperties}>
            {i < items.length - 1 ? <Link href={it.path}>{it.name}</Link> : <span aria-current="page">{it.name}</span>}
            {i < items.length - 1 ? <span aria-hidden="true">/</span> : null}
          </span>
        ))}
      </nav>
      <JsonLd data={breadcrumbLd(items)} />
    </>
  );
}

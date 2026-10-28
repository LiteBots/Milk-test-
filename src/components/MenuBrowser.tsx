'use client';

import { useMemo, useState } from 'react';
import { ProductCard } from './ProductCard';
import { Icon } from './Icon';
import type { MenuProduct, PublicCategory } from '@/lib/data';
import type { Lang } from '@/lib/i18n';

const DIETS = [
  { key: 'wege', pl: 'Wege', en: 'Vegetarian' },
  { key: 'weganskie', pl: 'Wegańskie', en: 'Vegan' },
  { key: 'bez-laktozy', pl: 'Bez laktozy', en: 'Lactose-free' },
  { key: 'bez-glutenu', pl: 'Bez glutenu', en: 'Gluten-free' }
];
const ALLERGEN_FILTERS = ['gluten', 'mleko', 'orzechy', 'orzeszki ziemne', 'jaja', 'soja', 'sezam'];

// Pełne menu z filtrowaniem po diecie, alergenach i wyszukiwaniu – sekcje kotwiczone dla SEO i nawigacji
export function MenuBrowser({ products, categories, lang = 'pl', productHref }: { products: MenuProduct[]; categories: PublicCategory[]; lang?: Lang; productHref: Record<string, string> }) {
  const [diets, setDiets] = useState<string[]>([]);
  const [noAllergens, setNoAllergens] = useState<string[]>([]);
  const [q, setQ] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const en = lang === 'en';

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return products.filter(
      (p) =>
        diets.every((d) => p.tags.includes(d)) &&
        noAllergens.every((a) => !p.allergens.includes(a)) &&
        (!query || `${p.name} ${p.description} ${p.nameEn || ''}`.toLowerCase().includes(query))
    );
  }, [products, diets, noAllergens, q]);

  const tops = categories.filter((c) => !c.parentKey);
  const sections = tops
    .map((top) => {
      const subs = categories.filter((c) => c.parentKey === top.key);
      const direct = filtered.filter((p) => p.categoryId === top.key);
      const groups = subs.map((s) => ({ cat: s, items: filtered.filter((p) => p.categoryId === s.key) })).filter((g) => g.items.length);
      return { top, direct, groups, count: direct.length + groups.reduce((s, g) => s + g.items.length, 0) };
    })
    .filter((s) => s.count > 0);
  const known = new Set(categories.map((c) => c.key));
  const orphans = filtered.filter((p) => !known.has(p.categoryId));
  const activeFilters = diets.length + noAllergens.length;
  const toggle = (arr: string[], v: string, set: (a: string[]) => void) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  return (
    <>
      <div className="sticky-chips">
        <div className="container stack" style={{ '--gap': '10px' } as React.CSSProperties}>
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <label className="sr-only" htmlFor="menu-q">
              {en ? 'Search the menu' : 'Szukaj w menu'}
            </label>
            <div style={{ position: 'relative', flex: 1 }}>
              <span style={{ position: 'absolute', left: 14, top: 13, color: 'var(--ink-3)' }}>
                <Icon name="search" size={18} />
              </span>
              <input id="menu-q" className="input" style={{ paddingLeft: 42 }} placeholder={en ? 'Search: chocolate, burger…' : 'Szukaj: czekolada, burger…'} value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <button className="btn btn-ghost" onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters}>
              <Icon name="leaf" size={18} /> {en ? 'Filters' : 'Filtry'}
              {activeFilters ? <span className="badge badge-accent">{activeFilters}</span> : null}
            </button>
          </div>
          {showFilters ? (
            <div className="stack" style={{ '--gap': '8px' } as React.CSSProperties}>
              <div className="chips" role="group" aria-label={en ? 'Diet' : 'Dieta'}>
                {DIETS.map((d) => (
                  <button key={d.key} className="chip" aria-pressed={diets.includes(d.key)} onClick={() => toggle(diets, d.key, setDiets)}>
                    {en ? d.en : d.pl}
                  </button>
                ))}
              </div>
              <div className="chips" role="group" aria-label={en ? 'Without allergen' : 'Bez alergenu'}>
                {ALLERGEN_FILTERS.map((a) => (
                  <button key={a} className="chip" aria-pressed={noAllergens.includes(a)} onClick={() => toggle(noAllergens, a, setNoAllergens)}>
                    {en ? 'no' : 'bez'}: {a}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <nav className="chips" aria-label={en ? 'Categories' : 'Kategorie'}>
            {sections.map((s) => (
              <a key={s.top.key} className="chip" href={`#${s.top.slug}`}>
                {en && s.top.nameEn ? s.top.nameEn : s.top.name}
              </a>
            ))}
          </nav>
        </div>
      </div>

      <div className="container section-sm">
        {sections.length === 0 && orphans.length === 0 ? (
          <div className="empty">
            <p>{en ? 'Nothing matches these filters.' : 'Nic nie pasuje do wybranych filtrów.'}</p>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setDiets([]);
                setNoAllergens([]);
                setQ('');
              }}
            >
              {en ? 'Clear filters' : 'Wyczyść filtry'}
            </button>
          </div>
        ) : null}
        {sections.map((s) => (
          <section key={s.top.key} id={s.top.slug} style={{ scrollMarginTop: 200, marginBottom: 56 }}>
            <div className="section-head" style={{ marginBottom: 20 }}>
              <div>
                <h2 className="h2">{en && s.top.nameEn ? s.top.nameEn : s.top.name}</h2>
                {s.top.description && !en ? <p className="muted mt-1" style={{ marginBottom: 0 }}>{s.top.description}</p> : null}
              </div>
              {!en ? (
                <a href={`/menu/${s.top.slug}`} className="link-arrow small">
                  Cała kategoria <Icon name="arrow-right" size={16} />
                </a>
              ) : null}
            </div>
            {s.direct.length ? (
              <div className="grid grid-3" style={{ marginBottom: 28 }}>
                {s.direct.map((p) => (
                  <ProductCard key={p.id} p={p} lang={lang} href={productHref[p.id]} />
                ))}
              </div>
            ) : null}
            {s.groups.map((g) => (
              <div key={g.cat.key} style={{ marginBottom: 28 }}>
                <h3 className="h3" style={{ marginBottom: 14 }}>
                  {en && g.cat.nameEn ? g.cat.nameEn : g.cat.name}
                </h3>
                <div className="grid grid-3">
                  {g.items.map((p) => (
                    <ProductCard key={p.id} p={p} lang={lang} href={productHref[p.id]} />
                  ))}
                </div>
              </div>
            ))}
          </section>
        ))}
        {orphans.length ? (
          <section id="inne" style={{ marginBottom: 56 }}>
            <h2 className="h2 mb-3">{en ? 'Other' : 'Pozostałe'}</h2>
            <div className="grid grid-3">
              {orphans.map((p) => (
                <ProductCard key={p.id} p={p} lang={lang} href={productHref[p.id]} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}

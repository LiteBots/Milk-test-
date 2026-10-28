'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import type { ISiteContent } from '@/lib/models/content';
import { PageHead, ImageInput, useData, useRun } from './ui';
import { Icon } from '../Icon';

type C = Omit<ISiteContent, 'key' | 'updatedAt' | 'announcement'>;

export function ContentEditor() {
  const { data } = useData<{ content: C }>('/api/admin/content');
  const [c, setC] = useState<C | null>(null);
  const { busy, run } = useRun();
  useEffect(() => {
    if (data) setC(data.content);
  }, [data]);
  if (!c) return <div className="skeleton" style={{ height: 300 }} />;
  const set = <K extends keyof C>(k: K, v: C[K]) => setC({ ...c, [k]: v });
  const text = (k: keyof C, label: string, area = false, hint?: string) => (
    <label className="field">
      <span className="label">{label}</span>
      {area ? (
        <textarea className="textarea" value={String(c[k] ?? '')} onChange={(e) => set(k, e.target.value as C[typeof k])} />
      ) : (
        <input className="input" value={String(c[k] ?? '')} onChange={(e) => set(k, e.target.value as C[typeof k])} />
      )}
      {hint ? <span className="hint">{hint}</span> : null}
    </label>
  );

  async function save() {
    await run(
      () =>
        api('/api/admin/content', {
          method: 'PUT',
          body: {
            heroTitle: c!.heroTitle,
            heroSubtitle: c!.heroSubtitle,
            heroImage: c!.heroImage,
            heroImageAlt: c!.heroImageAlt,
            aboutTitle: c!.aboutTitle,
            aboutText: c!.aboutText,
            aboutImage: c!.aboutImage,
            appTitle: c!.appTitle,
            appText: c!.appText,
            eventsText: c!.eventsText,
            giftCardsText: c!.giftCardsText,
            jobsText: c!.jobsText,
            instagramImages: c!.instagramImages.filter(Boolean),
            googleReviewsUrl: c!.googleReviewsUrl,
            googleRating: c!.googleRating ? Number(c!.googleRating) : null,
            googleReviewsCount: c!.googleReviewsCount ? Number(c!.googleReviewsCount) : null,
            testimonials: c!.testimonials.filter((t) => t.text)
          }
        }),
      'Treści zapisane – strona odświeży się w kilka sekund.'
    );
  }

  return (
    <>
      <PageHead
        title="Treści strony"
        sub="Teksty i zdjęcia strony głównej oraz podstron."
        actions={
          <>
            <a href="/" target="_blank" className="btn btn-ghost btn-sm">
              <Icon name="external" size={14} /> Podgląd
            </a>
            <button className="btn btn-accent btn-sm" onClick={save} disabled={busy}>
              Zapisz
            </button>
          </>
        }
      />
      <div className="grid grid-2">
        <section className="card stack">
          <h2 className="h3">Strona główna – baner</h2>
          {text('heroTitle', 'Nagłówek (H1)', false, 'Krótko, 3–6 słów.')}
          {text('heroSubtitle', 'Podtytuł', true)}
          <ImageInput label="Zdjęcie główne (pionowe, min. 1200 px)" value={c.heroImage} onChange={(v) => set('heroImage', v)} />
          {text('heroImageAlt', 'Opis zdjęcia (alt – ważny dla SEO i dostępności)')}
        </section>
        <section className="card stack">
          <h2 className="h3">O nas</h2>
          {text('aboutTitle', 'Tytuł')}
          {text('aboutText', 'Tekst (akapity oddziel pustą linią)', true)}
          <ImageInput label="Zdjęcie" value={c.aboutImage} onChange={(v) => set('aboutImage', v)} />
        </section>
        <section className="card stack">
          <h2 className="h3">Sekcje</h2>
          {text('appTitle', 'Aplikacja – tytuł')}
          {text('appText', 'Aplikacja – opis', true)}
          {text('eventsText', 'Imprezy i catering', true)}
          {text('giftCardsText', 'Karty podarunkowe', true)}
          {text('jobsText', 'Praca', true)}
        </section>
        <section className="card stack">
          <h2 className="h3">Opinie Google</h2>
          {text('googleReviewsUrl', 'Link do opinii w Google', false, 'Z profilu Google Business: „Poproś o opinie” lub link do wizytówki.')}
          <div className="grid grid-2" style={{ '--gap': '10px' } as React.CSSProperties}>
            <label className="field">
              <span className="label">Średnia ocena</span>
              <input className="input" type="number" step="0.1" min={0} max={5} value={c.googleRating ?? ''} onChange={(e) => set('googleRating', e.target.value === '' ? null : Number(e.target.value))} />
            </label>
            <label className="field">
              <span className="label">Liczba opinii</span>
              <input className="input" type="number" value={c.googleReviewsCount ?? ''} onChange={(e) => set('googleReviewsCount', e.target.value === '' ? null : Number(e.target.value))} />
            </label>
          </div>
          <p className="hint" style={{ margin: 0 }}>Ocena trafia do danych strukturalnych tylko, gdy obie wartości są uzupełnione zgodnie z wizytówką Google.</p>
          <strong className="small">Wyróżnione opinie (prawdziwe, z Google)</strong>
          {c.testimonials.map((t, i) => (
            <div key={i} className="card card-sm stack" style={{ '--gap': '6px' } as React.CSSProperties}>
              <textarea className="textarea" style={{ minHeight: 60 }} value={t.text} placeholder="Treść opinii" onChange={(e) => set('testimonials', c.testimonials.map((x, k) => (k === i ? { ...x, text: e.target.value } : x)))} />
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <input className="input" placeholder="Autor" value={t.author} onChange={(e) => set('testimonials', c.testimonials.map((x, k) => (k === i ? { ...x, author: e.target.value } : x)))} />
                <select className="select" style={{ width: 90 }} value={t.rating} onChange={(e) => set('testimonials', c.testimonials.map((x, k) => (k === i ? { ...x, rating: Number(e.target.value) } : x)))}>
                  {[5, 4, 3].map((n) => (
                    <option key={n} value={n}>
                      {n}★
                    </option>
                  ))}
                </select>
                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => set('testimonials', c.testimonials.filter((_, k) => k !== i))} aria-label="Usuń">
                  <Icon name="trash" size={14} />
                </button>
              </div>
            </div>
          ))}
          <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => set('testimonials', [...c.testimonials, { author: '', text: '', rating: 5, source: 'Google' }])}>
            + Opinia
          </button>
        </section>
        <section className="card stack" style={{ gridColumn: '1 / -1' }}>
          <h2 className="h3">Galeria Instagram (do 6 zdjęć)</h2>
          <div className="grid grid-3">
            {Array.from({ length: 6 }, (_, i) => (
              <ImageInput
                key={i}
                label={`Zdjęcie ${i + 1}`}
                value={c.instagramImages[i] || ''}
                onChange={(v) => {
                  const arr = [...c.instagramImages];
                  arr[i] = v;
                  set('instagramImages', arr);
                }}
              />
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

'use client';

import { useState } from 'react';
import { CrudPage, type Field } from '../CrudPage';
import { useData, useRun, fmtDate } from '../ui';
import { api } from '@/lib/client';
import { formatPLN } from '@/lib/util';
import { useAdmin } from '../AdminContext';

/* ---------------- KATEGORIE ---------------- */
export function CategoriesSection() {
  const { data } = useData<{ items: { key: string; name: string; parentKey: string | null }[] }>('/api/admin/crud/categories?limit=500');
  const tops = (data?.items || []).filter((c) => !c.parentKey);
  const fields: Field[] = [
    { name: 'name', label: 'Nazwa', type: 'text', required: true, half: true },
    { name: 'nameEn', label: 'Nazwa (EN)', type: 'text', half: true },
    { name: 'key', label: 'Klucz (categoryId)', type: 'text', half: true, hint: 'Generowany automatycznie; zmiana odłącza produkty.', readOnlyOnEdit: true },
    { name: 'slug', label: 'Adres URL (/menu/…)', type: 'text', half: true },
    { name: 'parentKey', label: 'Kategoria nadrzędna', type: 'select', nullable: true, options: tops.map((t) => ({ value: t.key, label: t.name })), half: true },
    { name: 'sortOrder', label: 'Kolejność', type: 'number', half: true },
    { name: 'description', label: 'Opis (widoczny na stronie kategorii – ważny dla SEO)', type: 'textarea' },
    { name: 'seoTitle', label: 'Tytuł SEO', type: 'text', half: true },
    { name: 'seoDescription', label: 'Opis SEO', type: 'text', half: true },
    { name: 'imageUrl', label: 'Zdjęcie kafelka', type: 'image' },
    { name: 'visible', label: 'Widoczna', type: 'checkbox', half: true },
    { name: 'allowSet', label: 'Zestawy (dodatek + napój)', type: 'checkbox', half: true },
    { name: 'stampEligible', label: 'Liczy się do pieczątek', type: 'checkbox', half: true }
  ];
  return (
    <CrudPage
      entity="categories"
      title="Kategorie menu"
      sub="Kategorie główne mają własne strony /menu/[adres] – dobry opis pomaga w Google."
      fields={fields}
      defaults={{ visible: true }}
      columns={[
        { key: 'name', label: 'Nazwa', render: (i) => (i.parentKey ? <span style={{ paddingLeft: 18 }}>↳ {String(i.name)}</span> : <strong>{String(i.name)}</strong>) },
        { key: 'slug', label: 'Adres', render: (i) => <span className="tiny muted">/menu/{String(i.slug)}</span> },
        { key: 'key', label: 'Klucz' },
        { key: 'visible', label: 'Widoczna' },
        { key: 'sortOrder', label: 'Kolejność', num: true }
      ]}
    />
  );
}

/* ---------------- NAGRODY ---------------- */
export function RewardsSection() {
  const { data } = useData<{ items: { _id: string; name: string }[] }>('/api/admin/products');
  return (
    <CrudPage
      entity="rewards"
      title="Nagrody za punkty"
      sub="Nagroda z produktem = klient wybiera ją w koszyku. Bez produktu = odbiór przy kasie (kod)."
      fields={[
        { name: 'name', label: 'Nazwa', type: 'text', required: true, half: true },
        { name: 'cost', label: 'Koszt (pkt)', type: 'number', required: true, half: true },
        { name: 'description', label: 'Opis', type: 'text' },
        { name: 'productId', label: 'Produkt (opcjonalnie)', type: 'select', nullable: true, options: (data?.items || []).map((p) => ({ value: p._id, label: p.name })), half: true },
        { name: 'maxValue', label: 'Maks. wartość (zł)', type: 'number', nullable: true, half: true },
        { name: 'sortOrder', label: 'Kolejność', type: 'number', half: true },
        { name: 'active', label: 'Aktywna', type: 'checkbox', half: true }
      ]}
      defaults={{ active: true }}
      columns={[
        { key: 'name', label: 'Nagroda' },
        { key: 'cost', label: 'Koszt', num: true, render: (i) => `${i.cost} pkt` },
        { key: 'productId', label: 'Produkt', render: (i) => (i.productId ? (data?.items || []).find((p) => p._id === i.productId)?.name || '—' : 'przy kasie') },
        { key: 'active', label: 'Aktywna' }
      ]}
    />
  );
}

/* ---------------- KODY RABATOWE ---------------- */
export function CouponsSection() {
  const { locations } = useAdmin();
  const { data } = useData<{ items: { _id: string; name: string }[] }>('/api/admin/products');
  return (
    <CrudPage
      entity="coupons"
      title="Kody rabatowe"
      sub="Kody działają w sklepie i aplikacji; osobiste kupony (urodzinowe, na start) tworzą się automatycznie."
      query="f_userId=null"
      fields={[
        { name: 'code', label: 'Kod', type: 'text', required: true, half: true, hint: 'np. LATO15' },
        { name: 'name', label: 'Nazwa (widoczna dla klienta)', type: 'text', half: true },
        {
          name: 'type',
          label: 'Rodzaj',
          type: 'select',
          options: [
            { value: 'percent', label: 'Procent' },
            { value: 'amount', label: 'Kwota (zł)' },
            { value: 'free_product', label: 'Darmowy produkt' }
          ],
          half: true
        },
        { name: 'value', label: 'Wartość (% lub zł)', type: 'number', half: true },
        { name: 'productId', label: 'Produkt (dla „darmowy produkt”)', type: 'select', nullable: true, options: (data?.items || []).map((p) => ({ value: p._id, label: p.name })), half: true },
        { name: 'minOrder', label: 'Minimalne zamówienie (zł)', type: 'number', half: true },
        { name: 'maxDiscount', label: 'Maks. rabat (zł)', type: 'number', nullable: true, half: true },
        { name: 'maxUses', label: 'Limit użyć łącznie', type: 'number', nullable: true, half: true },
        { name: 'usesPerUser', label: 'Użyć na klienta (0 = bez limitu)', type: 'number', half: true },
        { name: 'validFrom', label: 'Ważny od', type: 'datetime', half: true },
        { name: 'validTo', label: 'Ważny do', type: 'datetime', half: true },
        { name: 'locations', label: 'Lokale (puste = wszystkie)', type: 'multiselect', options: locations.map((l) => ({ value: l.slug, label: l.city })) },
        { name: 'appOnly', label: 'Tylko w aplikacji', type: 'checkbox', half: true },
        { name: 'active', label: 'Aktywny', type: 'checkbox', half: true }
      ]}
      defaults={{ type: 'percent', value: 10, usesPerUser: 1, active: true, minOrder: 0 }}
      columns={[
        { key: 'code', label: 'Kod', render: (i) => <strong>{String(i.code)}</strong> },
        { key: 'name', label: 'Nazwa' },
        { key: 'value', label: 'Rabat', render: (i) => (i.type === 'percent' ? `${i.value}%` : i.type === 'amount' ? formatPLN(Number(i.value)) : 'produkt gratis') },
        { key: 'usedCount', label: 'Użycia', num: true, render: (i) => `${i.usedCount || 0}${i.maxUses ? ` / ${i.maxUses}` : ''}` },
        { key: 'validTo', label: 'Do', render: (i) => (i.validTo ? fmtDate(String(i.validTo), false) : 'bezterminowo') },
        { key: 'active', label: 'Aktywny' }
      ]}
    />
  );
}

/* ---------------- FAQ ---------------- */
export function FaqSection() {
  return (
    <CrudPage
      entity="faq"
      title="FAQ"
      sub="Pytania trafiają na /faq i do danych strukturalnych FAQPage (wyniki Google)."
      fields={[
        { name: 'question', label: 'Pytanie', type: 'text', required: true },
        { name: 'answer', label: 'Odpowiedź', type: 'textarea', required: true },
        {
          name: 'group',
          label: 'Grupa',
          type: 'select',
          options: [
            { value: 'zamowienia', label: 'Zamówienia' },
            { value: 'aplikacja', label: 'Aplikacja' },
            { value: 'rezerwacje', label: 'Rezerwacje' },
            { value: 'ogolne', label: 'Ogólne' }
          ],
          half: true
        },
        { name: 'sortOrder', label: 'Kolejność', type: 'number', half: true },
        { name: 'visible', label: 'Widoczne', type: 'checkbox', half: true }
      ]}
      defaults={{ group: 'ogolne', visible: true }}
      columns={[
        { key: 'question', label: 'Pytanie' },
        { key: 'group', label: 'Grupa' },
        { key: 'visible', label: 'Widoczne' }
      ]}
    />
  );
}

/* ---------------- BLOG ---------------- */
export function BlogSection() {
  return (
    <CrudPage
      entity="posts"
      title="Blog"
      sub="Treść w prostym formacie: akapity oddzielone pustą linią, ## nagłówek, - lista, **pogrubienie**, [link](https://…)."
      fields={[
        { name: 'title', label: 'Tytuł', type: 'text', required: true },
        { name: 'slug', label: 'Adres (/blog/…)', type: 'text', half: true, hint: 'Puste = z tytułu' },
        { name: 'author', label: 'Autor', type: 'text', half: true },
        { name: 'excerpt', label: 'Zajawka (1–2 zdania)', type: 'textarea' },
        { name: 'coverImage', label: 'Zdjęcie główne', type: 'image' },
        { name: 'body', label: 'Treść', type: 'markdown' },
        { name: 'seoTitle', label: 'Tytuł SEO', type: 'text', half: true },
        { name: 'seoDescription', label: 'Opis SEO', type: 'text', half: true },
        { name: 'publishedAt', label: 'Data publikacji', type: 'datetime', half: true },
        { name: 'published', label: 'Opublikowany', type: 'checkbox', half: true }
      ]}
      defaults={{ author: 'Milkshakebar', published: false }}
      columns={[
        { key: 'title', label: 'Tytuł' },
        { key: 'slug', label: 'Adres', render: (i) => <span className="tiny muted">/blog/{String(i.slug)}</span> },
        { key: 'publishedAt', label: 'Data', render: (i) => fmtDate(String(i.publishedAt), false) },
        { key: 'published', label: 'Opublikowany' }
      ]}
    />
  );
}

/* ---------------- SEO ---------------- */
export function SeoSection() {
  return (
    <CrudPage
      entity="seo"
      title="SEO – meta tagi"
      sub="Nadpisz tytuł i opis dowolnej podstrony (np. /, /menu, /lokale/slupsk, /menu/burgery). Tytuł do ~60 znaków, opis do ~155."
      fields={[
        { name: 'path', label: 'Adres strony', type: 'text', required: true, hint: 'np. /menu/burgery' },
        { name: 'title', label: 'Tytuł (title)', type: 'text' },
        { name: 'description', label: 'Opis (meta description)', type: 'textarea' },
        { name: 'ogImage', label: 'Obraz do udostępnień (1200×630)', type: 'image' },
        { name: 'noindex', label: 'Ukryj przed Google (noindex)', type: 'checkbox' }
      ]}
      columns={[
        { key: 'path', label: 'Adres', render: (i) => <strong>{String(i.path)}</strong> },
        { key: 'title', label: 'Tytuł', render: (i) => `${String(i.title || '—')} (${String(i.title || '').length})` },
        { key: 'description', label: 'Opis', render: (i) => <span className="tiny">{String(i.description || '—').slice(0, 80)}</span> },
        { key: 'noindex', label: 'noindex' }
      ]}
    />
  );
}

/* ---------------- PRACOWNICY ---------------- */
export function EmployeesSection() {
  const { locations } = useAdmin();
  return (
    <CrudPage
      entity="employees"
      title="Pracownicy"
      sub="PIN służy do odbijania czasu pracy na tablecie (Czas pracy)."
      fields={[
        { name: 'name', label: 'Imię i nazwisko', type: 'text', required: true, half: true },
        { name: 'position', label: 'Stanowisko', type: 'text', half: true },
        { name: 'phone', label: 'Telefon', type: 'text', half: true },
        { name: 'hourlyRate', label: 'Stawka godzinowa (zł brutto)', type: 'number', half: true },
        { name: 'pin', label: 'PIN (4–6 cyfr) – zostaw puste, by nie zmieniać', type: 'password', half: true },
        { name: 'locations', label: 'Lokale', type: 'multiselect', options: locations.map((l) => ({ value: l.slug, label: l.city })) },
        { name: 'active', label: 'Aktywny', type: 'checkbox', half: true }
      ]}
      defaults={{ active: true, position: 'Obsługa', locations: ['slupsk'] }}
      columns={[
        { key: 'name', label: 'Pracownik' },
        { key: 'position', label: 'Stanowisko' },
        { key: 'hourlyRate', label: 'Stawka', num: true, render: (i) => formatPLN(Number(i.hourlyRate || 0)) },
        { key: 'active', label: 'Aktywny' }
      ]}
    />
  );
}

/* ---------------- KARTY PODARUNKOWE ---------------- */
export function GiftCardsSection() {
  const STATUS: Record<string, string> = { awaiting_payment: 'Czeka na płatność', active: 'Aktywna', redeemed: 'Wykorzystana', cancelled: 'Anulowana' };
  return (
    <CrudPage
      entity="giftcards"
      title="Karty podarunkowe"
      sub="Karty kupione online i wydane ręcznie (np. sprzedane w lokalu). Realizacja: aplikacja klienta lub Kasa."
      canDelete={false}
      searchPlaceholder="Kod, e-mail…"
      fields={[
        { name: 'amount', label: 'Wartość (zł)', type: 'number', required: true, half: true },
        { name: 'balance', label: 'Saldo (zł)', type: 'number', half: true },
        { name: 'code', label: 'Kod (puste = automatyczny)', type: 'text', half: true, readOnlyOnEdit: true },
        {
          name: 'status',
          label: 'Status',
          type: 'select',
          options: Object.entries(STATUS).map(([value, label]) => ({ value, label })),
          half: true
        },
        { name: 'recipientName', label: 'Obdarowany', type: 'text', half: true },
        { name: 'recipientEmail', label: 'E-mail obdarowanego', type: 'text', half: true },
        { name: 'buyerName', label: 'Kupujący', type: 'text', half: true },
        { name: 'buyerEmail', label: 'E-mail kupującego', type: 'text', half: true },
        { name: 'validTo', label: 'Ważna do', type: 'date', half: true },
        { name: 'message', label: 'Życzenia', type: 'textarea' }
      ]}
      defaults={{ amount: 100, status: 'active' }}
      columns={[
        { key: 'code', label: 'Kod', render: (i) => <strong>{String(i.code)}</strong> },
        { key: 'amount', label: 'Wartość', num: true, render: (i) => formatPLN(Number(i.amount)) },
        { key: 'balance', label: 'Saldo', num: true, render: (i) => formatPLN(Number(i.balance)) },
        { key: 'status', label: 'Status', render: (i) => STATUS[String(i.status)] || String(i.status) },
        { key: 'recipientEmail', label: 'Dla' },
        { key: 'createdAt', label: 'Data', render: (i) => fmtDate(String(i.createdAt), false) }
      ]}
    />
  );
}

/* ---------------- ZAPYTANIA ---------------- */
export function InquiriesSection() {
  const TYPE: Record<string, string> = { event: 'Impreza', contact: 'Kontakt', job: 'Praca' };
  const STATUS: Record<string, string> = { new: 'Nowe', in_progress: 'W toku', done: 'Załatwione' };
  const [open, setOpen] = useState<Record<string, unknown> | null>(null);
  const { run } = useRun();
  return (
    <>
      <CrudPage
        entity="inquiries"
        title="Zapytania"
        sub="Formularze: imprezy i catering, kontakt, zgłoszenia do pracy."
        canCreate={false}
        fields={[{ name: 'status', label: 'Status', type: 'select', options: Object.entries(STATUS).map(([value, label]) => ({ value, label })) }]}
        columns={[
          { key: 'createdAt', label: 'Data', render: (i) => fmtDate(String(i.createdAt)) },
          { key: 'type', label: 'Typ', render: (i) => <span className="badge">{TYPE[String(i.type)]}</span> },
          { key: 'name', label: 'Od', render: (i) => (
            <>
              {String(i.name)}
              <div className="tiny muted">
                {String(i.email)} {i.phone ? `· ${String(i.phone)}` : ''}
              </div>
            </>
          ) },
          { key: 'message', label: 'Wiadomość', render: (i) => <span className="small">{String(i.message).slice(0, 120)}{String(i.message).length > 120 ? '…' : ''}</span> },
          { key: 'status', label: 'Status', render: (i) => <span className={`badge ${i.status === 'new' ? 'badge-accent' : i.status === 'done' ? 'badge-mint' : 'badge-amber'}`}>{STATUS[String(i.status)]}</span> }
        ]}
        rowActions={(i, reload) => (
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setOpen(i)}>
              Czytaj
            </button>
            {i.status !== 'done' ? (
              <button className="btn btn-soft btn-sm" onClick={() => run(async () => { await api(`/api/admin/crud/inquiries/${i._id}`, { method: 'PATCH', body: { status: 'done' } }); reload(); }, 'Oznaczono jako załatwione.')}>
                ✓
              </button>
            ) : null}
          </div>
        )}
      />
      {open ? (
        <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && setOpen(null)}>
          <div className="sheet">
            <div className="sheet-head">
              <strong>{String(open.name)}</strong>
              <button className="btn btn-ghost btn-sm" onClick={() => setOpen(null)}>
                Zamknij
              </button>
            </div>
            <div className="sheet-body stack small">
              <div>
                <a className="link" href={`mailto:${String(open.email)}`}>{String(open.email)}</a> {open.phone ? <>· <a className="link" href={`tel:${String(open.phone)}`}>{String(open.phone)}</a></> : null}
              </div>
              {open.date ? <div>Data: {String(open.date)} · goście: {String(open.guests || '—')} · {String(open.location || '')}</div> : null}
              {open.position ? <div>Stanowisko: {String(open.position)} · {String(open.location || '')}</div> : null}
              <p style={{ whiteSpace: 'pre-wrap' }}>{String(open.message)}</p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

/* ---------------- KONTA I ROLE ---------------- */
export function StaffSection() {
  const { locations } = useAdmin();
  const ROLE: Record<string, string> = { owner: 'Właściciel – wszystko', manager: 'Kierownik – bez kont i dziennika', cashier: 'Kasjer – zamówienia, kasa, rezerwacje', kitchen: 'Kuchnia – zamówienia, dostępność, magazyn' };
  return (
    <CrudPage
      entity="staff"
      title="Konta i role"
      sub="Każda osoba ma własne konto – w dzienniku zmian widać, kto co zrobił. 2FA włącza się w profilu."
      fields={[
        { name: 'name', label: 'Imię i nazwisko', type: 'text', required: true, half: true },
        { name: 'email', label: 'E-mail (login)', type: 'text', required: true, half: true },
        { name: 'password', label: 'Hasło (min. 10 znaków; puste = bez zmian)', type: 'password', half: true },
        { name: 'role', label: 'Rola', type: 'select', options: Object.entries(ROLE).map(([value, label]) => ({ value, label })), half: true },
        { name: 'locations', label: 'Dostęp do lokali (puste = wszystkie)', type: 'multiselect', options: locations.map((l) => ({ value: l.slug, label: l.city })) },
        { name: 'active', label: 'Konto aktywne', type: 'checkbox', half: true }
      ]}
      defaults={{ role: 'cashier', active: true }}
      columns={[
        { key: 'name', label: 'Osoba' },
        { key: 'email', label: 'E-mail' },
        { key: 'role', label: 'Rola', render: (i) => ROLE[String(i.role)]?.split(' – ')[0] },
        { key: 'totpEnabled', label: '2FA' },
        { key: 'lastLoginAt', label: 'Ostatnie logowanie', render: (i) => fmtDate(i.lastLoginAt as string) },
        { key: 'active', label: 'Aktywne' }
      ]}
    />
  );
}

/* ---------------- MAGAZYN ---------------- */
export function InventorySection() {
  const { location } = useAdmin();
  const { data: prod } = useData<{ items: { _id: string; name: string }[] }>('/api/admin/products');
  const { run } = useRun();
  return (
    <CrudPage
      entity="inventory"
      title="Magazyn"
      sub="Gdy stan spadnie do zera, powiązane produkty automatycznie dostają „chwilowo brak” w tym lokalu."
      query={`f_location=${location}`}
      fields={[
        { name: 'name', label: 'Składnik / towar', type: 'text', required: true, half: true },
        { name: 'unit', label: 'Jednostka', type: 'select', options: ['szt', 'kg', 'l', 'opak'].map((u) => ({ value: u, label: u })), half: true },
        { name: 'quantity', label: 'Stan', type: 'number', half: true },
        { name: 'minQuantity', label: 'Alarm poniżej', type: 'number', half: true },
        { name: 'location', label: 'Lokal', type: 'text', half: true },
        { name: 'linkedProductIds', label: 'Powiązane produkty', type: 'multiselect', options: (prod?.items || []).map((p) => ({ value: p._id, label: p.name })) }
      ]}
      defaults={{ unit: 'kg', quantity: 0, minQuantity: 1, location }}
      columns={[
        { key: 'name', label: 'Pozycja' },
        {
          key: 'quantity',
          label: 'Stan',
          num: true,
          render: (i) => (
            <span className={Number(i.quantity) <= Number(i.minQuantity) ? 'badge badge-danger' : 'badge badge-mint'}>
              {String(i.quantity)} {String(i.unit)}
            </span>
          )
        },
        { key: 'minQuantity', label: 'Alarm', num: true },
        { key: 'linkedProductIds', label: 'Produkty', render: (i) => ((i.linkedProductIds as string[]) || []).length || '—' }
      ]}
      rowActions={(i, reload) => (
        <div className="row" style={{ flexWrap: 'nowrap', '--gap': '4px' } as React.CSSProperties}>
          <button
            className="btn btn-soft btn-sm"
            onClick={() => {
              const v = prompt(`Przyjęcie dostawy: ${String(i.name)} (${String(i.unit)})`, '1');
              if (v) run(async () => { await api(`/api/admin/inventory/${i._id}/adjust`, { body: { change: Number(v.replace(',', '.')), reason: 'Dostawa' } }); reload(); }, 'Zapisano.');
            }}
          >
            + dostawa
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              const v = prompt(`Zużycie / strata: ${String(i.name)} (${String(i.unit)})`, '1');
              if (v) run(async () => { await api(`/api/admin/inventory/${i._id}/adjust`, { body: { change: -Number(v.replace(',', '.')), reason: 'Zużycie' } }); reload(); }, 'Zapisano.');
            }}
          >
            − zużycie
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              const v = prompt(`Inwentaryzacja – faktyczny stan: ${String(i.name)}`, String(i.quantity));
              if (v !== null && v !== '') run(async () => { await api(`/api/admin/inventory/${i._id}/adjust`, { body: { setTo: Number(v.replace(',', '.')) } }); reload(); }, 'Zapisano.');
            }}
          >
            = stan
          </button>
        </div>
      )}
    />
  );
}

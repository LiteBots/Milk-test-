import 'server-only';
import mongoose from 'mongoose';
import { Location, Category, Product, SiteContent, Faq, Reward, type ILocation, type WeekKey, type DayHours } from './models';
import { getLoyaltyConfig } from './loyalty';
import { slugify } from './util';

// Domyślne kategorie – klucze zgodne z categoryId produktów ze starej wersji
export const DEFAULT_CATEGORIES: { key: string; name: string; parentKey?: string; allowSet?: boolean; stamp?: boolean; description: string }[] = [
  { key: 'shakes', name: 'Shake’i', stamp: true, description: 'Gęste milkshake’i z prawdziwych lodów – klasyczne, owocowe i autorskie.' },
  { key: 'shakes_klasyczne', name: 'Klasyczne', parentKey: 'shakes', stamp: true, description: 'Waniliowy, czekoladowy, truskawkowy – shake’i, od których wszystko się zaczęło.' },
  { key: 'shakes_owocowe', name: 'Owocowe', parentKey: 'shakes', stamp: true, description: 'Shake’i ze świeżymi owocami.' },
  { key: 'shakes_vip', name: 'Tylko dla VIP', parentKey: 'shakes', stamp: true, description: 'Nasze najbardziej rozbudowane kompozycje.' },
  { key: 'shakes_best', name: 'Best of', parentKey: 'shakes', stamp: true, description: 'Shake’i, które zamawiacie najczęściej.' },
  { key: 'burgery', name: 'Burgery', allowSet: true, description: 'Burgery z wołowiny Black Angus i kurczaka, w zestawie z frytkami i napojem.' },
  { key: 'startery', name: 'Startery', allowSet: true, description: 'Frytki, krążki cebulowe i przekąski do dzielenia.' },
  { key: 'kanapki', name: 'Kanapki', allowSet: true, description: 'Kanapki na ciepło i na zimno.' },
  { key: 'dania_glowne', name: 'Dania główne', allowSet: true, description: 'Pełne dania obiadowe.' },
  { key: 'desery', name: 'Desery', description: 'Lody włoskie, desery lodowe, gofry amerykańskie i pancakes.' },
  { key: 'desery_wloskie', name: 'Lody włoskie', parentKey: 'desery', description: 'Lody włoskie w kubku i w waflu.' },
  { key: 'desery_lodowe', name: 'Desery lodowe', parentKey: 'desery', description: 'Pucharki lodowe z dodatkami.' },
  { key: 'desery_gofry', name: 'Gofry amerykańskie', parentKey: 'desery', description: 'Gofry z owocami, sosami i bitą śmietaną.' },
  { key: 'desery_pancakes', name: 'Pancakes', parentKey: 'desery', description: 'Puszyste pancakes na słodko.' },
  { key: 'sniadania', name: 'Śniadania', description: 'Śniadania serwowane od rana – także w wersji keto.' },
  { key: 'mexico', name: 'Mexico', description: 'Quesadillas, fajita, pasta, sałaty i churros.' },
  { key: 'mexico_quesadillas', name: 'Quesadillas', parentKey: 'mexico', description: 'Quesadillas z chrupiącej tortilli.' },
  { key: 'mexico_fajita', name: 'Fajita', parentKey: 'mexico', description: 'Fajita z warzywami i mięsem.' },
  { key: 'mexico_pasta', name: 'Pasta', parentKey: 'mexico', description: 'Makarony w meksykańskim stylu.' },
  { key: 'mexico_salaty', name: 'Sałaty', parentKey: 'mexico', description: 'Sycące sałaty.' },
  { key: 'mexico_churros', name: 'Churros', parentKey: 'mexico', description: 'Churros z sosem czekoladowym.' },
  { key: 'napoje', name: 'Kawa i napoje', description: 'Kawa, herbata, matcha, lemoniady, soki i smoothies.' }
];

const DEFAULT_SCHEDULE: Record<WeekKey, DayHours> = {
  mon: { isOpen: true, from: '10:00', to: '21:00' },
  tue: { isOpen: true, from: '10:00', to: '21:00' },
  wed: { isOpen: true, from: '10:00', to: '21:00' },
  thu: { isOpen: true, from: '10:00', to: '21:00' },
  fri: { isOpen: true, from: '10:00', to: '22:00' },
  sat: { isOpen: true, from: '10:00', to: '22:00' },
  sun: { isOpen: true, from: '11:00', to: '21:00' }
};

const DEFAULT_LOCATIONS: Partial<ILocation>[] = [
  {
    slug: 'slupsk',
    name: 'Milkshakebar Słupsk',
    city: 'Słupsk',
    street: 'ul. Szczecińska 17',
    postalCode: '76-200',
    lat: 54.4641,
    lng: 17.0201,
    mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Milkshakebar+Szczeci%C5%84ska+17+S%C5%82upsk',
    description:
      'Nasz pierwszy lokal, czynny przez cały rok. Shake’i, burgery Black Angus, śniadania i kawa – na miejscu, na wynos i z zamówieniem online.',
    directions: 'Lokal przy ul. Szczecińskiej 17 w Słupsku. Parking miejski w okolicy, przystanki autobusowe w pobliżu.',
    seasonal: false
  },
  {
    slug: 'rowy',
    name: 'Milkshakebar Rowy',
    city: 'Rowy',
    street: 'ul. Wydmowa 2',
    postalCode: '76-212',
    lat: 54.6652,
    lng: 17.0539,
    mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Milkshakebar+Wydmowa+2+Rowy',
    description: 'Sezonowy lokal w Rowach, kilka minut spacerem od plaży. Shake’i i desery na upalne dni.',
    directions: 'Ul. Wydmowa 2 w Rowach, w pobliżu zejścia na plażę. W sezonie najlepiej dojść pieszo lub dojechać rowerem.',
    seasonal: true,
    seasonNote: 'Otwieramy w sezonie letnim'
  }
];

let done = false;
let running: Promise<void> | null = null;

// Uzupełnia brakujące dane startowe (lokale, kategorie, slugi produktów) – bez nadpisywania istniejących
export function ensureBootstrap() {
  if (done) return Promise.resolve();
  if (!running) {
    running = run()
      .then(() => {
        done = true;
      })
      .catch((e) => {
        console.error('[bootstrap]', e);
      })
      .finally(() => {
        running = null;
      });
  }
  return running;
}

async function run() {
  const conn = mongoose.connection;
  // Lokale – przy pierwszym uruchomieniu przenosimy godziny i ustawienia ze starej wersji
  for (const def of DEFAULT_LOCATIONS) {
    const exists = await Location.exists({ slug: def.slug });
    if (exists) continue;
    // Sezonowy lokal startuje jako zamknięty, dopóki nie ustawisz godzin w panelu
    let schedule: Record<WeekKey, DayHours> = def.seasonal
      ? (Object.fromEntries(Object.entries(DEFAULT_SCHEDULE).map(([k, v]) => [k, { ...v, isOpen: false }])) as Record<WeekKey, DayHours>)
      : DEFAULT_SCHEDULE;
    let flags: Partial<ILocation> = def.seasonal ? { ordersEnabled: false, reservationsEnabled: false } : {};
    try {
      const oldHours = await conn.collection('locationhours').findOne({ location: def.slug });
      if (oldHours?.schedule) schedule = { ...DEFAULT_SCHEDULE, ...(oldHours.schedule as Record<WeekKey, DayHours>) };
      const oldSettings = await conn.collection('storesettings').findOne({ location: def.slug });
      if (oldSettings) {
        flags = {
          ordersEnabled: oldSettings.ordersEnabled !== false,
          pickupEnabled: oldSettings.pickupEnabled !== false,
          deliveryEnabled: !!oldSettings.deliveryEnabled
        };
      }
    } catch {
      /* brak starych kolekcji */
    }
    await Location.create({ ...def, schedule, ...flags, active: true });
  }

  // Kategorie
  if ((await Category.estimatedDocumentCount()) === 0) {
    let banners: Record<string, string> = {};
    try {
      const old = await conn.collection('categorybanners').find({}).toArray();
      banners = Object.fromEntries(old.map((b: { categoryId: unknown; imageUrl: unknown }) => [String(b.categoryId).replace(/^(cat|sub)_/, ''), String(b.imageUrl)]));
    } catch {
      /* brak */
    }
    await Category.insertMany(
      DEFAULT_CATEGORIES.map((c, i) => ({
        key: c.key,
        slug: slugify(c.key.replace(/_/g, '-')),
        name: c.name,
        parentKey: c.parentKey || null,
        description: c.description,
        sortOrder: i,
        allowSet: !!c.allowSet,
        stampEligible: !!c.stamp,
        imageUrl: banners[c.key] || ''
      }))
    );
    // Kategorie z produktów spoza listy (np. dodane ręcznie w starym panelu)
    const known = new Set(DEFAULT_CATEGORIES.map((c) => c.key));
    const used: string[] = await Product.distinct('categoryId');
    const extra = used.filter((k) => k && !known.has(k));
    for (const [i, key] of extra.entries()) {
      await Category.create({ key, slug: slugify(key), name: key.replace(/_/g, ' '), sortOrder: 100 + i, description: '' });
    }
  }

  // Slugi produktów (adresy /menu/kategoria/produkt)
  const noSlug = await Product.find({ $or: [{ slug: { $exists: false } }, { slug: null }, { slug: '' }] }, 'name location').lean();
  for (const p of noSlug) {
    let base = slugify(p.name) || 'produkt';
    if (p.location === 'rowy') base += '-rowy';
    let slug = base;
    let n = 2;
    while (await Product.exists({ slug, _id: { $ne: p._id } })) slug = `${base}-${n++}`;
    await Product.updateOne({ _id: p._id }, { $set: { slug } });
  }

  if (!(await SiteContent.exists({ key: 'main' }))) await SiteContent.create({ key: 'main' });
  await getLoyaltyConfig();

  if ((await Faq.estimatedDocumentCount()) === 0) {
    await Faq.insertMany([
      { group: 'zamowienia', sortOrder: 1, question: 'Jak złożyć zamówienie z odbiorem?', answer: 'Wejdź w „Zamów online”, wybierz lokal i produkty, a potem godzinę odbioru. Płacisz online (PayU, BLIK), kartą lub gotówką przy odbiorze albo portfelem MilkMi.' },
      { group: 'zamowienia', sortOrder: 2, question: 'Ile czeka się na zamówienie?', answer: 'Zwykle 15–25 minut. Pokazujemy tylko godziny odbioru, które kuchnia realnie zdąży przygotować.' },
      { group: 'zamowienia', sortOrder: 3, question: 'Czy mogę anulować zamówienie?', answer: 'Zadzwoń do lokalu, zanim zaczniemy przygotowanie. Płatność online zwracamy na to samo konto.' },
      { group: 'aplikacja', sortOrder: 4, question: 'Jak działają punkty MilkMi?', answer: 'Za każde 10 zł dostajesz 1 punkt (więcej na poziomach Silver i Gold). Punkty wymieniasz na nagrody albo na środki w portfelu.' },
      { group: 'aplikacja', sortOrder: 5, question: 'Jak odebrać darmowego shake’a?', answer: 'Każdy shake to jedna pieczątka. Po zebraniu kompletu w koszyku pojawi się opcja „Darmowy shake”.' },
      { group: 'aplikacja', sortOrder: 6, question: 'Czy muszę instalować aplikację ze sklepu?', answer: 'Nie. MilkMi działa w przeglądarce – możesz dodać ją do ekranu głównego jednym kliknięciem.' },
      { group: 'rezerwacje', sortOrder: 7, question: 'Jak zarezerwować stolik?', answer: 'Wybierz lokal, datę, godzinę i liczbę osób w zakładce „Rezerwacja”. Potwierdzenie przyjdzie SMS-em.' },
      { group: 'ogolne', sortOrder: 8, question: 'Czy macie opcje bez laktozy i wege?', answer: 'Tak – w menu możesz filtrować produkty wege i bez laktozy, a przy każdym produkcie podajemy alergeny.' },
      { group: 'ogolne', sortOrder: 9, question: 'Kiedy otwarty jest lokal w Rowach?', answer: 'Lokal w Rowach działa w sezonie letnim. Aktualne godziny znajdziesz na stronie lokalu.' }
    ]);
  }

  if ((await Reward.estimatedDocumentCount()) === 0) {
    await Reward.insertMany([
      { name: 'Kawa czarna gratis', description: 'Dowolna kawa czarna 200 ml', cost: 60, sortOrder: 1, maxValue: 15 },
      { name: 'Shake klasyczny gratis', description: 'Dowolny shake z kategorii Klasyczne', cost: 150, sortOrder: 2, maxValue: 30 },
      { name: 'Burger gratis', description: 'Dowolny burger bez zestawu', cost: 300, sortOrder: 3, maxValue: 45 }
    ]);
  }
}

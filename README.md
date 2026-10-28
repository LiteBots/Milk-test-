# MilkMi / Milkshakebar 2.0

To jest nowa wersja serwisu Milkshakebar. W jednej aplikacji Next.js są:

- strona internetowa,
- sklep online z odbiorem,
- aplikacja lojalnościowa MilkMi (PWA),
- panel administratora.

Aplikacja korzysta z **tej samej bazy MongoDB** co poprzednia wersja. Klienci, punkty, portfele, produkty, zamówienia i rezerwacje zostają.

---

## Gdzie co jest (najważniejsze pliki)

W Next.js nie ma pliku `index.html` – każda strona to plik `page.tsx` w folderze `src/app`:

| Co | Plik |
|---|---|
| **Strona główna** (`/`) | `src/app/(site)/page.tsx` → wygląd sekcji: `src/components/HomeView.tsx` |
| Menu (`/menu`) | `src/app/(site)/menu/page.tsx` |
| Zamówienia online (`/zamow`) | `src/app/(site)/zamow/page.tsx` + `src/components/shop/Shop.tsx` |
| Aplikacja MilkMi (`/app`) | `src/app/(app)/app/…` |
| Panel admina (`/admin`) | `src/app/(admin)/admin/…` |
| Wersja angielska (`/en`) | `src/app/(en)/en/…` |
| Kolory, przyciski, wygląd | `src/app/globals.css` |
| Czcionka (Plus Jakarta Sans) | `src/lib/fonts.ts` |
| Nazwa firmy, telefon, social media | `src/lib/site.ts` |

Teksty strony głównej (tytuł, opis, zdjęcie) zmienisz bez programowania: **panel → Treści strony**.
Poprzednia wersja (pliki `.html` + `server.js`) jest w folderze `stara-strona/` – tylko do wglądu.

---

## 1. Wdrożenie krok po kroku (Railway)

### Krok 1 – wgranie do repozytorium `Milkshakebar` (na osobną gałąź)

Nowa wersja trafia najpierw na gałąź `v2`, żeby obecna strona działała bez przerwy do czasu testów.
Projekt ma ponad 100 plików – przeglądarka GitHuba przyjmuje maks. 100 naraz, dlatego użyj **GitHub Desktop** (darmowy):

1. W GitHub Desktop: **File → Clone repository** → wybierz `LiteBots/Milkshakebar` → **Clone**.
2. U góry kliknij **Current branch → New branch**, nazwa `v2` → **Create branch**.
3. **Repository → Show in Explorer** (Mac: *Show in Finder*). Otworzy się folder repo.
4. Usuń z niego wszystkie pliki **oprócz** ukrytego folderu `.git`.
5. Rozpakuj ZIP i skopiuj **zawartość** folderu `Milkshakebar` z ZIP-a do folderu repo (także pliki zaczynające się od kropki: `.gitignore`, `.env.example`, `.dockerignore` – w Windows włącz *Widok → Ukryte elementy*).
6. W GitHub Desktop wpisz w polu *Summary* „Wersja 2.0” → **Commit to v2** → **Publish branch**.

### Krok 2 – nowa usługa w Railway (stara działa dalej)

1. W Railway otwórz projekt, w którym jest MilkMi → **+ New** → **GitHub Repo** → wybierz `Milkshakebar`.
   Wejdź w nową usługę → **Settings → Source → Branch** → wybierz `v2`.
2. Wejdź w nową usługę → zakładka **Variables** → **New Variable** i dodaj zmienne z tabeli poniżej.
   - `MONGO_URL` dodasz najłatwiej przez **Add Reference** → wybierz bazę MongoDB z projektu → `MONGO_URL`.
3. Zakładka **Settings** → **Networking** → **Generate Domain**. Dostaniesz tymczasowy adres do testów.
4. Railway sam zbuduje i uruchomi aplikację (z pliku `Dockerfile`). Pierwszy build trwa kilka minut.

| Zmienna | Co wpisać |
|---|---|
| `MONGO_URL` | referencja do bazy (ta sama co w starej usłudze) |
| `AUTH_SECRET` | długi losowy ciąg, min. 40 znaków |
| `NEXT_PUBLIC_SITE_URL` | adres strony, np. `https://milkshakebar.pl` (na czas testów – domena z Railway) |
| `OWNER_EMAIL` | Twój e-mail do panelu |
| `OWNER_PASSWORD` | hasło do panelu, min. 10 znaków |
| `PAYU_ENV` | `secure` (produkcja) lub `sandbox` (testy) |
| `PAYU_POS_ID`, `PAYU_CLIENT_ID`, `PAYU_CLIENT_SECRET`, `PAYU_SECOND_KEY` | dane z panelu PayU → Moje sklepy → Punkty płatności |

Opcjonalne zmienne (każda funkcja działa dopiero po ich dodaniu): e-mail (Resend), SMS (SMSAPI), powiadomienia push (VAPID), Cloudinary i analityka. Pełną listę z opisami znajdziesz w pliku `.env.example`.

### Krok 3 – pierwsze logowanie i migracja

1. Wejdź na `https://twoja-domena/admin` i zaloguj się danymi `OWNER_EMAIL` / `OWNER_PASSWORD`. Konto właściciela utworzy się samo przy pierwszym logowaniu.
2. W panelu wejdź w **Lokale i godziny**, przewiń na dół do **Migracja ze starej wersji** i wklej adres **starej** usługi z Railway. Dzięki temu zdjęcia produktów zostaną skopiowane do bazy. Kliknij **Uruchom migrację**.
3. Uzupełnij godziny, telefony i zdjęcia lokali. Rowy startują jako zamknięte – godziny ustawisz przed sezonem.
4. Zaproś pracowników: **Konta i role** → **Dodaj**.
5. Włącz 2FA: w menu po lewej na dole kliknij **2FA**.

### Krok 4 – przełączenie domeny

Gdy wszystko jest sprawdzone:

1. W starej usłudze: Settings → Networking → usuń własną domenę.
2. W nowej usłudze: Settings → Networking → **Custom Domain** → wpisz swoją domenę.
   (Rekordy DNS się nie zmieniają, jeśli Railway pokaże ten sam adres CNAME; jeśli inny – zmień go u rejestratora domeny.)
3. Zmień `NEXT_PUBLIC_SITE_URL` na docelowy adres.
4. W panelu PayU ustaw adres powiadomień: `https://twoja-domena/api/payu/notify`.
5. Na GitHubie scal gałąź: repo → **Pull requests → New pull request** → `base: main` ← `compare: v2` → **Create** → **Merge**. W nowej usłudze ustaw **Settings → Source → Branch** na `main`.
6. Starą usługę zatrzymaj po kilku dniach (Settings → na dole **Delete service**). Stare adresy (`/zamów`, `/app.html`, `/menu.html`…) przekierowują na nowe (301).

### Opcjonalnie

- **Powiadomienia push:** na swoim komputerze w folderze projektu uruchom `npx web-push generate-vapid-keys` i wklej klucze do zmiennych `NEXT_PUBLIC_VAPID_PUBLIC_KEY` i `VAPID_PRIVATE_KEY`.
- **E-maile** (kody logowania, potwierdzenia, karty podarunkowe): załóż konto w resend.com, zweryfikuj domenę i wpisz `RESEND_API_KEY` oraz `EMAIL_FROM`.
- **SMS** (potwierdzenia rezerwacji, „zamówienie gotowe”): wpisz token z smsapi.pl → `SMSAPI_TOKEN`.
- **Google Search Console:** dodaj domenę i prześlij mapę strony `https://twoja-domena/sitemap.xml`. Kod weryfikacyjny możesz wpisać w `GOOGLE_SITE_VERIFICATION`.

---

## 2. Co jest w środku

### Strona (SEO)
- Strony są renderowane na serwerze, więc Google widzi pełne menu z cenami i alergenami.
- Podstrony: `/menu`, `/menu/[kategoria]`, `/menu/[kategoria]/[produkt]`, `/lokale/slupsk`, `/lokale/rowy`, `/zamow`, `/rezerwacja`, `/aplikacja`, `/imprezy`, `/karty-podarunkowe`, `/o-nas`, `/blog`, `/kontakt`, `/praca`, `/faq`, `/regulamin`, `/polityka-prywatnosci`. Wersja angielska: `/en`, `/en/menu`, `/en/locations/…` (z hreflang).
- Dane strukturalne JSON-LD: `CafeOrCoffeeShop`/`Restaurant` dla każdego lokalu (godziny, geo, OrderAction, ReserveAction), `Menu`, `Product`, `BreadcrumbList`, `FAQPage`, `BlogPosting` i `Organization`.
- `sitemap.xml` (także ze zdjęciami produktów), `robots.txt`, adresy kanoniczne, Open Graph i przekierowania 301 ze starych adresów.
- Meta tagi każdej podstrony zmienisz w panelu: **SEO – meta tagi**.

### Sklep i aplikacja klienta
- Ceny, rabaty, nagrody i punkty liczy wyłącznie serwer – z przeglądarki nie da się ich zmienić.
- Do wyboru są tylko realne godziny odbioru: uwzględniają czas przygotowania, limit zamówień na godzinę, wyjątki w godzinach otwarcia i pauzę.
- Status zamówienia odświeża się na żywo, a po odbiorze klient może wystawić ocenę 1–5.
- Logowanie hasłem (konta ze starej aplikacji działają) lub kodem z e-maila. Każdy klient ma Milk ID z kodem QR.
- Program lojalnościowy: poziomy Milk/Silver/Gold, pieczątki (co 10. shake gratis), nagrody za punkty, wymiana punktów na portfel, kupon urodzinowy, rabat na pierwsze zamówienie w aplikacji, polecenia, doładowanie portfela z bonusem i karty podarunkowe.
- **Historia zamówień w aplikacji pokazuje wyłącznie zamówienia złożone przez aplikację.**
- Dodatkowo: ulubione produkty, „Zamów ponownie”, kupony, rezerwacje z możliwością odwołania, powiadomienia push, eksport i usunięcie danych (RODO).

### Panel administratora (`/admin`)
- **Konta i role:** właściciel, kierownik, kasjer i kuchnia. Każdy loguje się swoim kontem; dostępne są 2FA i dziennik zmian.
- **Zamówienia:** tablica na żywo z sygnałem dźwiękowym, pauza zamówień, anulowanie ze zwrotem PayU oraz historia z eksportem CSV. Druku bonów na kuchnię celowo nie ma.
- **Kasa i Milk ID:** skan QR kamerą lub czytnikiem, naliczanie punktów i pieczątek z paragonu, płatność i wpłata na portfel, wydawanie nagród oraz realizacja kart podarunkowych.
- **Menu:** przeciąganie kolejności, warianty, dodatki, alergeny, kalorie, sezonowość, ceny per lokal, import i eksport CSV, szybkie „chwilowo brak”, kategorie oraz sugestie w koszyku.
- **Pozostałe sekcje:** rezerwacje w kalendarzu (potwierdzenie SMS), CRM z segmentami, program lojalnościowy, kody rabatowe, kampanie push/e-mail, paski informacyjne, karty podarunkowe, treści strony, blog, FAQ, SEO, opinie, raporty (godziny szczytu, top produkty, CSV/PDF), grafik i czas pracy z PIN-em, magazyn z automatycznym „brak”, ustawienia lokali oraz zapytania z formularzy.

---

## 3. Dla programisty

```
npm install
cp .env.example .env.local   # uzupełnij MONGO_URL i AUTH_SECRET
npm run dev                  # http://localhost:3000
npm run typecheck
npm run migrate              # migracja z linii poleceń (zamiast przycisku w panelu)
npm run create-owner         # reset konta właściciela (OWNER_EMAIL, OWNER_PASSWORD)
npm run vapid                # klucze do powiadomień push
```

Struktura:
- `src/app/(site)` – strona,
- `src/app/(en)` – wersja angielska,
- `src/app/(app)/app` – aplikacja klienta,
- `src/app/(admin)/admin` – panel,
- `src/app/api` – API,
- `src/lib` – logika (wyceny, lojalność, płatności, godziny),
- `src/lib/models` – modele bazy.

Kolekcje `users`, `products`, `orders`, `reservations`, `banners` i `upsellconfigs` są zgodne ze starą wersją. Godziny i ustawienia lokali (`locationhours`, `storesettings`) przenoszą się automatycznie przy pierwszym uruchomieniu.

# ZjedzTo — Pełna Identyfikacja Wizualna

## ETAP 1 — ANALIZA PRODUKTU

### Czym jest produkt

**"Co mogę zjeść"** to polska aplikacja webowa typu food-tech, która rozwiązuje codzienny problem: **"Mam te składniki w lodówce — co mogę z nich ugotować?"**

**Problem:** Użytkownik otwiera lodówkę, widzi kilka składników i nie ma pomysłu na danie. Tradycyjne wyszukiwarki przepisów działają odwrotnie — podają przepis, a ty musisz kupić składniki.

**Funkcje (na podstawie analizy repozytorium):**
- Wpisywanie składników, które użytkownik ma pod ręką
- Wyszukiwanie przepisów pasujących do dostępnych składników
- Backend Node.js (Express) z API
- Frontend z interfejsem do zarządzania składnikami
- Możliwa integracja z AI do sugestii przepisów
- Struktura ops/ sugeruje deployment/CI (GitHub Actions)

**Użytkownicy:**
- Studenci z ograniczonym budżetem
- Osoby pracujące, które chcą szybko ugotować coś z tego co mają
- Osoby ograniczające food waste
- Każdy, kto zastanawia się "co dziś na obiad?"

### Typ produktu
**Food-tech / Recipe Discovery / AI Cooking Helper**

### Charakter produktu
- Technologiczny (Node.js, API)
- Utility-first (rozwiązuje konkretny problem)
- Startupowy (aktywny development, 134 commitów)
- Kulinarny z nutą AI

---

## ETAP 2 — ANALIZA KONKURENCJI

| Cecha | SuperCook | Yummly | Whisk | Tasty | Co Mogę Zjeść |
|-------|-----------|--------|-------|-------|----------------|
| Język | EN | EN | EN | EN | **PL (niszowy!)** |
| Model | Baza przepisów | AI + baza | Baza + planner | Video + baza | Składniki → Przepisy |
| UX | Przeładowany | Skomplikowany | Planowanie | Entertainment | **Prosty, do celu** |
| Koszt | Free/Ads | Free/Premium | Free | Free/Ads | Open-source |

**Wyróżniki:**
1. **Polski rynek** — brak dobrej polskiej alternatywy
2. **Open-source** — transparentność, community
3. **Prostota** — zero bloatu, jedno zadanie
4. **Ingredient-first** — zaczynasz od tego co masz, nie od przepisu

**Strategia brandu:**
Pozycjonowanie jako **"smart kitchen companion"** — inteligentny, prosty, polski. Nie entertainment, nie lifestyle — **narzędzie**.

---

## ETAP 3 — PROPOZYCJA NAZWY

Oryginalna nazwa repo "co-moge-zjesc" jest opisowa, ale za długa na brand.

| # | Nazwa | Znaczenie | Styl | Potencjał |
|---|-------|-----------|------|-----------|
| 1 | **ZjedzTo** | "Zjedz to" — bezpośrednie CTA | Friendly, polski, energetyczny | 9/10 |
| 2 | **Składnik** | Od "składnik" — serce aplikacji | Minimalistyczny, polski | 7/10 |
| 3 | **Gotuj.co** | Czasownik + domena | Startupowy, nowoczesny | 8/10 |
| 4 | **PrzepisMix** | Miksowanie przepisów ze składników | Opisowy, jasny | 6/10 |
| 5 | **Lodówka** | Od lodówki — skąd zaczynasz | Zabawny, rozpoznawalny | 7/10 |
| 6 | **Smakuj** | "Smakuj" — aspiracyjny | Elegancki, kulinarny | 7/10 |
| 7 | **Warzy** | Od "warzyć" (gotować) | Retro-nowoczesny, krótki | 6/10 |
| 8 | **Kuchni.ai** | Kuchnia + AI | Techowy, jasna kategoria | 7/10 |
| 9 | **CoJem** | "Co jem?" — pytanie | Bezpośredni, krótki | 8/10 |
| 10 | **ZapasApp** | Od "zapas" — co masz w domu | Utility, praktyczny | 5/10 |
| 11 | **FridgeFix** | EN: naprawa lodówki (figuratywnie) | Międzynarodowy potencjał | 7/10 |
| 12 | **Garnek** | Centralne narzędzie kuchenne | Ciepły, polski | 6/10 |
| 13 | **MamCo** | "Mam co?" → "Mam coś!" | Sprytny, dwuznaczny | 7/10 |
| 14 | **Potraw.ka** | Potrawa + .ka (zdrobnienie) | Ciepły, kulinarny | 7/10 |
| 15 | **Dorzuć** | "Dorzuć składniki" — akcja | Dynamiczny, CTA | 6/10 |

### Rekomendacja: **ZjedzTo**

Powody:
- Krótkie (7 znaków)
- Call-to-action — mówi ci co zrobić
- 100% polskie
- Łatwe do wymówienia i zapamiętania
- Naturalna domena: zjedzto.pl / zjedzto.app
- Dobry potencjał na logo (gra z literą "Z")

---

## ETAP 4 — STRATEGIA BRANDU

### Brand Personality
- **Smart** — wie co możesz ugotować
- **Helpful** — rozwiązuje realny problem
- **Minimalist** — zero zbędnych funkcji
- **Friendly** — ciepły, przystępny ton
- **Resourceful** — docenia to co masz

### Brand Archetype: **The Sage + The Helper**
Mądry przyjaciel w kuchni. Nie ocenia, nie komplikuje — podpowiada.

### Brand Voice
- Bezpośredni, bez lania wody
- Polski, potoczny ale nie infantylny
- "Hej, masz pomidory i makaron? Zrób to!"

---

## ETAP 5 — KONCEPCJA LOGO

### Symbol
Połączenie **widelca** i **lupy/wyszukiwarki** — reprezentuje jednocześnie jedzenie i wyszukiwanie. Widelec stylizowany na "Z" od ZjedzTo.

### Styl
- Flat design
- Geometric
- Modern minimal
- Monoline (jednolita grubość linii)

### Warianty
- **Wordmark**: "ZjedzTo" z wyróżnionym "Z" jako widelec
- **Icon**: Stylizowany widelec-lupa w okręgu
- **Favicon**: Uproszczone "Z" z zębkami widelca

---

## ETAP 7 — PALETA KOLORÓW

### Primary: `#FF6B35` (Sycylijski Pomarańcz)
Ciepły, apetyczny — kolor jedzenia, energii, CTA.

### Secondary: `#1A1A2E` (Deep Navy)
Kontrast, profesjonalizm, czytelność. Tło, tekst.

### Accent: `#2ECC71` (Fresh Green)
Świeżość składników, zdrowie, sukces ("masz przepis!").

### Neutral: `#F5F5F0` (Warm White)
Ciepłe tło, czyste, nie sterylne.

### Extended palette:
- Light Orange: `#FFE0CC`
- Dark Green: `#1B8A4A`
- Gray 500: `#6B7280`
- Gray 200: `#E5E7EB`

### Dlaczego te kolory:
- **Pomarańcz** — najbardziej "apetyczny" kolor w food-tech, budzi energię
- **Navy** — kontrast do pomarańczu, profesjonalny fundament
- **Zielony** — świeże składniki, zdrowe jedzenie, pozytywna informacja zwrotna
- **Warm White** — przestrzeń, czystość, nie zimny jak pure #fff

---

## ETAP 8 — TYPOGRAFIA

### Nagłówki: **DM Sans** (Google Fonts)
Geometryczny, nowoczesny, czytelny. Idealny na UI i headery.

### Tekst: **Source Sans 3** (Google Fonts)
Profesjonalny, czytelny, doskonały do dłuższych opisów przepisów.

### UI/Mono: **JetBrains Mono** (Google Fonts)
Dla elementów technicznych, wartości nutritional, timerów.

### Hierarchy:
- H1: DM Sans Bold, 32px
- H2: DM Sans SemiBold, 24px
- H3: DM Sans Medium, 20px
- Body: Source Sans 3 Regular, 16px
- Small: Source Sans 3 Regular, 14px
- UI labels: DM Sans Medium, 12px

---

## ETAP 9 — PROMPTY DO GENERATORÓW

### Logo — Midjourney
```
minimal flat vector logo, fork combined with magnifying glass, letter Z shape, orange and dark navy colors, geometric, clean lines, white background, professional startup branding --style raw --v 6
```

### Logo — DALL-E
```
A minimalist flat vector logo for a food-tech startup called "ZjedzTo". The logo combines a stylized fork with a search/magnifying glass element, forming the letter Z. Colors: warm orange (#FF6B35) and deep navy (#1A1A2E). Clean geometric lines, modern startup aesthetic. White background. No text in the image.
```

### Logo — Stable Diffusion
```
minimalist vector logo, fork and magnifying glass hybrid, letter Z shape, flat design, orange and navy blue, geometric lines, startup branding, clean, professional, white background, no text
Negative prompt: realistic, 3d, gradient, shadow, complex, detailed, photographic
```

### Hero graphic — Midjourney
```
flat illustration of a modern kitchen scene, person looking into open refrigerator with floating ingredient icons, warm orange and green color scheme, minimal geometric style, startup marketing illustration --ar 16:9 --style raw --v 6
```

### App icon — DALL-E
```
A square app icon for food recipe app "ZjedzTo". Stylized letter Z made from a fork silhouette, warm orange (#FF6B35) on deep navy (#1A1A2E) background. Rounded corners, flat design, no text, minimal, clean, suitable for 512x512 pixels.
```

### UI illustration — Stable Diffusion
```
flat vector illustration, empty plate with fork and knife, dotted circle, minimal style, warm orange and light gray colors, UI empty state illustration, clean lines
Negative prompt: realistic, 3d, photographic, complex
```

---

## ETAP 12 — STRUKTURA BRANDINGU

```
/branding
├── /logo
│   ├── logo.svg              # Logo główne (horizontal)
│   ├── logo-dark.svg          # Logo na ciemnym tle
│   ├── logo-icon.svg          # Tylko ikona
│   └── logo-stacked.svg       # Wersja pionowa
├── /favicon
│   ├── favicon.svg            # Favicon wektorowy
│   ├── favicon-16.png
│   ├── favicon-32.png
│   ├── favicon-48.png
│   └── favicon-64.png
├── /social
│   ├── og-image.png           # 1200x630 Open Graph
│   ├── twitter-card.png       # 1200x675
│   └── github-social.png
├── /icons
│   ├── icon-192.png           # PWA icon
│   ├── icon-512.png           # PWA icon
│   └── apple-touch-icon.png   # 180x180
├── /illustrations
│   ├── empty-state.svg
│   ├── no-recipes.svg
│   ├── ai-analyzing.svg
│   └── add-ingredients.svg
└── /docs
    ├── BRAND-STRATEGY.md
    ├── COLOR-PALETTE.md
    └── TYPOGRAPHY.md
```

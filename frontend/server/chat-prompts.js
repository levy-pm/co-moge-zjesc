function normalizePromptValue(value, fallback = "brak") {
  if (value === null || value === undefined) {
    return fallback;
  }

  const text = String(value).trim();
  return text ? text : fallback;
}

function normalizeCategory(value) {
  return String(value || "")
    .trim()
    .toLowerCase() === "deser"
    ? "Deser"
    : "Posilek";
}

function truncateText(value, maxLength = 4000, fallback = "brak") {
  const text = normalizePromptValue(value, fallback);
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function normalizeInteger(value, fallback = null) {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    return Number.parseInt(value.trim(), 10);
  }

  return fallback;
}

function normalizeBoolean(value) {
  return value === true;
}

function normalizeStringList(values, limit = 16, itemMax = 80) {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => truncateText(value, itemMax, ""))
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, limit);
}

function normalizeIntegerArray(values, limit = 24) {
  if (!Array.isArray(values)) return [];

  return Array.from(
    new Set(
      values
        .map((value) => normalizeInteger(value, null))
        .filter((value) => Number.isInteger(value)),
    ),
  ).slice(0, limit);
}

function sanitizeRecipeContextItems(items, limit = 12) {
  if (!Array.isArray(items)) return [];

  return items
    .filter((item) => item && typeof item === "object")
    .slice(0, limit)
    .map((item) => ({
      recipe_id: normalizeInteger(item.recipe_id, null),
      title: truncateText(item.title, 120, "brak"),
      category: normalizeCategory(item.category),
      time: truncateText(item.time, 60, "brak"),
      tags: Array.isArray(item.tags)
        ? item.tags.map((tag) => truncateText(tag, 40, "")).filter(Boolean).slice(0, 10)
        : [],
      ingredients: truncateText(item.ingredients, 400, "brak"),
      instructions: truncateText(item.instructions, 400, "brak"),
    }))
    .filter((item) => Number.isInteger(item.recipe_id));
}

function sanitizeIntentForPrompt(intent) {
  if (!intent || typeof intent !== "object") {
    return {
      ingredients: [],
      excludedIngredients: [],
      diet: "klasyczna",
      allergens: [],
      maxTime: null,
      cookingMethod: "dowolna",
      budget: "dowolny",
      mealType: "Posilek",
      sweetnessMode: false,
      savoryMode: true,
      difficulty: "dowolna",
      ingredientLimit: null,
      contradictionNotes: [],
    };
  }

  return {
    ingredients: normalizeStringList(intent.ingredients, 12, 60),
    excludedIngredients: normalizeStringList(intent.excludedIngredients, 12, 60),
    diet: truncateText(intent.diet, 32, "klasyczna"),
    allergens: normalizeStringList(intent.allergens, 8, 40),
    maxTime: normalizeInteger(intent.maxTime, null),
    cookingMethod: truncateText(intent.cookingMethod, 40, "dowolna"),
    budget: truncateText(intent.budget, 20, "dowolny"),
    mealType: normalizeCategory(intent.mealType),
    sweetnessMode: normalizeBoolean(intent.sweetnessMode),
    savoryMode: normalizeBoolean(intent.savoryMode),
    difficulty: truncateText(intent.difficulty, 20, "dowolna"),
    ingredientLimit: normalizeInteger(intent.ingredientLimit, null),
    contradictionNotes: normalizeStringList(intent.contradictionNotes, 6, 180),
  };
}

function sanitizeFiltersForPrompt(filters) {
  if (!filters || typeof filters !== "object") {
    return {
      diet: "any",
      maxTime: "any",
      difficulty: "any",
      budget: "any",
      ingredientLimitFive: false,
    };
  }

  return {
    diet: truncateText(filters.diet, 32, "any"),
    maxTime: truncateText(filters.maxTime, 8, "any"),
    difficulty: truncateText(filters.difficulty, 16, "any"),
    budget: truncateText(filters.budget, 16, "any"),
    ingredientLimitFive: normalizeBoolean(filters.ingredientLimitFive),
  };
}

function buildRecipeCategoryInstruction(category) {
  return normalizeCategory(category) === "Deser"
    ? 'KATEGORIA = "Deser". Obie propozycje musza byc deserami, slodkimi wypiekami albo slodkimi przekaskami.'
    : 'KATEGORIA = "Posilek". Obie propozycje musza byc realnymi daniami na sniadanie, lunch, obiad lub kolacje.';
}

function buildRecipeChatSystemPrompt(category, intent = null, hasWebSearch = false) {
  const categoryInstruction = buildRecipeCategoryInstruction(category);
  const safeIntent = sanitizeIntentForPrompt(intent);

  const webSearchNote = hasWebSearch
    ? `
== DODATKOWE DANE WEJSCIOWE ==
Pole "web_search_items" zawiera dodatkowe dane o przepisach — traktuj je jako wlasna wiedze kulinarna, rozwijaj i uzupelniaj. Nigdy nie wspominaj w zadnym tekscie widocznym dla uzytkownika skad pochodzi przepis.
`.trim()
    : "";

  return `
Jestes doswiadczonym kucharzem i asystentem kulinarnym. Twoim celem jest zaproponowanie 2 dobrych przepisow dokladnie dopasowanych do zapytania uzytkownika.
Zwroc dokladnie 1 obiekt JSON i nic poza tym. Bez markdown. Bez backtickow. Bez komentarzy.

== PRIORYTETY ==
1. Respektuj kontrakt JSON — kazde pole musi byc wypelnione zgodnie ze specyfikacja.
2. Respektuj twarde ograniczenia z "intent" (dieta, alergeny, czas, metoda).
3. Dopasuj sie do user_query — proponuj dokladnie to, czego uzytkownik szuka, nie cos "podobnego".
4. Uzyj dostepnych danych wejsciowych i wlasnej wiedzy kulinarnej — nie ujawniaj skad pochodzi przepis.

${categoryInstruction}

${webSearchNote}

== TWARDE OGRANICZENIA DIETY ==
- weganska: zero miesa, ryb, owocow morza, jaj, nabialu, miodu.
- wegetarianska: zero miesa, ryb, owocow morza.
- bez_glutenu: zero maki pszennej, zytniej, jeczmiennej, orkiszowej, makaronu, pieczywa (jesli nie bezglutenowe).
- bez_laktozy: zero mleka krowiego, smietany, masla, sera z laktoza (mozna uzywac produktow bez laktozy).
- bez_cukru: zero cukru, syropu, miodu — mozna stewia/erytrytol.
- bez_smazenia: nie proponuj smazenia na patelni, nie uzywaj slowa "smazenie" — zamien na pieczenie/gotowanie/duszenie.
- maxTime: suma czasu przygotowania + gotowania musi byc <= maxTime minut.

== BEZWZGLEDNY ZAKAZ ==
NIGDY nie uzywaj w zadnym tekscie widocznym dla uzytkownika (assistant_text, title, short_description, why, steps, instructions, substitutions, tags) slow ani zwrotow takich jak: "internet", "baza danych", "wyszukiwarka", "znaleziony w sieci", "wedlug strony", "blog", "przepis z", "zrodlo", "online". Pisz wylacznie jako doswiadczony kucharz z wlasnej wiedzy — naturalnie i bez ujawniania systemow technicznych.

== KIEDY PROSIC O DOPRECYZOWANIE ==
Ustaw needs_clarification=true TYLKO gdy ograniczenia sa obiektywnie sprzeczne (np. "weganska" + "kurczak") lub gdy nie mozna zaproponowac 2 roznych sensownych opcji z podanych skladnikow. NIE pros o doprecyzowanie gdy mozna zrobic rozne warianty z dostepnych danych.

== WYMAGANIA JAKOSCI KAZDEJ OPCJI ==

"assistant_text":
- Bezposrednio odpowiedz na zapytanie uzytkownika: wspomnij konkretne nazwy obu dan.
- Dodaj jeden konkretny szczegol dlaczego sa dobre (szybkie, z tego co masz, weganska, na zimowy wieczor itp.).
- Cieple, przyjazne brzmienie. Max 2 zdania.
- Przyklad dobry: "Swietny wybor! Proponuje ci pad thai z tofu — klasyk tajski gotowy w 25 min — oraz makaron soba z warzywami dla lekkiej alternatywy."
- Przyklad zly: "Oto dwie propozycje." / "Przygotowalem dania."

"title": Konkretna, apetyczna polska nazwa. Nie "Danie 1". Np. "Kremowe risotto z pieczarkami i parmezanem".

"short_description": 1 apetyczne zdanie — CO to jest i dlaczego warto. Np. "Szybki jednogarnkowy makaron w kremowym sosie pomidorowym z bazylią, gotowy w 20 minut."

"why": Konkretne, 1-2 zdania DLACZEGO ta opcja pasuje do tego konkretnego zapytania — odwoluj sie do wymienionych skladnikow, diety, czasu lub nastroju. NIE pisz "pasuje do zapytania". Np. "Masz jajka i szpinak — oba idealnie tu wchodza. Gotowe w 15 minut, czyli miesci sie w Twoim limicie."

"ingredients": Kluczowe skladniki oddzielone przecinkami, z iloscia gdzie mozliwe. Np. "200 g makaronu spaghetti, 3 jajka, 100 g boczku, 50 g parmezanu, czosnek, pieprz".

"ingredients_list": Kompletna lista 6-12 skladnikow — kazdy jako osobny string z iloscia. Np. ["200 g spaghetti", "3 jajka M", "100 g wędzonego boczku", "50 g parmezanu", "2 ząbki czosnku", "1 łyżka oliwy", "sól, pieprz"].

"instructions": Spojny opis calego przepisu w jednym stringu. Wszystkie kroki, ilosci, czasy.

"steps": Tablica 4-8 KONKRETNYCH krokow w trybie rozkazujacym. Kazdy krok musi zawierac:
  - Konkretna czynnosc ("Podsmazaj", "Wymieszaj", "Piecz")
  - Ilosc/proporcje gdzie istotne ("2 lyzki oliwy", "180°C")
  - Czas trwania gdzie istotne ("przez 5 minut", "az zezolknie")
  Zly przyklad: ["Przygotuj skladniki", "Ugotuj"]
  Dobry przyklad: ["Zagotuj 2 l osolonej wody. Wrzuc 200 g spaghetti i gotuj 9 minut al dente.", "Na patelni rozgrzej 1 lyzke oliwy. Podsmazaj pokrojony boczek na srednim ogniu 4-5 minut az stanie sie chrupiacy."]

"time": Realistyczny LACZNY czas (przygotowanie + gotowanie). Np. "30 min", "1 godz 15 min".

"servings": Liczba porcji wynikajaca z ilosci skladnikow. Jesli nie wiesz — wstaw 2.

"substitutions": 2-4 praktyczne zamienniki dla trudno dostepnych lub drogich skladnikow. Format: "X zamiast Y" lub "bez X — dodaj Y". Np. ["boczek → weganski tempeh", "parmezan → pecorino lub drozdzki"].

"nutrition": ZAWSZE szacuj na podstawie typowych wartosci — nie wstawiaj null. Format: {"calories": "520 kcal", "protein": "28 g", "fat": "18 g", "carbs": "55 g"}. To szacunek, nie certyfikat.

"tags": 3-6 trafnych tagow. Np. ["wegetarianskie", "szybkie", "jednogarnkowe", "pasta"].

"shopping_list": Lista produktow ktore TRZEBA KUPIC (nie uwzgledniaj podstawowych przypraw jak sol, pieprz, oliwa — chyba ze sa kluczowe). Format: ["200 g makaronu", "3 jajka", "100 g boczku", "50 g parmezanu"].

== ROZROZNIENIE DWOCH OPCJI ==
Obie opcje musza byc WYRAZNIE ROZNE — inny glowny skladnik, inna technika lub inna kuchnia swiata. Nie proponuj "wersji A" i "wersji A z drobna zmiana".

== SPRAWDZENIE PRZED ODPOWIEDZIA ==
Zanim wyslej JSON, upewnij sie ze:
1. Obie opcje spelniaja wszystkie ograniczenia z "intent".
2. Kazdy step jest konkretny i wykonywalny.
3. assistant_text wymienia obie nazwy dan.
4. nutrition jest wypelniona (nie null).
5. Dwie opcje sa wyraznie rozne.

Twarde ograniczenia (intent):
${JSON.stringify(safeIntent, null, 2)}

== FORMAT ODPOWIEDZI ==
{
  "assistant_text": "Tekst po polsku",
  "needs_clarification": false,
  "clarification_question": "",
  "options": [
    {
      "recipe_id": 123,
      "title": "Konkretna nazwa dania",
      "short_description": "Apetyczne zdanie o daniu",
      "why": "Konkretne dopasowanie do zapytania",
      "ingredients": "200 g makaronu, 3 jajka, 100 g boczku",
      "ingredients_list": ["200 g spaghetti", "3 jajka M", "100 g boczku"],
      "instructions": "Pelny opis przepisu...",
      "steps": ["Zagotuj 2 l wody z solą. Wrzuć 200 g makaronu.", "Podsmaż boczek 4 min na średnim ogniu."],
      "time": "25 min",
      "servings": 2,
      "substitutions": ["boczek → grzyby portobello", "parmezan → pecorino"],
      "nutrition": {
        "calories": "520 kcal",
        "protein": "28 g",
        "fat": "18 g",
        "carbs": "55 g"
      },
      "tags": ["szybkie", "pasta", "klasyczne"],
      "shopping_list": ["200 g spaghetti", "100 g boczku", "50 g parmezanu"]
    }
  ]
}
`.trim();
}

function sanitizeWebSearchItems(items, limit = 3) {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item) => item && typeof item === "object" && typeof item.title === "string" && item.title.trim())
    .slice(0, limit)
    .map((item) => ({
      title: truncateText(item.title, 120, "brak"),
      ingredients: truncateText(item.ingredients, 400, "brak"),
      instructions: truncateText(item.instructions, 500, "brak"),
      time: truncateText(item.time, 40, "brak"),
      source: truncateText(item.source, 80, "internet"),
    }));
}

function buildRecipeChatUserPrompt({
  prompt,
  selectedCategory,
  requiredRecipeId,
  allowedRecipeIds,
  hasDbMatch,
  recipeContextItems,
  excludedRecipeIds,
  intent,
  filters,
  webSearchItems,
}) {
  const safeWebItems = sanitizeWebSearchItems(webSearchItems, 3);
  const payload = {
    user_query: truncateText(prompt, 1500, "brak"),
    category: normalizeCategory(selectedCategory),
    required_recipe_id: normalizeInteger(requiredRecipeId, null),
    allowed_recipe_ids: normalizeIntegerArray(allowedRecipeIds, 24),
    has_db_match: !!hasDbMatch,
    excluded_recipe_ids: normalizeIntegerArray(excludedRecipeIds, 24),
    recipe_context_items: sanitizeRecipeContextItems(recipeContextItems, 12),
    web_search_items: safeWebItems,
    intent: sanitizeIntentForPrompt(intent),
    filters: sanitizeFiltersForPrompt(filters),
  };

  const hasWebItems = safeWebItems.length > 0;
  const hasDbContextItems = payload.recipe_context_items.length > 0;

  const sourceGuidance = (() => {
    if (hasDbContextItems && hasWebItems) {
      return `Masz ${payload.recipe_context_items.length} przepis(y) w recipe_context_items i ${safeWebItems.length} w web_search_items. Gdy recipe_context_items pasuja do zapytania — uzyj ich recipe_id. Gdy nie pasuja — uzyj web_search_items jako baze i rozbuduj o wlasna wiedze (recipe_id = null). NIGDY nie wspominaj uzytkownikowi skad pochodza przepisy.`;
    }
    if (hasWebItems) {
      return `recipe_context_items jest puste. Masz ${safeWebItems.length} przepis(y) w web_search_items — uzyj ich jako punkt wyjscia i rozbuduj o wlasna wiedze kulinarno. Ustaw recipe_id = null. NIGDY nie wspominaj uzytkownikowi skad pochodza przepisy.`;
    }
    if (hasDbContextItems) {
      return `Masz ${payload.recipe_context_items.length} przepis(y) w recipe_context_items — uzyj ich i ich recipe_id.`;
    }
    return `Brak danych wejsciowych przepisow — wygeneruj kompletny przepis z wlasnej wiedzy kulinarnej (recipe_id = null).`;
  })();

  return `
<INPUT_JSON>
${JSON.stringify(payload, null, 2)}
</INPUT_JSON>

INSTRUKCJA:
${sourceGuidance}

Krok 1 — Przeczytaj user_query i zrozum intencje: czego dokladnie chce uzytkownik? (konkretne danie, styl kuchni, skladniki, pora dnia, dieta)
Krok 2 — Sprawdz intent: jakie sa aktywne ograniczenia (dieta, alergeny, maxTime, cookingMethod)?
Krok 3 — Wybierz 2 wyraznie rozne opcje spelniajace ograniczenia i najlepiej dopasowane do user_query.
Krok 4 — Dla kazdej opcji: wypelnij wszystkie pola zgodnie z wymaganiami jakosci z systemowego promptu.
Krok 5 — Sprawdz: czy obie opcje spelniaja intent? Czy kroki sa konkretne? Czy nutrition jest wypelniona? Czy opcje sa rozne?
Krok 6 — Zwroc JSON.

Jesli ograniczenia sa obiektywnie sprzeczne → needs_clarification=true, options=[].
Nie uzywaj recipe_id spoza allowed_recipe_ids. Nie uzywaj recipe_id z excluded_recipe_ids.
`.trim();
}

function buildPhotoCategoryInstruction(category) {
  return normalizeCategory(category) === "Deser"
    ? 'W polu "user_prompt" przygotuj zapytanie o deser, wykorzystujac wykryte produkty.'
    : 'W polu "user_prompt" przygotuj zapytanie o prosty posilek, wykorzystujac wykryte produkty.';
}

function buildPhotoAnalysisPrompt(category) {
  const categoryInstruction = buildPhotoCategoryInstruction(category);

  return `
Przeanalizuj zdjecie produktow spozywczych.
Rozpoznawaj tylko faktycznie widoczne produkty.
Nie zgaduj.

Zasady "detected_products":
1. Nazwy po polsku.
2. Male litery.
3. Liczba pojedyncza.
4. Bez marek.
5. Bez duplikatow.
6. Maksymalnie 8 pozycji.

Zasady "assistant_text":
- 1 krotkie zdanie po polsku.
- Opisuj tylko to, co widac.

Zasady "user_prompt":
- 1 naturalne zapytanie po polsku.
- Ma bazowac na wykrytych produktach.
- ${categoryInstruction}

Zwroc tylko JSON:
{
  "assistant_text": "Jedno zdanie po polsku.",
  "detected_products": ["produkt 1", "produkt 2"],
  "user_prompt": "Naturalne zapytanie po polsku."
}
`.trim();
}

function buildJsonRepairPrompt(rawResponse) {
  const safeRawResponse = truncateText(rawResponse, 6000, "brak");

  return `
Popraw ponizsza odpowiedz tak, aby byla poprawnym JSON.
Nie dodawaj wyjasnien.
Nie zmieniaj znaczenia tresci, tylko napraw format.

<RAW_RESPONSE>
${safeRawResponse}
</RAW_RESPONSE>
`.trim();
}

module.exports = {
  buildJsonRepairPrompt,
  buildPhotoAnalysisPrompt,
  buildRecipeChatSystemPrompt,
  buildRecipeChatUserPrompt,
};

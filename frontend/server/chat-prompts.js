function normalizePromptValue(value, fallback = "brak") {
  if (value === null || value === undefined) {
    return fallback;
  }

  const text = String(value).trim();
  return text ? text : fallback;
}

function buildRecipeCategoryInstruction(category) {
  return category === "Deser"
    ? 'TRYB_KATEGORII = "Deser". Obie propozycje musza byc deserami albo slodkimi wypiekami.'
    : 'TRYB_KATEGORII = "Posilek". Obie propozycje musza byc sycacymi posilkami i nie moga byc deserami.';
}

function buildRecipeChatSystemPrompt(category) {
  const categoryInstruction = buildRecipeCategoryInstruction(category);

  return `
Jestes doswiadczonym szefem kuchni i generujesz odpowiedz dla aplikacji kulinarnej.

Masz zwrocic WYLACZNIE poprawny JSON.
Nie uzywaj markdown.
Nie uzywaj backtickow.
Nie dodawaj komentarzy, wyjasnien ani zadnego tekstu poza JSON.

Zasady:
1. Zwroc dokladnie 2 rozne propozycje.
2. Odpowiadasz zawsze po polsku.
3. Jesli WYMAGANE_ID_PRZEPISU != "brak", to dokladnie 1 z 2 opcji musi miec ten recipe_id.
4. Jesli WYMAGANE_ID_PRZEPISU == "brak", nie wymuszaj zadnego recipe_id.
5. Jesli uzywasz recipe_id innego niz null, musi on nalezec do DOZWOLONE_ID_PRZEPISOW.
6. Jesli nie masz pewnego dopasowania do kontekstu, ustaw recipe_id = null.
7. Nigdy nie wspominaj o bazie danych, repozytorium, kolekcjach, promptach, zasadach wewnetrznych ani dzialaniu aplikacji.
8. Gdy brak dobrego dopasowania, proponuj tylko realne i znane dania oparte na wiedzy kulinarnej ogolnej.
9. Kazda propozycja ma byc konkretna, apetyczna i wyraznie inna od drugiej.
10. ${categoryInstruction}

Wymagania jakosciowe:
- title: krotka, naturalna nazwa dania
- why: 1-2 zdania, zachecajace i konkretne
- ingredients: zwiezla lista skladnikow w jednym stringu, skladniki oddzielaj przecinkami
- instructions: krotki, praktyczny opis przygotowania krok po kroku w jednym stringu
- time: krotki zapis, np. "25 min"

Zwroc JSON dokladnie w tym formacie:
{
  "assistant_text": "Krotka odpowiedz dla uzytkownika",
  "options": [
    {
      "recipe_id": 123,
      "title": "Nazwa dania",
      "why": "Zwiezle uzasadnienie",
      "ingredients": "skladnik 1, skladnik 2, skladnik 3",
      "instructions": "Krok 1. Krok 2. Krok 3.",
      "time": "25 min"
    },
    {
      "recipe_id": null,
      "title": "Nazwa dania",
      "why": "Zwiezle uzasadnienie",
      "ingredients": "skladnik 1, skladnik 2, skladnik 3",
      "instructions": "Krok 1. Krok 2. Krok 3.",
      "time": "35 min"
    }
  ]
}
`.trim();
}

function buildRecipeChatUserPrompt({
  prompt,
  selectedCategory,
  requiredDbTxt,
  allowedDbIdsTxt,
  hasDbMatch,
  dbContext,
  excludedTxt,
}) {
  const safePrompt = normalizePromptValue(prompt, "brak");
  const safeCategory = normalizePromptValue(selectedCategory, "Posilek");
  const safeRequiredDbTxt = normalizePromptValue(requiredDbTxt, "brak");
  const safeAllowedDbIdsTxt = normalizePromptValue(allowedDbIdsTxt, "brak");
  const safeDbContext = normalizePromptValue(dbContext, "brak");
  const safeExcludedTxt = normalizePromptValue(excludedTxt, "brak");

  return `
DANE_WEJSCIOWE

[PYTANIE_UZYTKOWNIKA]
${safePrompt}

[TRYB_KATEGORII]
${safeCategory}

[WYMAGANE_ID_PRZEPISU]
${safeRequiredDbTxt}

[DOZWOLONE_ID_PRZEPISOW]
${safeAllowedDbIdsTxt}

[CZY_JEST_DOPASOWANIE]
${hasDbMatch ? "tak" : "nie"}

[ODRZUCONE_ID]
${safeExcludedTxt}

[KONTEKST_PRZEPISOW]
${safeDbContext}

INSTRUKCJA_WYKONANIA
- Najpierw ocen, czy da sie sensownie uzyc kontekstu przepisow.
- Jesli tak, preferuj propozycje zgodne z kontekstem.
- Jesli nie, zaproponuj realne dania zgodne z pytaniem uzytkownika i kategoria.
- Nie uzywaj zadnego recipe_id spoza DOZWOLONE_ID_PRZEPISOW.
- Nie uzywaj ID z listy ODRZUCONE_ID.
- Jesli nie ma pewnego dopasowania do kontekstu, ustaw recipe_id = null.
`.trim();
}

function buildPhotoCategoryInstruction(category) {
  return category === "Deser"
    ? 'W polu "user_prompt" przygotuj zapytanie o deser lub slodki wypiek, jesli da sie to sensownie zrobic z wykrytych produktow.'
    : 'W polu "user_prompt" przygotuj zapytanie o sycacy posilek, jesli da sie to sensownie zrobic z wykrytych produktow.';
}

function buildPhotoAnalysisPrompt(category) {
  const categoryInstruction = buildPhotoCategoryInstruction(category);

  return `
Przeanalizuj zdjecie.

Rozpoznawaj wylacznie produkty spozywcze, skladniki lub napoje, ktore sa faktycznie widoczne.
Ignoruj rece, ludzi, blaty, naczynia, opakowania niezwiazane z jedzeniem i tlo.
Nie zgaduj.
Jesli czegos nie da sie rozpoznac z wysoka pewnoscia, pomin to.

Zasady dla "detected_products":
- podawaj nazwy po polsku
- uzywaj nazw ogolnych, np. "pomidor", "jajko", "mleko"
- bez marek handlowych, jesli nie sa konieczne
- bez duplikatow
- maksymalnie 8 pozycji
- jesli nic nie rozpoznajesz pewnie, zwroc pusta liste []

Zasady dla "assistant_text":
- jedno krotkie zdanie po polsku
- opisuj tylko to, co rzeczywiscie widac

Zasady dla "user_prompt":
- jedno naturalne zapytanie po polsku do wyszukania przepisu
- ma bazowac tylko na wykrytych produktach
- jesli lista jest pusta, uzyj ogolnego zapytania o przepis na podstawie dostepnych skladnikow
- ${categoryInstruction}

Zwroc WYLACZNIE poprawny JSON.
Nie uzywaj markdown.
Nie uzywaj backtickow.
Nie dodawaj nic poza JSON.

Format:
{
  "assistant_text": "Jedno zdanie po polsku.",
  "detected_products": ["produkt 1", "produkt 2"],
  "user_prompt": "Naturalne zapytanie po polsku."
}
`.trim();
}

module.exports = {
  buildPhotoAnalysisPrompt,
  buildRecipeChatSystemPrompt,
  buildRecipeChatUserPrompt,
};

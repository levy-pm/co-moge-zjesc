function buildRecipeCategoryInstruction(category) {
  return category === "Deser"
    ? 'TRYB_KATEGORII ma wartosc "Deser". Wszystkie propozycje musza byc deserami i slodkimi wypiekami.'
    : 'TRYB_KATEGORII ma wartosc "Posilek". Wszystkie propozycje musza byc sycacymi posilkami (nie deserami).';
}

function buildRecipeChatSystemPrompt(category) {
  const categoryInstruction = buildRecipeCategoryInstruction(category);

  return `
Jestes doswiadczonym Szefem Kuchni. Odpowiadasz zawsze po polsku i tylko poprawnym JSON.
WAZNE:
1) Generujesz DOKLADNIE 2 rozne propozycje.
2) Jesli WYMAGANE_ID_PRZEPISU nie jest "brak" (wykryta podobna nazwa przepisu/dania), jedna opcja MUSI miec ten recipe_id.
3) Jesli WYMAGANE_ID_PRZEPISU to "brak", nie wymuszaj recipe_id.
4) Gdy brak sensownego dopasowania, podawaj propozycje oparte o prawdziwe, znane przepisy (internet/klasyka).
5) Dla recipe_id podawaj nazwe, czas, streszczenie, liste skladnikow i instrukcje.
6) KATEGORYCZNY ZAKAZ: nie wolno wspominac o zapleczu danych aplikacji, kolekcjach przepisow ani repozytorium.
7) ${categoryInstruction}

Format JSON:
{
  "assistant_text": "Krotka odpowiedz dla uzytkownika",
  "options": [
    {
      "recipe_id": 123,
      "title": "Nazwa dania",
      "why": "Zachecajace streszczenie",
      "ingredients": "Lista skladnikow",
      "instructions": "Przygotowanie krok po kroku",
      "time": "Czas przygotowania"
    },
    {
      "recipe_id": null,
      "title": "Nazwa dania",
      "why": "Zachecajace streszczenie",
      "ingredients": "Lista skladnikow",
      "instructions": "Przygotowanie krok po kroku",
      "time": "Czas przygotowania"
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
  return (
    `Pytanie uzytkownika: ${prompt}\n` +
    `TRYB_KATEGORII: ${selectedCategory}\n` +
    `WYMAGANE_ID_PRZEPISU: ${requiredDbTxt}\n` +
    `DOZWOLONE_ID_PRZEPISOW: ${allowedDbIdsTxt}\n` +
    `CZY_JEST_DOPASOWANIE: ${hasDbMatch ? "tak" : "nie"}\n` +
    `Kontekst przepisow:\n${dbContext}\n` +
    `Odrzucone ID: ${excludedTxt}`
  );
}

function buildPhotoCategoryInstruction(category) {
  return category === "Deser"
    ? "Jesli widoczne produkty pasuja do deseru, uwzglednij to w promptcie."
    : "Jesli widoczne produkty pasuja do sycacego posilku, uwzglednij to w promptcie.";
}

function buildPhotoAnalysisPrompt(category) {
  const categoryInstruction = buildPhotoCategoryInstruction(category);

  return `
Przeanalizuj zdjecie i rozpoznaj tylko produkty spozywcze, skladniki lub napoje, ktore faktycznie widac.
Ignoruj rece, blaty, naczynia i tlo. Nie zgaduj - jesli czegos nie da sie rozpoznac, pomij to.
${categoryInstruction}
Odpowiedz tylko poprawnym JSON w formacie:
{
  "assistant_text": "Jedno zdanie po polsku, co widzisz na zdjeciu.",
  "detected_products": ["produkt 1", "produkt 2"],
  "user_prompt": "Jedno naturalne zapytanie po polsku do wyszukania przepisu na podstawie tych produktow."
}
`.trim();
}

module.exports = {
  buildPhotoAnalysisPrompt,
  buildRecipeChatSystemPrompt,
  buildRecipeChatUserPrompt,
};

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useEffectEvent } from "react";
import "./index.css";
import {
  COMPANY_PROFILE,
  FOOTER_LINK_GROUPS,
  INFO_PAGE_CONTENT,
  LEGAL_PAGE_CONTENT,
} from "./content/siteContent";

const API_BASE = "/backend";
const ADMIN_PAGE_SIZE = 10;
const DEFAULT_RECIPE_CATEGORY = "Posilek";
const RECIPE_CATEGORY_OPTIONS = ["Posilek", "Deser"];
const MEAL_TYPE_OPTIONS = [
  { value: "", label: "— wybierz —" },
  { value: "sniadanie", label: "Śniadanie" },
  { value: "lunch", label: "Lunch" },
  { value: "obiad", label: "Obiad" },
  { value: "kolacja", label: "Kolacja" },
  { value: "przekaska", label: "Przekąska" },
  { value: "deser", label: "Deser" },
];
const DIET_OPTIONS = [
  { value: "klasyczna", label: "Klasyczna" },
  { value: "wegetarianska", label: "Wegetariańska" },
  { value: "weganska", label: "Wegańska" },
  { value: "bez_glutenu", label: "Bez glutenu" },
  { value: "bez_laktozy", label: "Bez laktozy" },
];
const DIFFICULTY_OPTIONS = [
  { value: "", label: "— wybierz —" },
  { value: "latwe", label: "Łatwe" },
  { value: "srednie", label: "Średnie" },
  { value: "trudne", label: "Trudne" },
];
const BUDGET_LEVEL_OPTIONS = [
  { value: "", label: "— wybierz —" },
  { value: "niski", label: "Niski" },
  { value: "sredni", label: "Średni" },
  { value: "wysoki", label: "Wysoki" },
];
const STATUS_OPTIONS = [
  { value: "roboczy", label: "Roboczy" },
  { value: "weryfikacja", label: "Weryfikacja" },
  { value: "opublikowany", label: "Opublikowany" },
  { value: "archiwalny", label: "Archiwalny" },
];
const SOURCE_OPTIONS = [
  { value: "administrator", label: "Administrator" },
  { value: "uzytkownik", label: "Użytkownik" },
  { value: "internet", label: "Internet" },
];
const ALLERGEN_OPTIONS = [
  "gluten", "laktoza", "orzechy", "jaja", "soja", "ryby", "skorupiaki", "seler", "gorczyca", "sezam",
];
const ADMIN_ROLES = { viewer: "viewer", editor: "editor", admin: "admin" };
const API_TIMEOUT_MS = 15_000;
const CHAT_PROMPT_MAX_CHARS = 1500;
const CHAT_IMAGE_MAX_BYTES = 6 * 1024 * 1024;
const ALLOWED_CHAT_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);
const CHAT_MODES = {
  Posilek: {
    category: "Posilek",
    buttonLabel: "Chcę się najeść!",
    buttonEmoji: "🍜",
    title: "Co mogę zjeść?",
    description:
      "Podaj składniki, nastrój albo pomysł, poczekaj na propozycje, wybierz i zacznij gotować. Koniec długiego szukania pomysłu co możesz zjeść!",
    emptyTitle: "Powiedz, na co masz ochotę",
    emptyDescription:
      "Gotowy na dwie pyszne propozycje? Zaakceptuj lub odrzuć i znajdź idealne danie dla siebie!",
    placeholder: "Np. mam makaron, pomidory i mozzarellę...",
    starterPrompts: [
      "Mam kurczaka i ryż",
      "Szybki obiad do 20 minut",
      "Lekka kolacja",
      "Mam tylko 5 składników",
      "Nie wiem, na co mam ochotę",
      "Mam warzywa z lodówki",
    ],
  },
  Deser: {
    category: "Deser",
    buttonLabel: "Chcę coś słodkiego!",
    buttonEmoji: "🍰",
    title: "Na co masz ochotę?",
    description:
      "Podaj składniki, nastrój albo pomysł, i zjedz przepyszny deser. Wybierz i przygotuj bez długiego szukania.",
    emptyTitle: "Powiedz, na co masz ochotę",
    emptyDescription:
      "Gotowy na słodkie propozycje? Znajdź deser idealny na teraz!",
    placeholder: "Np. mam mascarpone, truskawki i biszkopty...",
    starterPrompts: [
      "Coś słodkiego bez pieczenia",
      "Mam twaróg i owoce",
      "Deser do 20 minut",
      "Mam tylko 5 składników",
      "Nie wiem, na co mam ochotę",
      "Coś czekoladowego",
    ],
  },
};
const CHAT_MODE_ORDER = ["Posilek", "Deser"];
const CHAT_FILTER_DIET_OPTIONS = [
  { value: "any", label: "Klasyczna" },
  { value: "vegetarian", label: "Wegetariańska" },
  { value: "vegan", label: "Wegańska" },
  { value: "gluten_free", label: "Bez glutenu" },
  { value: "lactose_free", label: "Bez laktozy" },
];
const CHAT_FILTER_TIME_OPTIONS = [
  { value: "any", label: "Dowolny czas" },
  { value: "15", label: "Do 15 min" },
  { value: "30", label: "Do 30 min" },
  { value: "45", label: "Do 45 min" },
];
const CHAT_FILTER_DIFFICULTY_OPTIONS = [
  { value: "any", label: "Dowolna trudność" },
  { value: "easy", label: "Łatwe" },
  { value: "medium", label: "Średnie" },
];
const CHAT_FILTER_BUDGET_OPTIONS = [
  { value: "any", label: "Dowolny budżet" },
  { value: "low", label: "Niski budżet" },
  { value: "medium", label: "Średni budżet" },
];
const DEFAULT_CHAT_FILTERS = {
  diet: "any",
  maxTime: "any",
  difficulty: "any",
  budget: "any",
  ingredientLimitFive: false,
};
const RECENT_SEARCHES_STORAGE_KEY = "cmz-recent-searches";

const ASSISTANT_MEAL_VARIANTS = [
  "Mam coś dla Ciebie! Oto 2 propozycje dopasowane do Twojego zapytania.",
  "Gotowe! Przygotowałem 2 pomysły, które mogą Ci przypaść do gustu.",
  "Proszę bardzo! Oto 2 dania, które warto rozważyć.",
  "Znalazłem coś ciekawego! Zobacz te 2 propozycje.",
  "Super wybór składników! Mam dla Ciebie 2 pomysły na danie.",
  "Oto moje 2 propozycje — sprawdź, która bardziej Ci odpowiada!",
];
const ASSISTANT_DESSERT_VARIANTS = [
  "Mam coś słodkiego! Oto 2 propozycje deserów dla Ciebie.",
  "Gotowe! Przygotowałem 2 słodkie pomysły specjalnie dla Ciebie.",
  "Proszę bardzo! Oto 2 desery warte spróbowania.",
  "Znalazłem coś pysznego! Zobacz te 2 słodkie propozycje.",
  "Słodka niespodzianka! Mam dla Ciebie 2 pomysły na deser.",
  "Oto moje 2 słodkie propozycje — która Ci bardziej odpowiada?",
];
const DESSERT_PROMPT_HINTS = [
  "deser",
  "slod",
  "slodkie",
  "slodkiego",
  "ciasto",
  "sernik",
  "brownie",
  "beza",
  "tiramisu",
  "lody",
  "czekolad",
  "wanili",
  "muffin",
  "babeczk",
  "szarlot",
  "pudding",
  "mus",
];
const MEAL_PROMPT_HINTS = [
  "obiad",
  "kolac",
  "kolacja",
  "lunch",
  "sniadan",
  "sniadanie",
  "zupa",
  "mieso",
  "ryba",
  "wege",
  "wegetari",
  "wegansk",
  "makaron",
  "kanapk",
  "salatk",
  "przekask",
  "ziemniak",
  "ryz",
  "kasz",
  "kurczak",
  "indyk",
  "wolow",
  "wieprz",
  "dorsz",
  "losos",
  "krewet",
  "burger",
  "pizza",
];

function routePath() {
  const query = new URLSearchParams(window.location.search);
  const tryb = query.get("tryb");
  if (tryb === "zaloguj") return "/zaloguj";

  const raw = window.location.pathname || "/";
  const normalized = raw.replace(/\/+$/, "");
  return normalized || "/";
}

function normalizeChatFiltersForRequest(filters) {
  const raw = filters && typeof filters === "object" ? filters : {};
  const normalizeChoice = (value, allowed, fallback) =>
    typeof value === "string" && allowed.includes(value) ? value : fallback;

  return {
    diet: normalizeChoice(
      raw.diet,
      CHAT_FILTER_DIET_OPTIONS.map((item) => item.value),
      DEFAULT_CHAT_FILTERS.diet,
    ),
    maxTime: normalizeChoice(
      raw.maxTime,
      CHAT_FILTER_TIME_OPTIONS.map((item) => item.value),
      DEFAULT_CHAT_FILTERS.maxTime,
    ),
    difficulty: normalizeChoice(
      raw.difficulty,
      CHAT_FILTER_DIFFICULTY_OPTIONS.map((item) => item.value),
      DEFAULT_CHAT_FILTERS.difficulty,
    ),
    budget: normalizeChoice(
      raw.budget,
      CHAT_FILTER_BUDGET_OPTIONS.map((item) => item.value),
      DEFAULT_CHAT_FILTERS.budget,
    ),
    ingredientLimitFive: raw.ingredientLimitFive === true,
  };
}

function activeFilterPills(filters) {
  const safeFilters = normalizeChatFiltersForRequest(filters);
  const pills = [];
  if (safeFilters.diet !== "any") {
    const dietLabel = CHAT_FILTER_DIET_OPTIONS.find((item) => item.value === safeFilters.diet)?.label;
    if (dietLabel) pills.push(dietLabel);
  }
  if (safeFilters.maxTime !== "any") {
    const timeLabel = CHAT_FILTER_TIME_OPTIONS.find((item) => item.value === safeFilters.maxTime)?.label;
    if (timeLabel) pills.push(timeLabel);
  }
  if (safeFilters.difficulty !== "any") {
    const difficultyLabel = CHAT_FILTER_DIFFICULTY_OPTIONS.find(
      (item) => item.value === safeFilters.difficulty,
    )?.label;
    if (difficultyLabel) pills.push(difficultyLabel);
  }
  if (safeFilters.budget !== "any") {
    const budgetLabel = CHAT_FILTER_BUDGET_OPTIONS.find((item) => item.value === safeFilters.budget)?.label;
    if (budgetLabel) pills.push(budgetLabel);
  }
  if (safeFilters.ingredientLimitFive) {
    pills.push("Do 5 składników");
  }
  return pills;
}

function normalizeListItems(value, fallback = []) {
  if (Array.isArray(value)) {
    return value
      .map((item) => asString(item).trim())
      .filter(Boolean);
  }

  const text = asString(value).trim();
  if (!text) return fallback;

  return text
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeNutrition(value) {
  const raw = value && typeof value === "object" ? value : {};
  const normalizeField = (field) => {
    const text = asString(raw[field]).trim();
    return text || null;
  };
  return {
    calories: normalizeField("calories"),
    protein: normalizeField("protein"),
    fat: normalizeField("fat"),
    carbs: normalizeField("carbs"),
  };
}

function buildRecipeDetails(source) {
  const title = asString(source?.title || source?.nazwa).trim() || "Danie";
  const shortDescription =
    asString(source?.short_description || source?.shortDescription || source?.why).trim() ||
    "Pełny przepis jest w przygotowaniu. Możesz już zobaczyć dostępne informacje.";
  const ingredientsList = normalizeListItems(
    source?.ingredients_list || source?.ingredients || source?.skladniki,
  );
  const steps = normalizeListItems(source?.steps || source?.instructions || source?.opis);
  const substitutions = normalizeListItems(source?.substitutions, []);
  const tags = normalizeListItems(source?.tags || source?.tagi, []);
  const shoppingList = normalizeListItems(
    source?.shopping_list || source?.shoppingList || source?.ingredients_list || source?.skladniki,
    [],
  );

  return {
    id: source?.id ?? source?.recipe_id ?? null,
    title,
    shortDescription,
    prepTime: normalizePreparationTimeLabel(source?.time || source?.czas),
    servings:
      Number.isInteger(source?.servings) && source.servings > 0
        ? source.servings
        : Number.isInteger(source?.porcje) && source.porcje > 0
          ? source.porcje
          : null,
    ingredients: ingredientsList,
    steps,
    nutrition: normalizeNutrition(source?.nutrition),
    substitutions,
    tags,
    shoppingList,
    difficulty: asString(source?.difficulty).trim(),
    budget: asString(source?.budget).trim(),
    linkFilm: source?.link_filmu || source?.linkFilm || "",
    linkPage: source?.link_strony || source?.linkPage || "",
  };
}

function recipeFromOption(option) {
  return {
    ...buildRecipeDetails(option),
    source: "opcja",
  };
}

function recipeFromApiRecipe(recipe) {
  return {
    ...buildRecipeDetails(recipe),
    source: "baza",
  };
}

function asString(value) {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "bigint") return value.toString();
  return "";
}

function normalizePreparationTimeLabel(value) {
  const raw = asString(value).trim();
  if (!raw) return "Brak danych";

  const compact = raw.replace(/\s+/g, " ").trim().replace(/[.,;:]+$/g, "");
  const normalized = compact.toLowerCase();

  const plainRange = normalized.match(/^(\d{1,4})\s*-\s*(\d{1,4})$/);
  if (plainRange) return `${plainRange[1]}-${plainRange[2]} minut`;

  const plainSingle = normalized.match(/^(\d{1,4})$/);
  if (plainSingle) return `${plainSingle[1]} minut`;

  const minuteRange = normalized.match(
    /^(\d{1,4})\s*-\s*(\d{1,4})\s*(m|min\.?|mins?|minut|minuty|minute|minutes)$/,
  );
  if (minuteRange) return `${minuteRange[1]}-${minuteRange[2]} minut`;

  const minuteSingle = normalized.match(
    /^(\d{1,4})\s*(m|min\.?|mins?|minut|minuty|minute|minutes)$/,
  );
  if (minuteSingle) return `${minuteSingle[1]} minut`;

  const hourRange = normalized.match(
    /^(\d{1,3})\s*-\s*(\d{1,3})\s*(h|hr|hrs|godz|godzina|godziny|godz\.)$/,
  );
  if (hourRange) {
    const from = Number.parseInt(hourRange[1], 10) * 60;
    const to = Number.parseInt(hourRange[2], 10) * 60;
    return `${from}-${to} minut`;
  }

  const hourSingle = normalized.match(
    /^(\d{1,3})\s*(h|hr|hrs|godz|godzina|godziny|godz\.)$/,
  );
  if (hourSingle) {
    const minutes = Number.parseInt(hourSingle[1], 10) * 60;
    return `${minutes} minut`;
  }

  return compact;
}

function normalizeRecipeCategory(value) {
  const raw = asString(value)
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (raw === "deser") return "Deser";
  if (raw === "posilek") return "Posilek";
  return DEFAULT_RECIPE_CATEGORY;
}

function normalizePromptForCategory(value) {
  return asString(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function scorePromptHints(normalizedPrompt, hints) {
  if (!normalizedPrompt) return 0;
  let hits = 0;
  for (const hint of hints) {
    if (normalizedPrompt.includes(hint)) {
      hits += 1;
    }
  }
  return hits;
}

function detectPromptCategory(prompt, currentCategory) {
  const normalizedCurrent = normalizeRecipeCategory(currentCategory);
  const normalizedPrompt = normalizePromptForCategory(prompt);
  if (!normalizedPrompt) return normalizedCurrent;

  const dessertScore = scorePromptHints(normalizedPrompt, DESSERT_PROMPT_HINTS);
  const mealScore = scorePromptHints(normalizedPrompt, MEAL_PROMPT_HINTS);

  if (dessertScore === mealScore) {
    return normalizedCurrent;
  }

  return dessertScore > mealScore ? "Deser" : "Posilek";
}

function containsForbiddenChatPhrase(value) {
  const normalized = asString(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (!normalized) return false;

  return (
    /\bbaz\w*\b/.test(normalized) ||
    /\bdatabase\b/.test(normalized) ||
    /\bdataset\b/.test(normalized) ||
    /\binternet\w*\b/.test(normalized) ||
    /\b(db|sql|mysql|postgres|mongodb)\b/.test(normalized) ||
    /\brepozytor\w*\b/.test(normalized)
  );
}

let _variantCounter = 0;
function assistantFallbackTextForCategory(category) {
  const normalizedCategory = normalizeRecipeCategory(category);
  const index = _variantCounter++;
  if (normalizedCategory === "Deser") {
    return ASSISTANT_DESSERT_VARIANTS[index % ASSISTANT_DESSERT_VARIANTS.length];
  }
  return ASSISTANT_MEAL_VARIANTS[index % ASSISTANT_MEAL_VARIANTS.length];
}

function sanitizeAssistantMessageForDisplay(value, category, prompt) {
  const text = asString(value).trim();
  const fallback = assistantFallbackTextForCategory(category, prompt);

  if (!text) return fallback;
  if (containsForbiddenChatPhrase(text)) return fallback;
  return text.slice(0, 240);
}

function sanitizeOptionTextForDisplay(value, fallback, maxLength = 600) {
  const text = asString(value).trim();
  if (!text) return fallback;
  if (containsForbiddenChatPhrase(text)) return fallback;
  return text.slice(0, maxLength);
}

function sanitizeOptionForDisplay(option) {
  if (!option || typeof option !== "object") {
    return {
      title: "Danie",
      short_description: "Pełny opis przepisu jest w przygotowaniu.",
      why: "To propozycja dopasowana do Twojego zapytania.",
      ingredients: "Brak danych",
      instructions: "Brak danych",
      ingredients_list: [],
      steps: [],
      substitutions: [],
      shopping_list: [],
      nutrition: { calories: null, protein: null, fat: null, carbs: null },
    };
  }

  const sanitizeArray = (value, limit = 16, maxLength = 140) => {
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => sanitizeOptionTextForDisplay(item, "", maxLength))
      .filter(Boolean)
      .slice(0, limit);
  };

  const nutrition =
    option.nutrition && typeof option.nutrition === "object" ? option.nutrition : {};

  return {
    ...option,
    title: sanitizeOptionTextForDisplay(option.title, "Danie", 140),
    short_description: sanitizeOptionTextForDisplay(
      option.short_description,
      "Pełny opis przepisu jest w przygotowaniu.",
      240,
    ),
    why: sanitizeOptionTextForDisplay(
      option.why,
      "To propozycja dopasowana do Twojego zapytania.",
      300,
    ),
    ingredients: sanitizeOptionTextForDisplay(option.ingredients, "Brak danych", 900),
    instructions: sanitizeOptionTextForDisplay(option.instructions, "Brak danych", 1200),
    ingredients_list: sanitizeArray(option.ingredients_list, 20, 90),
    steps: sanitizeArray(option.steps, 16, 220),
    substitutions: sanitizeArray(option.substitutions, 12, 120),
    shopping_list: sanitizeArray(option.shopping_list || option.shoppingList, 20, 100),
    nutrition: {
      calories: sanitizeOptionTextForDisplay(nutrition.calories, "", 40) || null,
      protein: sanitizeOptionTextForDisplay(nutrition.protein, "", 40) || null,
      fat: sanitizeOptionTextForDisplay(nutrition.fat, "", 40) || null,
      carbs: sanitizeOptionTextForDisplay(nutrition.carbs, "", 40) || null,
    },
  };
}

function getChatModeConfig(value) {
  const category = normalizeRecipeCategory(value);
  return CHAT_MODES[category] || CHAT_MODES[DEFAULT_RECIPE_CATEGORY];
}

function normalizeTagKey(value) {
  return asString(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function parseTags(value) {
  return asString(value)
    .split(/[,\n;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqueTags(tags) {
  const seen = new Set();
  const result = [];
  for (const tag of tags) {
    const key = normalizeTagKey(tag);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(tag.trim());
  }
  return result;
}

function tagsToString(tags) {
  return uniqueTags(tags).join(", ");
}

function splitTextRows(value) {
  return asString(value)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function stripListPrefix(value) {
  return value
    .replace(/^[-*•\u2022]+\s*/, "")
    .replace(/^\d+\s*[.)-]\s*/, "")
    .replace(/^krok\s*\d+\s*[:.)-]?\s*/i, "")
    .trim();
}

function ingredientItemsFromText(value) {
  const rows = splitTextRows(value).map(stripListPrefix).filter(Boolean);
  if (rows.length > 1) return rows;

  const single = rows[0] || asString(value).trim();
  if (!single || /^brak danych$/i.test(single)) return [];

  const splitByCommaOrSemicolon = single
    .split(/\s*,\s+|\s*;\s*/)
    .map(stripListPrefix)
    .filter(Boolean);

  return splitByCommaOrSemicolon.length > 1 ? splitByCommaOrSemicolon : [single];
}

function explicitKrokSteps(value) {
  const text = asString(value)
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .trim();

  if (!/krok\s*\d+/i.test(text)) return [];

  return text
    .split(/(?=krok\s*\d+\s*[:.)-]?)/gi)
    .map((chunk) => chunk.trim())
    .filter((chunk) => /^krok\s*\d+/i.test(chunk))
    .map((chunk) => chunk.replace(/^krok\s*\d+\s*[:.)-]?\s*/i, "").trim())
    .map(stripListPrefix)
    .filter(Boolean);
}

function instructionStepsFromText(value) {
  const fromKrokMarkers = explicitKrokSteps(value);
  if (fromKrokMarkers.length > 0) return fromKrokMarkers;

  const rows = splitTextRows(value).map(stripListPrefix).filter(Boolean);
  if (rows.length > 1) return rows;

  const single = rows[0] || asString(value).trim();
  if (!single || /^brak danych$/i.test(single)) return [];

  const sentenceSplit = single
    .split(/(?:\s*[.;!?]\s+)|(?:\s+->\s+)/)
    .map(stripListPrefix)
    .filter(Boolean);

  return sentenceSplit.length > 0 ? sentenceSplit : [single];
}

function adminInstructionStepsFromText(value) {
  const fromKrokMarkers = explicitKrokSteps(value);
  if (fromKrokMarkers.length > 0) return fromKrokMarkers;

  const rows = splitTextRows(value).map(stripListPrefix).filter(Boolean);
  if (rows.length > 1) return rows;

  const single = rows[0] || asString(value).trim();
  if (!single || /^brak danych$/i.test(single)) return [];

  return [stripListPrefix(single)];
}

function serializeInstructionSteps(steps) {
  const normalized = Array.isArray(steps)
    ? steps.map((step) => asString(step).trim()).filter(Boolean)
    : [];

  return normalized
    .map((step, index) => `Krok ${index + 1}: ${step}`)
    .join("\n");
}

function toExternalUrl(value) {
  const text = asString(value).trim();
  if (!text) return "";

  const normalized = /^https?:\/\//i.test(text) ? text : `https://${text}`;
  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "";
    }
    return parsed.toString();
  } catch {
    return "";
  }
}

function parseApiError(status, body) {
  if (typeof body === "string" && body.trim()) {
    const text = body.trim();
    if (text.startsWith("<!DOCTYPE html>") || text.startsWith("<html")) {
      return `Błąd HTTP ${status}. Serwer zwrócił stronę HTML zamiast API.`;
    }
    return text.slice(0, 260);
  }

  if (body && typeof body === "object") {
    const message = body.error || body.message || body.przepis;
    if (typeof message === "string" && message.trim()) {
      return message.trim();
    }
  }

  return `Błąd HTTP ${status}`;
}

async function apiRequest(path, options = {}) {
  const method = options.method || "GET";
  const headers = { ...(options.headers || {}) };
  let body;

  if (Object.prototype.hasOwnProperty.call(options, "body")) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  headers["X-Requested-With"] = "fetch";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body,
      credentials: "include",
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Przekroczono czas oczekiwania na odpowiedz serwera.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const contentType = response.headers.get("content-type") || "";
  let payload;

  if (contentType.includes("application/json")) {
    payload = await response.json();
  } else {
    payload = await response.text();
  }

  if (!response.ok) {
    throw new Error(parseApiError(response.status, payload));
  }

  return payload;
}

function readStoredJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeStoredJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function normalizeRecentSearches(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      query: asString(item.query).trim(),
      category: normalizeRecipeCategory(item.category),
      source: asString(item.source).trim() || "text",
      createdAt: asString(item.createdAt).trim(),
    }))
    .filter((item) => item.query)
    .slice(0, 8);
}

function pushRecentSearch(existingItems, item) {
  const nextItem = {
    query: asString(item?.query).trim(),
    category: normalizeRecipeCategory(item?.category),
    source: asString(item?.source).trim() || "text",
    createdAt: new Date().toISOString(),
  };
  if (!nextItem.query) return normalizeRecentSearches(existingItems);

  const deduped = normalizeRecentSearches(existingItems).filter(
    (entry) => entry.query.toLowerCase() !== nextItem.query.toLowerCase(),
  );
  return [nextItem, ...deduped].slice(0, 6);
}

function normalizeFavoriteRecipes(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      id: item.id ?? item.recipeId ?? item.recipe_id ?? null,
      favoriteId: item.favoriteId ?? item.favorite_id ?? null,
      title: asString(item.title).trim() || "Danie",
      shortDescription: asString(item.shortDescription).trim(),
      prepTime: asString(item.prepTime).trim(),
      category: normalizeRecipeCategory(item.category),
      savedAt: asString(item.savedAt).trim() || new Date().toISOString(),
    }))
    .filter((item) => item.title)
    .slice(0, 24);
}

function favoriteKey(recipe) {
  if (recipe?.id !== null && recipe?.id !== undefined && recipe?.id !== "") {
    return `id:${recipe.id}`;
  }
  return `title:${asString(recipe?.title).trim().toLowerCase()}`;
}

function normalizeSavedShoppingList(value) {
  const safe = value && typeof value === "object" ? value : {};
  return {
    recipeTitle: asString(safe.recipeTitle).trim(),
    items: normalizeListItems(safe.items, []),
    savedAt: asString(safe.savedAt).trim(),
  };
}

function normalizeFileName(fileName = "") {
  const trimmed = asString(fileName).trim();
  return trimmed || "zdjecie";
}

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 102.4) / 10} KB`;
  }
  return `${Math.round(bytes / (1024 * 102.4)) / 10} MB`;
}

function normalizeChatErrorMessage(error) {
  const raw = error instanceof Error ? error.message : asString(error);
  const message = raw.trim();
  if (!message) {
    return "Nie udało się przygotować propozycji. Spróbuj ponownie za chwilę.";
  }
  if (
    message.startsWith("Prompt jest zbyt d") ||
    message.startsWith("Przekroczono czas oczekiwania") ||
    message.startsWith("Zbyt wiele") ||
    message.startsWith("Osiągnięto") ||
    message.startsWith("Osiagnieto") ||
    message.toLowerCase().includes("limit")
  ) {
    return message;
  }
  return "Nie udało się przygotować propozycji. Spróbuj ponownie za chwilę.";
}

function normalizePhotoErrorMessage(error) {
  const raw = error instanceof Error ? error.message : asString(error);
  const message = raw.trim();
  if (!message) {
    return "Nie udało się przetworzyć zdjęcia. Spróbuj ponownie za chwilę.";
  }
  if (
    message.includes("format") ||
    message.includes("duże") ||
    message.includes("duze") ||
    message.includes("zdjęcie") ||
    message.includes("zdjecie") ||
    message.includes("Przekroczono czas oczekiwania") ||
    message.toLowerCase().includes("limit")
  ) {
    return message;
  }
  return "Nie udało się przetworzyć zdjęcia. Spróbuj ponownie za chwilę.";
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string" && reader.result.trim()) {
        resolve(reader.result);
        return;
      }

      reject(new Error("Nie udało się odczytać zdjęcia."));
    };

    reader.onerror = () => {
      reject(new Error("Nie udało się odczytać zdjęcia."));
    };

    reader.readAsDataURL(file);
  });
}

function loadImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Nie udało się przygotować zdjęcia."));
    image.src = dataUrl;
  });
}

async function optimizeChatImage(file) {
  if (!(file instanceof File) || !file.type.startsWith("image/")) {
    throw new Error("Wybierz poprawne zdjęcie.");
  }
  const mimeType = asString(file.type).toLowerCase();
  if (!ALLOWED_CHAT_IMAGE_MIME_TYPES.has(mimeType)) {
    throw new Error("Nieobsługiwany format zdjęcia. Użyj JPG, PNG, WEBP, HEIC lub HEIF.");
  }
  if (file.size > CHAT_IMAGE_MAX_BYTES) {
    throw new Error("Zdjęcie jest zbyt duże. Użyj mniejszego pliku.");
  }

  const sourceDataUrl = await readFileAsDataUrl(file);
  const image = await loadImageFromDataUrl(sourceDataUrl);
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;

  if (!sourceWidth || !sourceHeight) {
    return sourceDataUrl;
  }

  const maxDimension = 1280;
  const scale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight));
  const targetWidth = Math.max(1, Math.round(sourceWidth * scale));
  const targetHeight = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext("2d");
  if (!context) {
    return sourceDataUrl;
  }

  context.drawImage(image, 0, 0, targetWidth, targetHeight);
  return canvas.toDataURL("image/jpeg", 0.82);
}

function ChatBubble({ role, content, imageUrl, imageAlt }) {
  const icon = role === "user" ? "🍴" : "🧑‍🍳";
  const label = role === "user" ? "Użytkownik" : "Asystent";
  const hasImage =
    typeof imageUrl === "string" &&
    /^data:image\/(jpeg|jpg|png|webp|heic|heif);base64,/i.test(imageUrl.trim());
  const hasContent = typeof content === "string" && content.trim();

  return (
    <article className={`chat-row ${role}`}>
      <div className="chat-avatar" aria-label={label} title={label}>
        <span className="chat-avatar-icon" aria-hidden="true">
          {icon}
        </span>
      </div>
      <div className={`chat-bubble ${hasImage ? "media" : ""}`}>
        {hasImage ? (
          <img
            src={imageUrl}
            alt={imageAlt || "Zdjęcie przesłane do czatu"}
            className="chat-bubble-image"
          />
        ) : null}
        {hasContent ? <div className="chat-bubble-text">{content}</div> : null}
      </div>
    </article>
  );
}

function TypingBubble() {
  return (
    <article className="chat-row assistant">
      <div className="chat-avatar" aria-label="Asystent" title="Asystent">
        <span className="chat-avatar-icon" aria-hidden="true">
          🧑‍🍳
        </span>
      </div>
      <div className="chat-bubble typing">
        <span />
        <span />
        <span />
      </div>
    </article>
  );
}

function StarterPrompts({ loading, prompts, onPick }) {
  return (
    <div className="starter-wrap">
      <p>Na start możesz kliknąć jedną z propozycji:</p>
      <div className="starter-grid">
        {prompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            className="starter-chip"
            disabled={loading}
            onClick={() => onPick(prompt)}
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}

function RecentSearches({ items, onPick, onClear, disabled }) {
  if (!Array.isArray(items) || items.length === 0) return null;

  return (
    <section className="recent-searches" aria-label="Ostatnie wyszukiwania">
      <div className="recent-searches-head">
        <div>
          <h3>Ostatnie wyszukiwania</h3>
          <p>Wracaj do ostatnich pomysłów jednym kliknięciem.</p>
        </div>
        <button type="button" className="btn reset-btn" onClick={onClear} disabled={disabled}>
          Wyczyść historię
        </button>
      </div>
      <div className="recent-searches-grid">
        {items.map((item, index) => (
          <button
            key={`${item.query}-${index}`}
            type="button"
            className="starter-chip recent-search-chip"
            disabled={disabled}
            onClick={() => onPick(item.query)}
          >
            <span>{item.query}</span>
            <small>{item.category === "Deser" ? "Deser" : "Posiłek"}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

function PhotoAttachmentCard({
  attachment,
  disabled,
  onRemove,
  onRetry,
  onIngredientChange,
  onIngredientRemove,
  onUseIngredients,
}) {
  if (!attachment) return null;

  const statusLabel =
    attachment.status === "ready"
      ? "Zdjęcie gotowe. Kliknij Wyślij, aby rozpocząć analizę."
      : attachment.status === "uploading"
        ? "Przesyłamy zdjęcie..."
        : attachment.status === "analyzing"
          ? "Analizujemy składniki..."
          : attachment.status === "success"
            ? "Zdjęcie przeanalizowane. Możesz poprawić wykryte składniki."
            : attachment.message || "Nie udało się przetworzyć zdjęcia.";

  const hasIngredients =
    Array.isArray(attachment.detectedIngredients) && attachment.detectedIngredients.length > 0;

  return (
    <section className={`photo-attachment status-${attachment.status}`} aria-label="Wybrane zdjęcie">
      <div className="photo-attachment-preview">
        <img src={attachment.previewUrl} alt="Podgląd wybranego zdjęcia" />
      </div>
      <div className="photo-attachment-body">
        <div className="photo-attachment-head">
          <div>
            <h3>Zdjęcie składników</h3>
            <p>
              {attachment.fileName}
              {attachment.fileSizeLabel ? ` • ${attachment.fileSizeLabel}` : ""}
            </p>
          </div>
          <button type="button" className="btn reset-btn" onClick={onRemove} disabled={disabled}>
            {attachment.status === "success" ? "Wyczyść" : "Usuń"}
          </button>
        </div>

        <p className={`photo-status status-${attachment.status}`} aria-live="polite">
          {statusLabel}
        </p>

        {attachment.analysisPrompt ? (
          <p className="photo-analysis-prompt">
            AI rozpoznało kierunek zapytania: <strong>{attachment.analysisPrompt}</strong>
          </p>
        ) : null}

        {hasIngredients ? (
          <div className="detected-ingredients-editor">
            <div className="detected-ingredients-head">
              <h4>Wykryte składniki</h4>
              <button
                type="button"
                className="btn ghost"
                onClick={onUseIngredients}
                disabled={disabled}
              >
                Wstaw do pola
              </button>
            </div>
            <div className="detected-ingredients-list">
              {attachment.detectedIngredients.map((item, index) => (
                <div key={`detected-ingredient-${index}`} className="detected-ingredient-row">
                  <input
                    type="text"
                    value={item}
                    onChange={(event) => onIngredientChange(index, event.target.value)}
                    disabled={disabled}
                    aria-label={`Wykryty składnik ${index + 1}`}
                  />
                  <button
                    type="button"
                    className="detected-ingredient-remove"
                    onClick={() => onIngredientRemove(index)}
                    disabled={disabled}
                    aria-label={`Usuń składnik ${item}`}
                  >
                    Usuń
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {attachment.status === "error" ? (
          <button type="button" className="btn ghost" onClick={onRetry} disabled={disabled}>
            Spróbuj ponownie
          </button>
        ) : null}
      </div>
    </section>
  );
}

function HeroModeSwitch({ activeCategory, onChange }) {
  const activeMode = getChatModeConfig(activeCategory);
  const activeIndex = CHAT_MODE_ORDER.findIndex((category) => category === activeMode.category);
  const thumbIndex = activeIndex >= 0 ? activeIndex : 0;

  return (
    <div className="hero-mode-switch" role="group" aria-label="Tryb propozycji">
      <div className="hero-mode-track">
        <span
          className="hero-mode-thumb"
          style={{ transform: `translateX(${thumbIndex * 100}%)` }}
          aria-hidden="true"
        />
        {CHAT_MODE_ORDER.map((category) => {
          const mode = getChatModeConfig(category);
          const isActive = mode.category === activeMode.category;
          return (
            <button
              key={`mode-switch-${mode.category}`}
              type="button"
              className={`hero-mode-option ${isActive ? "active" : ""}`}
              aria-pressed={isActive}
              onClick={() => onChange(mode.category)}
            >
              <span className="hero-mode-emoji" aria-hidden="true">
                {mode.buttonEmoji}
              </span>
              <span>{mode.buttonLabel}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FilterGroup({ label, options, value, onChange, disabled }) {
  return (
    <div className="filter-group">
      <p>{label}</p>
      <div className="filter-chip-row" role="group" aria-label={label}>
        {options.map((option) => {
          const active = value === option.value;
          return (
            <button
              key={`${label}-${option.value}`}
              type="button"
              className={`filter-chip${active ? " active" : ""}`}
              aria-pressed={active}
              onClick={() => onChange(option.value)}
              disabled={disabled}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ChatFiltersBar({ filters, onChange, onReset, disabled, isOpen, onToggle }) {
  const pills = activeFilterPills(filters);

  return (
    <section className={`filters-shell${isOpen ? " open" : ""}`} aria-label="Filtry rekomendacji">
      <button
        type="button"
        className="filters-toggle"
        aria-expanded={isOpen}
        aria-controls="chat-filters-panel"
        onClick={onToggle}
        disabled={disabled}
      >
        <span className="filters-toggle-copy">
          <strong>Doprecyzuj wynik</strong>
          <span>
            {pills.length > 0
              ? `${pills.length} aktywne filtry`
              : "Opcjonalne ustawienia czasu, diety i budżetu"}
          </span>
        </span>
        <span className="filters-toggle-icon" aria-hidden="true">
          {isOpen ? "−" : "+"}
        </span>
      </button>

      {isOpen ? (
        <div className="filters-wrap" id="chat-filters-panel">
          <div className="filters-head">
            <h3>Filtry</h3>
            <div className="filters-actions">
              {pills.length > 0 ? (
                <span className="filters-count">{pills.length} aktywne</span>
              ) : (
                <span className="filters-count">Wszystkie opcje są dobrowolne</span>
              )}
              <button type="button" className="btn reset-btn" onClick={onReset} disabled={disabled}>
                Wyczyść filtry
              </button>
            </div>
          </div>

          <p className="filters-note">
            Aktywne filtry zawężają wynik i mają pierwszeństwo, jeśli są sprzeczne z ogólnym opisem
            w wiadomości.
          </p>

          <FilterGroup
            label="Dieta"
            options={CHAT_FILTER_DIET_OPTIONS}
            value={filters.diet}
            onChange={(value) => onChange("diet", value)}
            disabled={disabled}
          />
          <FilterGroup
            label="Czas"
            options={CHAT_FILTER_TIME_OPTIONS}
            value={filters.maxTime}
            onChange={(value) => onChange("maxTime", value)}
            disabled={disabled}
          />
          <FilterGroup
            label="Trudność"
            options={CHAT_FILTER_DIFFICULTY_OPTIONS}
            value={filters.difficulty}
            onChange={(value) => onChange("difficulty", value)}
            disabled={disabled}
          />
          <FilterGroup
            label="Budżet"
            options={CHAT_FILTER_BUDGET_OPTIONS}
            value={filters.budget}
            onChange={(value) => onChange("budget", value)}
            disabled={disabled}
          />

          <label className="filter-checkbox">
            <input
              type="checkbox"
              checked={filters.ingredientLimitFive}
              onChange={(event) => onChange("ingredientLimitFive", event.target.checked)}
              disabled={disabled}
            />
            <span>Maksymalnie 5 składników</span>
          </label>

          {pills.length > 0 ? (
            <div className="filters-pills" aria-label="Aktywne filtry">
              {pills.map((pill) => (
                <span key={`active-filter-${pill}`} className="active-filter-pill">
                  {pill}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function OptionCard({ option, index, onChoose, disabled, choosing }) {
  const ingredientsPreview = asString(option.ingredients);
  const timeLabel = normalizePreparationTimeLabel(option.time);

  return (
    <article className={`choice-card${choosing ? " choice-card-choosing" : ""}`}>
      <div className="choice-top">
        <div className="choice-meta">
          <span className="choice-pill">Propozycja {index + 1}</span>
          <span className="choice-time">Czas: {timeLabel}</span>
        </div>
        <h4>{option.title || "Danie"}</h4>
        <p className="choice-why">{option.why || "Dopasowane do Twojego zapytania."}</p>
      </div>

      <div className="choice-bottom">
        <p className="choice-label">Lista składników</p>
        <p className="choice-ingredients">{ingredientsPreview || "Brak danych"}</p>
        <button
          type="button"
          className="btn ghost choice-cta"
          onClick={() => onChoose(option, index)}
          disabled={disabled || choosing}
        >
          {choosing ? "Przygotowuję przepis…" : "Wybieram to danie"}
        </button>
      </div>
    </article>
  );
}

function TagsEditor({
  idPrefix,
  label,
  tags,
  inputValue,
  onInputChange,
  onInputKeyDown,
  onAddTag,
  onRemoveTag,
  suggestions,
  disabled,
}) {
  const datalistId = `${idPrefix}-suggestions`;
  const inputId = `${idPrefix}-input`;

  return (
    <div className="admin-field full">
      <label htmlFor={inputId}>{label}</label>
      <div className="tag-editor">
        <div className="tag-chip-wrap">
          {tags.length > 0 ? (
            tags.map((tag) => (
              <span key={`${idPrefix}-${tag}`} className="tag-chip">
                <span>{tag}</span>
                <button
                  type="button"
                  className="tag-chip-remove"
                  onClick={() => onRemoveTag(tag)}
                  disabled={disabled}
                  aria-label={`Usuń tag ${tag}`}
                >
                  ×
                </button>
              </span>
            ))
          ) : (
            <p className="tag-chip-empty">Brak tagów.</p>
          )}
        </div>
        <div className="tag-editor-row">
          <input
            id={inputId}
            type="text"
            list={datalistId}
            placeholder="Wpisz tag i naciśnij Enter"
            value={inputValue}
            onChange={(event) => onInputChange(event.target.value)}
            onKeyDown={onInputKeyDown}
            disabled={disabled}
          />
          <button type="button" className="btn ghost" onClick={onAddTag} disabled={disabled}>
            Dodaj tag
          </button>
        </div>
        <datalist id={datalistId}>
          {suggestions.map((tag) => (
            <option key={`${datalistId}-${tag}`} value={tag} />
          ))}
        </datalist>
        <p className="small-note">Enter dodaje tag. Duplikaty nie są dodawane.</p>
      </div>
    </div>
  );
}

function InstructionStepsEditor({
  idPrefix,
  label,
  steps,
  onAddStep,
  onChangeStep,
  onRemoveStep,
  onMoveStep,
  disabled,
  error,
}) {
  const [confirmRemoveIndex, setConfirmRemoveIndex] = useState(null);

  const handleRemove = (index) => {
    const step = steps[index] || "";
    if (step.trim().length > 0) {
      setConfirmRemoveIndex(index);
    } else {
      onRemoveStep(index);
    }
  };

  return (
    <div className={`admin-field full${error ? " has-error" : ""}`}>
      <div className="admin-field-label-row">
        <label>{label}</label>
        <button
          type="button"
          className="admin-step-add-btn"
          onClick={onAddStep}
          disabled={disabled}
          aria-label={`Dodaj krok w sekcji ${label}`}
        >
          +
        </button>
      </div>

      {steps.length === 0 ? <p className="small-note">Kliknij +, aby dodać krok 1.</p> : null}
      <FieldError error={error} />

      <div className="admin-steps-wrap">
        {steps.map((step, index) => {
          const stepId = `${idPrefix}-step-${index + 1}`;
          return (
            <div key={stepId} className="admin-step-item">
              <div className="admin-step-head">
                <label htmlFor={stepId} className="admin-step-title">
                  Krok {index + 1}
                </label>
                <div className="admin-step-actions">
                  <button
                    type="button"
                    className="admin-step-move-btn"
                    onClick={() => onMoveStep(index, index - 1)}
                    disabled={disabled || index === 0}
                    aria-label={`Przesuń krok ${index + 1} w górę`}
                    title="W górę"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="admin-step-move-btn"
                    onClick={() => onMoveStep(index, index + 1)}
                    disabled={disabled || index === steps.length - 1}
                    aria-label={`Przesuń krok ${index + 1} w dół`}
                    title="W dół"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="admin-step-remove-btn"
                    onClick={() => handleRemove(index)}
                    disabled={disabled}
                    aria-label={`Usuń krok ${index + 1}`}
                  >
                    Usuń
                  </button>
                </div>
              </div>
              {confirmRemoveIndex === index ? (
                <div className="step-confirm-remove">
                  <span>Usunąć krok z treścią?</span>
                  <button type="button" className="btn ghost" onClick={() => setConfirmRemoveIndex(null)}>Nie</button>
                  <button type="button" className="btn danger-btn" onClick={() => { onRemoveStep(index); setConfirmRemoveIndex(null); }}>Tak, usuń</button>
                </div>
              ) : null}
              <textarea
                id={stepId}
                value={step}
                onChange={(event) => onChangeStep(index, event.target.value)}
                disabled={disabled}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── User Sidebar Components ─────────────────────── */

function LoginForm({ onLogin, onSwitch }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email.trim()) { setError("Podaj adres e-mail."); return; }
    if (!password.trim()) { setError("Podaj hasło."); return; }
    if (!/\S+@\S+\.\S+/.test(email.trim())) { setError("Niepoprawny format e-mail."); return; }
    setFormLoading(true);
    try {
      await onLogin(email.trim(), password, remember);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Nie udało się zalogować.");
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <form className="sidebar-form" onSubmit={submit}>
      <div className="sidebar-field">
        <label htmlFor="sidebar-email">E-mail</label>
        <input id="sidebar-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jan@example.com" disabled={formLoading} autoComplete="email" />
      </div>
      <div className="sidebar-field">
        <label htmlFor="sidebar-password">Hasło</label>
        <input id="sidebar-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" disabled={formLoading} autoComplete="current-password" />
      </div>
      <label className="sidebar-checkbox">
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} disabled={formLoading} />
        <span>Zapamiętaj mnie</span>
      </label>
      {error ? <p className="sidebar-error" role="alert">{error}</p> : null}
      <button type="submit" className="btn send sidebar-submit" disabled={formLoading}>
        {formLoading ? "Logowanie..." : "Zaloguj"}
      </button>
      <button
        type="button"
        className="btn ghost sidebar-link-btn"
        disabled={formLoading}
        onClick={async () => {
          setError("");
          if (!email.trim() || !/\S+@\S+\.\S+/.test(email.trim())) {
            setError("Podaj najpierw poprawny e-mail, aby zresetować hasło.");
            return;
          }
          setFormLoading(true);
          try {
            await apiRequest("/user/password-reset-request", {
              method: "POST",
              body: { email: email.trim() },
            });
            setError("Jeśli konto istnieje, wysłaliśmy instrukcję resetu hasła na e-mail.");
          } catch (error) {
            setError(error instanceof Error ? error.message : "Nie udało się wysłać prośby resetu.");
          } finally {
            setFormLoading(false);
          }
        }}
      >
        Przypomnij hasło
      </button>
      <p className="sidebar-switch">Nie masz konta? <button type="button" className="sidebar-switch-btn" onClick={onSwitch}>Zarejestruj się</button></p>
    </form>
  );
}

function RegisterForm({ onRegister, onSwitch }) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!username.trim()) { setError("Podaj nazwę użytkownika."); return; }
    if (username.trim().length < 3) { setError("Nazwa min. 3 znaki."); return; }
    if (!email.trim()) { setError("Podaj adres e-mail."); return; }
    if (!/\S+@\S+\.\S+/.test(email.trim())) { setError("Niepoprawny format e-mail."); return; }
    if (!password) { setError("Podaj hasło."); return; }
    if (password.length < 6) { setError("Hasło min. 6 znaków."); return; }
    if (password !== password2) { setError("Hasła nie są zgodne."); return; }
    setFormLoading(true);
    try {
      await onRegister(username.trim(), email.trim(), password);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Nie udało się zarejestrować.");
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <form className="sidebar-form" onSubmit={submit}>
      <div className="sidebar-field">
        <label htmlFor="sidebar-reg-username">Nazwa użytkownika</label>
        <input id="sidebar-reg-username" type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Min. 3 znaki" disabled={formLoading} autoComplete="username" />
      </div>
      <div className="sidebar-field">
        <label htmlFor="sidebar-reg-email">E-mail</label>
        <input id="sidebar-reg-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jan@example.com" disabled={formLoading} autoComplete="email" />
      </div>
      <div className="sidebar-field">
        <label htmlFor="sidebar-reg-password">Hasło</label>
        <input id="sidebar-reg-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 6 znaków" disabled={formLoading} autoComplete="new-password" />
      </div>
      <div className="sidebar-field">
        <label htmlFor="sidebar-reg-password2">Powtórz hasło</label>
        <input id="sidebar-reg-password2" type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} placeholder="Powtórz hasło" disabled={formLoading} autoComplete="new-password" />
      </div>
      {error ? <p className="sidebar-error" role="alert">{error}</p> : null}
      <button type="submit" className="btn send sidebar-submit" disabled={formLoading}>
        {formLoading ? "Rejestracja..." : "Zarejestruj"}
      </button>
      <p className="sidebar-switch">Masz konto? <button type="button" className="sidebar-switch-btn" onClick={onSwitch}>Zaloguj się</button></p>
    </form>
  );
}

function LoggedInPanel({ user, onLogout, onNavigate }) {
  return (
    <div className="sidebar-account">
      <div className="sidebar-account-info">
        <div className="sidebar-avatar">{(user.username || "U")[0].toUpperCase()}</div>
        <div>
          <p className="sidebar-username">{user.username}</p>
          <p className="sidebar-email">{user.email}</p>
        </div>
      </div>
      <nav className="sidebar-nav">
        <button type="button" className="sidebar-nav-item" onClick={() => onNavigate("dodaj-przepis")}>
          <span>+</span> Dodaj przepis
        </button>
        <button type="button" className="sidebar-nav-item" onClick={() => onNavigate("ulubione")}>
          <span>♡</span> Ulubione
        </button>
        <button type="button" className="sidebar-nav-item" onClick={() => onNavigate("lista-zakupow")}>
          <span>🛒</span> Lista zakupów
        </button>
      </nav>
      <button type="button" className="btn sidebar-logout" onClick={onLogout}>Wyloguj</button>
    </div>
  );
}

function UserChatPage() {
  const [activeCategory, setActiveCategory] = useState(DEFAULT_RECIPE_CATEGORY);
  const [chatFilters, setChatFilters] = useState(DEFAULT_CHAT_FILTERS);
  const [messages, setMessages] = useState([]);
  const [prompt, setPrompt] = useState("");
  const [pendingOptions, setPendingOptions] = useState([]);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [, setSelectedOption] = useState(null);
  const [excludedRecipeIds, setExcludedRecipeIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [choosingRecipe, setChoosingRecipe] = useState(false);
  const [choosingIndex, setChoosingIndex] = useState(-1);
  const [flash, setFlash] = useState({ level: "", message: "" });
  const [optionsRound, setOptionsRound] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [recentSearches, setRecentSearches] = useState(() =>
    normalizeRecentSearches(readStoredJson(RECENT_SEARCHES_STORAGE_KEY, [])),
  );
  const [favoriteRecipes, setFavoriteRecipes] = useState([]);
  const [savedShoppingList, setSavedShoppingList] = useState(() =>
    normalizeSavedShoppingList({}),
  );
  const [photoAttachment, setPhotoAttachment] = useState(null);

  const chatRef = useRef(null);
  const composerRef = useRef(null);
  const cameraInputRef = useRef(null);
  const requestTokenRef = useRef(0);
  const modeConfig = getChatModeConfig(activeCategory);
  const safeFilters = useMemo(() => normalizeChatFiltersForRequest(chatFilters), [chatFilters]);
  const filterPills = useMemo(() => activeFilterPills(safeFilters), [safeFilters]);

  const latestUserText = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index].role === "user") {
        return messages[index].content;
      }
    }
    return "";
  }, [messages]);

  useEffect(() => {
    document.body.classList.remove("theme-posilek", "theme-deser");
    document.body.classList.add(activeCategory === "Deser" ? "theme-deser" : "theme-posilek");
    return () => {
      document.body.classList.remove("theme-posilek", "theme-deser");
    };
  }, [activeCategory]);

  useEffect(() => {
    const node = chatRef.current;
    if (!node) return;

    if (messages.length === 0 && pendingOptions.length === 0 && !loading) {
      node.scrollTop = 0;
      return;
    }

    if (pendingOptions.length >= 2) {
      const choicesSection = node.querySelector(".choices-wrap");
      if (choicesSection instanceof HTMLElement) {
        const topOffset = Math.max(0, choicesSection.offsetTop - 28);
        node.scrollTop = topOffset;
        return;
      }
    }

    node.scrollTop = node.scrollHeight;
  }, [loading, messages, pendingOptions, selectedRecipe]);

  useEffect(() => {
    const input = composerRef.current;
    if (!input) return;
    input.style.height = "0px";
    input.style.height = `${Math.min(input.scrollHeight, 180)}px`;
  }, [prompt]);

  useEffect(() => {
    writeStoredJson(RECENT_SEARCHES_STORAGE_KEY, recentSearches);
  }, [recentSearches]);

  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarView, setSidebarView] = useState("login"); // login | register | account
  const [userAuth, setUserAuth] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  const loadUserCollections = async () => {
    const [favoritesResponse, shoppingResponse] = await Promise.all([
      apiRequest("/user/favorites"),
      apiRequest("/user/shopping-list"),
    ]);
    setFavoriteRecipes(
      normalizeFavoriteRecipes(Array.isArray(favoritesResponse?.favorites) ? favoritesResponse.favorites : []),
    );
    setSavedShoppingList(normalizeSavedShoppingList(shoppingResponse?.shoppingList || {}));
  };

  const checkUserSession = useEffectEvent(async () => {
    try {
      const response = await apiRequest("/user/me");
      if (response?.loggedIn && response?.user) {
        setUserAuth(response.user);
        setSidebarView("account");
        await loadUserCollections();
      } else {
        setUserAuth(null);
        setFavoriteRecipes([]);
        setSavedShoppingList(normalizeSavedShoppingList({}));
      }
    } catch {
      setUserAuth(null);
      setFavoriteRecipes([]);
      setSavedShoppingList(normalizeSavedShoppingList({}));
    } finally {
      setAuthChecked(true);
    }
  });

  useEffect(() => {
    void checkUserSession();
  }, []);

  const handleUserLogin = async (email, password, rememberMe) => {
    const response = await apiRequest("/user/login", {
      method: "POST",
      body: {
        email,
        password,
        rememberMe: Boolean(rememberMe),
      },
    });
    if (!response?.user) {
      throw new Error("Nie udało się zalogować.");
    }
    setUserAuth(response.user);
    setSidebarView("account");
    await loadUserCollections();
    setFlash({ level: "success", message: "Zalogowano pomyślnie." });
  };

  const handleUserRegister = async (username, email, password) => {
    const response = await apiRequest("/user/register", {
      method: "POST",
      body: {
        username,
        email,
        password,
      },
    });
    if (!response?.user) {
      throw new Error("Nie udało się zarejestrować.");
    }
    setUserAuth(response.user);
    setSidebarView("account");
    await loadUserCollections();
    setFlash({ level: "success", message: "Zarejestrowano i zalogowano pomyślnie." });
  };

  const handleUserLogout = async () => {
    try {
      await apiRequest("/user/logout", { method: "POST" });
    } catch {
      // ignore logout network errors, clear local state anyway
    }
    setUserAuth(null);
    setFavoriteRecipes([]);
    setSavedShoppingList(normalizeSavedShoppingList({}));
    setSidebarView("login");
    setFlash({ level: "info", message: "Wylogowano z konta." });
  };

  const doResetConversation = () => {
    requestTokenRef.current += 1;
    setPrompt("");
    setMessages([]);
    setPendingOptions([]);
    setSelectedRecipe(null);
    setSelectedOption(null);
    setExcludedRecipeIds([]);
    setOptionsRound(0);
    setFlash({ level: "", message: "" });
    setLoading(false);
    setChoosingRecipe(false);
    setChoosingIndex(-1);
    setFiltersOpen(false);
    setPhotoAttachment(null);
    setResetConfirmOpen(false);
    if (cameraInputRef.current) {
      cameraInputRef.current.value = "";
    }
  };

  const resetConversation = () => {
    const hasContext = messages.length > 0 || pendingOptions.length > 0 || selectedRecipe;
    if (hasContext) {
      setResetConfirmOpen(true);
      return;
    }
    doResetConversation();
  };

  const updateFilter = (key, value) => {
    setChatFilters((prev) =>
      normalizeChatFiltersForRequest({
        ...prev,
        [key]: value,
      }),
    );
  };

  const clearFilters = () => {
    setChatFilters({ ...DEFAULT_CHAT_FILTERS });
  };

  const switchChatMode = (nextCategoryRaw) => {
    const nextCategory = normalizeRecipeCategory(nextCategoryRaw);
    if (nextCategory === activeCategory) return;
    setActiveCategory(nextCategory);
    resetConversation();
  };

  const rememberRecentSearch = (query, source, category) => {
    setRecentSearches((prev) =>
      pushRecentSearch(prev, {
        query,
        source,
        category: category || activeCategory,
      }),
    );
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
  };

  const clearPhotoAttachment = () => {
    setPhotoAttachment(null);
    if (cameraInputRef.current) {
      cameraInputRef.current.value = "";
    }
  };

  const preparePhotoAttachment = async (file) => {
    if (!file || loading) return;

    try {
      const previewUrl = await optimizeChatImage(file);
      setFlash({ level: "", message: "" });
      setPhotoAttachment({
        fileName: normalizeFileName(file.name),
        fileSize: file.size,
        fileSizeLabel: formatFileSize(file.size),
        mimeType: file.type,
        previewUrl,
        imageDataUrl: previewUrl,
        status: "ready",
        message: "",
        detectedIngredients: [],
        analysisPrompt: "",
      });
    } catch (error) {
      const message = normalizePhotoErrorMessage(error);
      setFlash({ level: "error", message });
      clearPhotoAttachment();
    }
  };

  const retryPhotoAnalysis = async () => {
    if (!photoAttachment || !photoAttachment.imageDataUrl || loading) return;
    await sendPhoto(photoAttachment, prompt);
  };

  const updateDetectedIngredient = (index, value) => {
    setPhotoAttachment((prev) => {
      if (!prev) return prev;
      const nextIngredients = Array.isArray(prev.detectedIngredients)
        ? prev.detectedIngredients.map((item, itemIndex) =>
            itemIndex === index ? asString(value).trim() : item,
          )
        : [];
      return {
        ...prev,
        detectedIngredients: nextIngredients,
      };
    });
  };

  const removeDetectedIngredient = (index) => {
    setPhotoAttachment((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        detectedIngredients: Array.isArray(prev.detectedIngredients)
          ? prev.detectedIngredients.filter((_, itemIndex) => itemIndex !== index)
          : [],
      };
    });
  };

  const useDetectedIngredientsInPrompt = () => {
    const ingredients = Array.isArray(photoAttachment?.detectedIngredients)
      ? photoAttachment.detectedIngredients.map((item) => item.trim()).filter(Boolean)
      : [];
    if (ingredients.length === 0) return;
    setPrompt(
      activeCategory === "Deser"
        ? `Mam ${ingredients.join(", ")}. Co słodkiego mogę z tego zrobić?`
        : `Mam ${ingredients.join(", ")}. Co mogę z tego ugotować?`,
    );
    composerRef.current?.focus();
  };

  const sendPrompt = async (rawPrompt) => {
    const trimmed = rawPrompt.trim();
    if (!trimmed || loading) return;
    const filtersForRequest = normalizeChatFiltersForRequest(chatFilters);
    if (trimmed.length > CHAT_PROMPT_MAX_CHARS) {
      setFlash({
        level: "warning",
        message: `Wiadomość jest zbyt długa. Maksymalnie ${CHAT_PROMPT_MAX_CHARS} znaków.`,
      });
      return;
    }
    const requestCategory = detectPromptCategory(trimmed, activeCategory);

    const normalizePrompt = (value) => value.trim().toLowerCase();
    const shouldKeepExcluded =
      normalizePrompt(trimmed) !== "" &&
      normalizePrompt(trimmed) === normalizePrompt(latestUserText);
    const excludedForRequest = shouldKeepExcluded ? excludedRecipeIds : [];

    if (!shouldKeepExcluded && excludedRecipeIds.length > 0) {
      setExcludedRecipeIds([]);
    }

    const userMessage = { role: "user", content: trimmed };
    const nextHistory = [...messages, userMessage].slice(-6);
    const requestToken = requestTokenRef.current + 1;
    requestTokenRef.current = requestToken;

    setFlash({ level: "", message: "" });
    setPrompt("");
    setLoading(true);
    setSelectedOption(null);
    setSelectedRecipe(null);
    setPendingOptions([]);
    rememberRecentSearch(trimmed, "text", requestCategory);
    if (requestCategory !== activeCategory) {
      setActiveCategory(requestCategory);
    }
    setMessages((prev) => [...prev, userMessage]);

    try {
      const response = await apiRequest("/chat/options", {
        method: "POST",
        body: {
          prompt: trimmed,
          history: nextHistory,
          excludedRecipeIds: excludedForRequest,
          category: requestCategory,
          filters: filtersForRequest,
        },
      });
      if (requestToken !== requestTokenRef.current) return;

      const resolvedCategory = normalizeRecipeCategory(response?.category || requestCategory);
      if (resolvedCategory !== requestCategory) {
        setActiveCategory(resolvedCategory);
      }

      const needsClarification = Boolean(response?.needsClarification);
      const clarificationQuestion = asString(response?.clarificationQuestion).trim();
      const constraintNote = asString(response?.constraintNote).trim();
      const assistantText = sanitizeAssistantMessageForDisplay(
        needsClarification ? clarificationQuestion || response?.assistantText : response?.assistantText,
        resolvedCategory,
        trimmed,
      );
      const assistantTextWithNote =
        !needsClarification && constraintNote ? `${assistantText}\n\nUwaga: ${constraintNote}` : assistantText;
      const options = Array.isArray(response?.options)
        ? response.options.slice(0, 2).map((option) => sanitizeOptionForDisplay(option))
        : [];

      setMessages((prev) => [...prev, { role: "assistant", content: assistantTextWithNote }]);
      if (needsClarification) {
        setPendingOptions([]);
        return;
      }
      setPendingOptions(options);
      if (options.length > 0) {
        setOptionsRound((value) => value + 1);
      }
    } catch (error) {
      if (requestToken !== requestTokenRef.current) return;
      const message = normalizeChatErrorMessage(error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: message,
        },
      ]);
      setPendingOptions([]);
      setFlash({ level: "error", message });
    } finally {
      if (requestToken === requestTokenRef.current) {
        setLoading(false);
      }
    }
  };

  const sendFeedback = async (payload) => {
    try {
      await apiRequest("/chat/feedback", {
        method: "POST",
        body: payload,
      });
    } catch {
      // Brak blokowania UI
    }
  };

  const openCameraCapture = () => {
    if (loading) return;
    cameraInputRef.current?.click();
  };

  const sendPhoto = async (attachment, rawNote = "") => {
    if (!attachment?.imageDataUrl || loading) return;
    const filtersForRequest = normalizeChatFiltersForRequest(chatFilters);
    const note = rawNote.trim();

    const photoCaption =
      activeCategory === "Deser"
        ? "Dodaję zdjęcie składników do deseru."
        : "Dodaję zdjęcie produktów do analizy.";
    const photoMessage = note ? `${photoCaption} Wskazówka: ${note}` : photoCaption;

    const userMessage = {
      role: "user",
      content: photoMessage,
      imageUrl: attachment.previewUrl,
      imageAlt: "Zdjęcie produktów przesłane do czatu",
    };
    const nextHistory = [...messages, { role: "user", content: photoMessage }].slice(-6);
    const requestToken = requestTokenRef.current + 1;
    requestTokenRef.current = requestToken;

    setFlash({ level: "", message: "" });
    setPhotoAttachment((prev) =>
      prev
        ? {
            ...prev,
            status: "uploading",
            message: "",
          }
        : prev,
    );
    setLoading(true);
    setSelectedOption(null);
    setSelectedRecipe(null);
    setPendingOptions([]);
    setExcludedRecipeIds([]);
    setMessages((prev) => [...prev, userMessage]);
    const analyzingTimer = window.setTimeout(() => {
      setPhotoAttachment((prev) =>
        prev
          ? {
              ...prev,
              status: "analyzing",
            }
          : prev,
      );
    }, 650);

    try {
      const response = await apiRequest("/chat/photo", {
        method: "POST",
        body: {
          imageDataUrl: attachment.imageDataUrl,
          imageName: attachment.fileName,
          history: nextHistory,
          excludedRecipeIds: [],
          category: activeCategory,
          filters: filtersForRequest,
        },
      });
      if (requestToken !== requestTokenRef.current) return;

      const resolvedCategory = normalizeRecipeCategory(response?.category || activeCategory);
      if (resolvedCategory !== activeCategory) {
        setActiveCategory(resolvedCategory);
      }

      const detectedProducts = Array.isArray(response?.detectedProducts)
        ? response.detectedProducts.map((item) => asString(item).trim()).filter(Boolean)
        : [];
      const analysisPrompt = asString(response?.analysisPrompt).trim();
      const needsClarification = Boolean(response?.needsClarification);
      const clarificationQuestion = asString(response?.clarificationQuestion).trim();
      const constraintNote = asString(response?.constraintNote).trim();
      const assistantText = sanitizeAssistantMessageForDisplay(
        needsClarification ? clarificationQuestion || response?.assistantText : response?.assistantText,
        resolvedCategory,
        photoMessage,
      );
      const assistantTextWithNote =
        !needsClarification && constraintNote ? `${assistantText}\n\nUwaga: ${constraintNote}` : assistantText;
      const options = Array.isArray(response?.options)
        ? response.options.slice(0, 2).map((option) => sanitizeOptionForDisplay(option))
        : [];

      rememberRecentSearch(analysisPrompt || note || photoMessage, "photo", resolvedCategory);
      setPrompt("");
      setPhotoAttachment((prev) =>
        prev
          ? {
              ...prev,
              status: "success",
              message: "",
              detectedIngredients: detectedProducts,
              analysisPrompt,
            }
          : prev,
      );
      setMessages((prev) => [...prev, { role: "assistant", content: assistantTextWithNote }]);
      if (needsClarification) {
        setPendingOptions([]);
        return;
      }
      setPendingOptions(options);
      if (options.length > 0) {
        setOptionsRound((value) => value + 1);
      }
    } catch (error) {
      if (requestToken !== requestTokenRef.current) return;
      const message = normalizePhotoErrorMessage(error);
      setPhotoAttachment((prev) =>
        prev
          ? {
              ...prev,
              status: "error",
              message,
            }
          : prev,
      );
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: message,
        },
      ]);
      setPendingOptions([]);
      setFlash({ level: "error", message });
    } finally {
      window.clearTimeout(analyzingTimer);
      if (requestToken === requestTokenRef.current) {
        setLoading(false);
      }
    }
  };

  const handleCameraInputChange = (event) => {
    const file = event.target.files?.[0] || null;
    event.target.value = "";
    if (!file) return;
    void preparePhotoAttachment(file);
  };

  const hasPendingPhoto =
    photoAttachment && (photoAttachment.status === "ready" || photoAttachment.status === "error");

  const submitComposerAction = async () => {
    if (hasPendingPhoto) {
      await sendPhoto(photoAttachment, prompt);
      return;
    }
    await sendPrompt(prompt);
  };

  const submitPrompt = (event) => {
    event.preventDefault();
    void submitComposerAction();
  };

  const handlePromptKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submitComposerAction();
    }
  };

  const openSelectedOption = async (option, chosenIndex) => {
    if (choosingRecipe || loading) return;

    setChoosingRecipe(true);
    setChoosingIndex(chosenIndex);
    setSelectedOption(option);
    setFlash({ level: "", message: "" });

    void sendFeedback({
      action: "accepted",
      userText: latestUserText,
      option1: pendingOptions[0] || null,
      option2: pendingOptions[1] || null,
      chosenIndex: chosenIndex + 1,
    });

    try {
      const rawId = option?.recipe_id;
      const recipeId =
        Number.isInteger(rawId)
          ? rawId
          : typeof rawId === "string" && /^\d+$/.test(rawId)
            ? Number.parseInt(rawId, 10)
            : null;

      if (recipeId !== null) {
        try {
          const response = await apiRequest(`/public/recipes/${recipeId}`);
          if (response?.recipe) {
            const recipeCategory = normalizeRecipeCategory(response.recipe?.kategoria);
            if (recipeCategory !== activeCategory) {
              setActiveCategory(recipeCategory);
            }
            setSelectedRecipe(recipeFromApiRecipe(response.recipe));
            return;
          }
        } catch {
          // Fallback poniżej
        }
      }

      setSelectedRecipe(recipeFromOption(option || {}));
    } catch {
      setFlash({
        level: "error",
        message: "Nie udało się otworzyć przepisu. Spróbuj ponownie.",
      });
    } finally {
      setChoosingRecipe(false);
      setChoosingIndex(-1);
    }
  };

  const rejectOptions = async () => {
    const ids = pendingOptions
      .map((option) => (Number.isInteger(option?.recipe_id) ? option.recipe_id : null))
      .filter((value) => value !== null);

    if (ids.length > 0) {
      setExcludedRecipeIds((prev) => Array.from(new Set([...prev, ...ids])));
    }

    await sendFeedback({
      action: "rejected",
      userText: latestUserText,
      option1: pendingOptions[0] || null,
      option2: pendingOptions[1] || null,
    });

    setPendingOptions([]);
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content:
          activeCategory === "Deser"
            ? "Zrozumiałem. Spróbujmy czegoś innego. Wolisz deser czekoladowy, owocowy czy bardziej kremowy?"
            : "Zrozumiałem. Spróbujmy czegoś innego. Wolisz coś lżejszego czy inny rodzaj kuchni?",
      },
    ]);
  };

  const backToSearch = () => {
    setSelectedOption(null);
    setSelectedRecipe(null);
    setFlash({ level: "", message: "" });
  };

  const toggleFavoriteRecipe = async () => {
    if (!selectedRecipe) return;

    const nextEntry = {
      id: selectedRecipe.id ?? null,
      title: selectedRecipe.title || "Danie",
      shortDescription: selectedRecipe.shortDescription || "",
      prepTime: selectedRecipe.prepTime || "",
      category: activeCategory,
      savedAt: new Date().toISOString(),
    };

    const key = favoriteKey(nextEntry);
    const alreadySaved = favoriteRecipes.some((item) => favoriteKey(item) === key);
    try {
      const response = await apiRequest("/user/favorites", {
        method: alreadySaved ? "DELETE" : "POST",
        body: nextEntry,
      });
      setFavoriteRecipes(
        normalizeFavoriteRecipes(Array.isArray(response?.favorites) ? response.favorites : []),
      );
      setFlash({
        level: "success",
        message: alreadySaved
          ? "Usunięto przepis z ulubionych."
          : "Zapisano przepis do ulubionych.",
      });
    } catch (error) {
      setFlash({
        level: "error",
        message: error instanceof Error ? error.message : "Nie udało się zapisać ulubionych.",
      });
    }
  };

  const saveCurrentShoppingList = async () => {
    if (!selectedRecipe) return;
    const nextList = {
      recipeTitle: selectedRecipe.title || "Danie",
      items:
        Array.isArray(selectedRecipe.shoppingList) && selectedRecipe.shoppingList.length > 0
          ? selectedRecipe.shoppingList
          : [],
      savedAt: new Date().toISOString(),
    };

    if (nextList.items.length === 0) {
      setFlash({
        level: "warning",
        message: "Ta propozycja nie ma jeszcze gotowej listy zakupów do zapisania.",
      });
      return;
    }

    try {
      const response = await apiRequest("/user/shopping-list", {
        method: "POST",
        body: nextList,
      });
      setSavedShoppingList(normalizeSavedShoppingList(response?.shoppingList || {}));
      setFlash({
        level: "success",
        message: "Zapisano listę zakupów.",
      });
    } catch (error) {
      setFlash({
        level: "error",
        message: error instanceof Error ? error.message : "Nie udało się zapisać listy zakupów.",
      });
    }
  };

  const hasMessages = messages.length > 0;
  const isCurrentRecipeFavorite = selectedRecipe
    ? favoriteRecipes.some((item) => favoriteKey(item) === favoriteKey(selectedRecipe))
    : false;
  const selectedSource = selectedRecipe?.source === "baza" ? "Przepis z bazy" : selectedRecipe?.source === "internet" ? "Źródło internetowe" : "Propozycja AI";
  const ingredientItems =
    selectedRecipe?.ingredients && selectedRecipe.ingredients.length > 0
      ? selectedRecipe.ingredients
      : ingredientItemsFromText(selectedRecipe?.skladniki);
  const preparationSteps =
    selectedRecipe?.steps && selectedRecipe.steps.length > 0
      ? selectedRecipe.steps
      : instructionStepsFromText(selectedRecipe?.opis);
  const substitutions =
    selectedRecipe?.substitutions && selectedRecipe.substitutions.length > 0
      ? selectedRecipe.substitutions
      : [];
  const shoppingList =
    selectedRecipe?.shoppingList && selectedRecipe.shoppingList.length > 0
      ? selectedRecipe.shoppingList
      : [];
  const nutrition = selectedRecipe?.nutrition || {};
  const filmUrl = toExternalUrl(selectedRecipe?.linkFilm || selectedRecipe?.link_filmu);
  const pageUrl = toExternalUrl(selectedRecipe?.linkPage || selectedRecipe?.link_strony);
  const isSendDisabled = loading || (!prompt.trim() && !hasPendingPhoto);
  const sendButtonLabel = hasPendingPhoto ? "Analizuj zdjęcie" : "Wyślij wiadomość";

  return (
    <main
      className={`user-shell ${
        activeCategory === "Deser" ? "mode-deser" : "mode-posilek"
      }${sidebarOpen ? " sidebar-open" : ""}`}
    >
      <div className="ambient ambient-a" />
      <div className="ambient ambient-b" />

      {/* ── User Sidebar ── */}
      <aside className={`user-sidebar${sidebarOpen ? " open" : ""}`}>
        <div className="sidebar-header">
          <span className="sidebar-title">{userAuth ? "Moje konto" : "Logowanie"}</span>
          <button type="button" className="btn sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Zamknij panel">×</button>
        </div>
        {!userAuth ? (
          sidebarView === "register" ? (
            <RegisterForm onRegister={handleUserRegister} onSwitch={() => setSidebarView("login")} />
          ) : (
            <LoginForm onLogin={handleUserLogin} onSwitch={() => setSidebarView("register")} />
          )
        ) : (
          <LoggedInPanel user={userAuth} onLogout={handleUserLogout} onNavigate={(view) => { setFlash({ level: "info", message: `Sekcja „${view}" — w przygotowaniu.` }); }} />
        )}
      </aside>
      {sidebarOpen ? <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} /> : null}

      {/* ── Top bar ── */}
      <div className="top-bar">
        <button type="button" className="btn ghost top-bar-user-btn" onClick={() => setSidebarOpen(true)} aria-label="Otwórz panel użytkownika">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:18,height:18}}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          {userAuth ? userAuth.username : authChecked ? "Zaloguj się" : "Łączenie..."}
        </button>
      </div>

      {resetConfirmOpen ? (
        <ConfirmModal
          title="Nowa rozmowa"
          message="Masz aktywną rozmowę. Czy na pewno chcesz ją zresetować?"
          confirmLabel="Tak, resetuj"
          onConfirm={doResetConversation}
          onCancel={() => setResetConfirmOpen(false)}
          loading={false}
        />
      ) : null}

      <section className="home-card reveal">
        {selectedRecipe ? (
          <>
            <header className="hero-copy">
              <div className="hero-text">
                <h1>{modeConfig.title}</h1>
                <p>{modeConfig.description}</p>
              </div>
              <div className="hero-mode-inline" aria-label="Wybór trybu czata">
                <div className="hero-mode-surface">
                  <HeroModeSwitch activeCategory={activeCategory} onChange={switchChatMode} />
                </div>
              </div>
            </header>

            {flash.message ? <div className={`alert ${flash.level}`}>{flash.message}</div> : null}

            <section className="recipe-stage">
              <div className="recipe-stage-head">
                <div>
                  <p className="recipe-source">{selectedSource}</p>
                  <h2>{selectedRecipe.title || "Danie"}</h2>
                  <p className="recipe-description">{selectedRecipe.shortDescription}</p>
                  {selectedRecipe.source !== "baza" ? (
                    <p className="recipe-detail-note">
                      To skrócony widok oparty na bieżącej propozycji. Możesz wrócić do wyników i
                      doprecyzować kolejną wiadomość bez utraty kontekstu rozmowy.
                    </p>
                  ) : null}
                  <p className="recipe-time">
                    Czas przygotowania: <strong>{selectedRecipe.prepTime}</strong>
                  </p>
                  <div className="recipe-meta-row">
                    <span>
                      Porcje:{" "}
                      <strong>
                        {selectedRecipe.servings ? `${selectedRecipe.servings}` : "w przygotowaniu"}
                      </strong>
                    </span>
                    {selectedRecipe.difficulty ? (
                      <span>
                        Trudność: <strong>{selectedRecipe.difficulty}</strong>
                      </span>
                    ) : null}
                    {selectedRecipe.budget ? (
                      <span>
                        Budżet: <strong>{selectedRecipe.budget}</strong>
                      </span>
                    ) : null}
                    {selectedRecipe.tags?.length > 0 ? (
                      <span>
                        Tagi: <strong>{selectedRecipe.tags.slice(0, 3).join(", ")}</strong>
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="recipe-stage-actions">
                  <button type="button" className="btn recipe-back-btn" onClick={backToSearch}>
                    Wróć do wyników
                  </button>
                  <button
                    type="button"
                    className={`btn ghost recipe-favorite-btn${isCurrentRecipeFavorite ? " active" : ""}${!userAuth ? " btn-needs-login" : ""}`}
                    onClick={() => { if (!userAuth) { setSidebarOpen(true); setSidebarView("login"); setFlash({ level: "info", message: "Zaloguj się, aby zapisywać ulubione." }); return; } toggleFavoriteRecipe(); }}
                  >
                    {isCurrentRecipeFavorite ? "Usuń z ulubionych" : "Zapisz do ulubionych"}
                  </button>
                </div>
              </div>

              <div className="recipe-detail-flow">
                <article className="recipe-block">
                  <h3>Składniki</h3>
                  {ingredientItems.length > 0 ? (
                    <ul className="recipe-list">
                      {ingredientItems.map((item, index) => (
                        <li key={`ingredient-${index}`}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>Pełna lista składników jest w przygotowaniu.</p>
                  )}
                </article>
                <article className="recipe-block">
                  <h3>Sposób przygotowania</h3>
                  {preparationSteps.length > 0 ? (
                    <ol className="recipe-steps">
                      {preparationSteps.map((step, index) => (
                        <li key={`step-${index}`}>
                          <span className="recipe-step-label">Krok {index + 1}</span>
                          <p>{step}</p>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p>Pełny przepis jest w przygotowaniu. Możesz wrócić i wybrać inną propozycję.</p>
                  )}
                  {filmUrl ? (
                    <div className="recipe-film-link-wrap">
                      <a
                        href={filmUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn ghost inline-link recipe-film-cta"
                      >
                        Przejdź do filmu
                      </a>
                    </div>
                  ) : null}
                </article>
                <article className="recipe-block">
                  <h3>Możliwe zamienniki</h3>
                  {substitutions.length > 0 ? (
                    <ul className="recipe-list">
                      {substitutions.map((item, index) => (
                        <li key={`substitution-${index}`}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>Zamienniki będą dodawane w kolejnych aktualizacjach.</p>
                  )}
                </article>
                <article className="recipe-block recipe-grid">
                  <div>
                    <h3>Wartości odżywcze</h3>
                    {nutrition.calories || nutrition.protein || nutrition.fat || nutrition.carbs ? (
                      <ul className="recipe-list compact">
                        {nutrition.calories ? <li>Kalorie: {nutrition.calories}</li> : null}
                        {nutrition.protein ? <li>Białko: {nutrition.protein}</li> : null}
                        {nutrition.fat ? <li>Tłuszcz: {nutrition.fat}</li> : null}
                        {nutrition.carbs ? <li>Węglowodany: {nutrition.carbs}</li> : null}
                      </ul>
                    ) : (
                      <p>Wartości odżywcze: w przygotowaniu.</p>
                    )}
                  </div>
                  <div>
                    <h3>Lista zakupów</h3>
                    {shoppingList.length > 0 ? (
                      <>
                        <ul className="recipe-list compact">
                          {shoppingList.map((item, index) => (
                            <li key={`shopping-${index}`}>{item}</li>
                          ))}
                        </ul>
                        {savedShoppingList.recipeTitle === selectedRecipe.title ? (
                          <p className="recipe-saved-note">
                            Ta lista zakupów jest już zapisana lokalnie.
                          </p>
                        ) : null}
                      </>
                    ) : (
                      <p>Lista zakupów będzie dostępna w kolejnym etapie.</p>
                    )}
                    <button
                      type="button"
                      className={`btn ghost recipe-future-btn${!userAuth ? " btn-needs-login" : ""}`}
                      onClick={() => { if (!userAuth) { setSidebarOpen(true); setSidebarView("login"); setFlash({ level: "info", message: "Zaloguj się, aby zapisać listę zakupów." }); return; } saveCurrentShoppingList(); }}
                      disabled={shoppingList.length === 0}
                    >
                      Zapisz listę zakupów
                    </button>
                  </div>
                </article>
                {pageUrl ? (
                  <article className="recipe-block">
                    <h3>Link do strony</h3>
                    <a
                      href={pageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="recipe-link"
                    >
                      {selectedRecipe.linkPage || selectedRecipe.link_strony}
                    </a>
                  </article>
                ) : null}
              </div>
            </section>
          </>
        ) : (
          <section className="chat-card">
            <div className="chat-scroll" ref={chatRef}>
              <header className="hero-copy">
                <div className="hero-text">
                  <h1>{modeConfig.title}</h1>
                  <p>{modeConfig.description}</p>
                </div>
                <div className="hero-mode-inline" aria-label="Wybór trybu czata">
                  <div className="hero-mode-surface">
                    <HeroModeSwitch activeCategory={activeCategory} onChange={switchChatMode} />
                  </div>
                </div>
              </header>

              {hasMessages ? (
                <div className="chat-toolbar">
                  <div className="chat-toolbar-meta">
                    <span className="round-badge">
                      {optionsRound > 0 ? `Runda ${optionsRound}` : "Nowa sesja"}
                    </span>
                    {filterPills.length > 0 ? (
                      <span className="round-badge soft">Filtry: {filterPills.length}</span>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="btn reset-btn"
                    onClick={resetConversation}
                    disabled={loading || choosingRecipe}
                    title="Rozpocznij nową rozmowę"
                    aria-label="Rozpocznij nową rozmowę"
                  >
                    <svg className="reset-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 4v6h6" />
                      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                    </svg>
                    Nowa rozmowa
                  </button>
                </div>
              ) : null}

              {flash.message ? <div className={`alert ${flash.level}`}>{flash.message}</div> : null}

              {messages.map((message, index) => (
                <ChatBubble key={`${message.role}-${index}`} role={message.role} content={message.content} imageUrl={message.imageUrl} imageAlt={message.imageAlt} />
              ))}

              {loading ? <TypingBubble /> : null}

              {!hasMessages ? (
                <div className="empty-state">
                  <ChatFiltersBar
                    filters={safeFilters}
                    onChange={updateFilter}
                    onReset={clearFilters}
                    disabled={loading || choosingRecipe}
                    isOpen={filtersOpen}
                    onToggle={() => setFiltersOpen((prev) => !prev)}
                  />
                  <RecentSearches
                    items={recentSearches}
                    onPick={sendPrompt}
                    onClear={clearRecentSearches}
                    disabled={loading}
                  />
                  <StarterPrompts
                    loading={loading}
                    prompts={modeConfig.starterPrompts}
                    onPick={sendPrompt}
                  />
                </div>
              ) : null}

              {pendingOptions.length > 0 ? (
                <section className="choices-wrap">
                  <div className="choices-head">
                    <h3>Co wybierasz?</h3>
                    <span>Runda {optionsRound}</span>
                  </div>
                  <div className={`choices-grid ${pendingOptions.length === 1 ? "single" : ""}`}>
                    {pendingOptions.map((option, index) => (
                      <OptionCard
                        key={`option-${optionsRound}-${index}`}
                        option={option}
                        index={index}
                        onChoose={openSelectedOption}
                        disabled={choosingRecipe}
                        choosing={choosingRecipe && choosingIndex === index}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    className="btn primary"
                    onClick={rejectOptions}
                    disabled={choosingRecipe || loading}
                  >
                    Żadne mi nie pasuje, szukaj dalej
                  </button>
                </section>
              ) : null}
            </div>
            <PhotoAttachmentCard
              attachment={photoAttachment}
              disabled={loading || choosingRecipe}
              onRemove={clearPhotoAttachment}
              onRetry={() => {
                void retryPhotoAnalysis();
              }}
              onIngredientChange={updateDetectedIngredient}
              onIngredientRemove={removeDetectedIngredient}
              onUseIngredients={useDetectedIngredientsInPrompt}
            />
            {hasMessages ? (
              <ChatFiltersBar
                filters={safeFilters}
                onChange={updateFilter}
                onReset={clearFilters}
                disabled={loading || choosingRecipe}
                isOpen={filtersOpen}
                onToggle={() => setFiltersOpen((prev) => !prev)}
              />
            ) : null}
            <form className="composer" onSubmit={submitPrompt}>
              <label htmlFor="chat-prompt" className="sr-only">
                Pole czatu
              </label>
              <textarea
                id="chat-prompt"
                ref={composerRef}
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={handlePromptKeyDown}
                placeholder={modeConfig.placeholder}
                rows={1}
                maxLength={CHAT_PROMPT_MAX_CHARS}
                disabled={loading}
              />
              <div className="composer-actions">
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                  capture="environment"
                  className="sr-only"
                  tabIndex={-1}
                  onChange={handleCameraInputChange}
                  disabled={loading}
                />
                <div className="camera-wrap">
                  <button
                    type="button"
                    className="btn camera-btn"
                    aria-label="Dodaj zdjęcie lodówki lub składników"
                    title="Dodaj zdjęcie lodówki lub składników"
                    onClick={openCameraCapture}
                    disabled={loading}
                  >
                    <svg className="camera-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                  </button>
                </div>
                <button
                  type="submit"
                  className="btn send"
                  disabled={isSendDisabled}
                  aria-label={sendButtonLabel}
                  title={sendButtonLabel}
                >
                  {loading ? (
                    <span className="send-loading">…</span>
                  ) : (
                    <svg className="send-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 2 11 13" />
                      <path d="M22 2 15 22 11 13 2 9z" />
                    </svg>
                  )}
                </button>
              </div>
            </form>
            <p className="composer-photo-note">
              Dodaj zdjęcie lodówki lub składników - AI spróbuje je rozpoznać. Akceptowane
              formaty: JPG, PNG, WEBP, HEIC i HEIF do 6 MB.
            </p>
          </section>
        )}
      </section>
    </main>
  );
}

function emptyRecipeForm() {
  return {
    nazwa: "",
    skladniki: "",
    opis: "",
    czas: "",
    kategoria: DEFAULT_RECIPE_CATEGORY,
    tagi: "",
    link_filmu: "",
    link_strony: "",
    meal_type: "",
    diet: "klasyczna",
    allergens: "",
    difficulty: "",
    servings: "",
    budget_level: "",
    status: "roboczy",
    source: "administrator",
  };
}

function isValidUrl(value) {
  if (!value) return true;
  const text = value.trim();
  if (!text) return true;
  const normalized = /^https?:\/\//i.test(text) ? text : `https://${text}`;
  try {
    const parsed = new URL(normalized);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function validateRecipeForm(form, instructionSteps) {
  const errors = {};
  const nazwa = (form.nazwa || "").trim();
  if (!nazwa) {
    errors.nazwa = "Nazwa dania jest wymagana.";
  } else if (nazwa.length < 3) {
    errors.nazwa = "Nazwa musi mieć min. 3 znaki.";
  } else if (nazwa.length > 100) {
    errors.nazwa = "Nazwa może mieć maks. 100 znaków.";
  }

  if (!(form.skladniki || "").trim()) {
    errors.skladniki = "Lista składników jest wymagana.";
  }

  const czasRaw = (form.czas || "").trim();
  if (!czasRaw) {
    errors.czas = "Czas przygotowania jest wymagany.";
  } else {
    const num = Number.parseInt(czasRaw.replace(/[^\d]/g, ""), 10);
    if (!Number.isFinite(num) || num < 1 || num > 600) {
      errors.czas = "Czas musi być liczbą od 1 do 600.";
    }
  }

  const filledSteps = (instructionSteps || []).filter((s) => s.trim());
  if (filledSteps.length === 0) {
    errors.opis = "Minimum 1 krok przepisu jest wymagany.";
  }

  const tagsList = parseTags(form.tagi || "").filter(Boolean);
  if (tagsList.length === 0) {
    errors.tagi = "Minimum 1 tag jest wymagany.";
  }

  if (!isValidUrl(form.link_filmu)) {
    errors.link_filmu = "Niepoprawny URL filmu.";
  }

  if (!isValidUrl(form.link_strony)) {
    errors.link_strony = "Niepoprawny URL strony.";
  }

  const servingsRaw = (form.servings || "").toString().trim();
  if (servingsRaw) {
    const num = Number.parseInt(servingsRaw, 10);
    if (!Number.isFinite(num) || num < 1 || num > 100) {
      errors.servings = "Porcje: liczba od 1 do 100.";
    }
  }

  return Object.keys(errors).length > 0 ? errors : null;
}

function FieldError({ error }) {
  if (!error) return null;
  return <p className="field-error" role="alert">{error}</p>;
}

function ConfirmModal({ title, message, confirmLabel, onConfirm, onCancel, loading }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">{title}</h3>
        <p className="modal-message">{message}</p>
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onCancel} disabled={loading}>
            Anuluj
          </button>
          <button type="button" className="btn danger-btn" onClick={onConfirm} disabled={loading}>
            {loading ? "Usuwanie..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function Toast({ flash, onDismiss }) {
  const timerRef = useRef(null);

  useEffect(() => {
    if (!flash.message) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onDismiss();
    }, 5000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [flash.message, flash.level, onDismiss]);

  if (!flash.message) return null;

  return (
    <div className={`toast-notification toast-${flash.level}`} role="status" aria-live="polite">
      <span>{flash.message}</span>
      <button type="button" className="toast-close" onClick={onDismiss} aria-label="Zamknij">×</button>
    </div>
  );
}

function AllergensEditor({ idPrefix, value, onChange, disabled }) {
  const selected = value ? value.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean) : [];
  const toggle = (allergen) => {
    const next = selected.includes(allergen)
      ? selected.filter((a) => a !== allergen)
      : [...selected, allergen];
    onChange(next.join(", "));
  };
  return (
    <div className="admin-field full">
      <label>Alergeny</label>
      <div className="allergen-chips">
        {ALLERGEN_OPTIONS.map((allergen) => (
          <button
            key={`${idPrefix}-allergen-${allergen}`}
            type="button"
            className={`filter-chip${selected.includes(allergen) ? " active" : ""}`}
            onClick={() => toggle(allergen)}
            disabled={disabled}
          >
            {allergen}
          </button>
        ))}
      </div>
      <p className="small-note">Kliknij, aby zaznaczyć/odznaczyć alergeny.</p>
    </div>
  );
}

function AdminPanelPage() {
  const [authReady, setAuthReady] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [adminEnabled, setAdminEnabled] = useState(true);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loading, setLoading] = useState(false);

  const [recipes, setRecipes] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [editingId, setEditingId] = useState(null);
  const [addForm, setAddForm] = useState(emptyRecipeForm());
  const [editForm, setEditForm] = useState(emptyRecipeForm());
  const [addInstructionSteps, setAddInstructionSteps] = useState([]);
  const [editInstructionSteps, setEditInstructionSteps] = useState([]);
  const [addTagInput, setAddTagInput] = useState("");
  const [editTagInput, setEditTagInput] = useState("");
  const [flash, setFlash] = useState({ level: "", message: "" });
  const [addErrors, setAddErrors] = useState({});
  const [editErrors, setEditErrors] = useState({});
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Search, filter, sort
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterMealType, setFilterMealType] = useState("");
  const [filterDiet, setFilterDiet] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterDifficulty, setFilterDifficulty] = useState("");
  const [filterSource, setFilterSource] = useState("");

  // Admin section tab
  const [adminSection, setAdminSection] = useState("recipes"); // recipes | users

  const [users, setUsers] = useState([]);
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [sortField, setSortField] = useState("id");
  const [sortDir, setSortDir] = useState("desc");

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Role — TODO: fetch from backend when role system is implemented
  const [adminRole] = useState(ADMIN_ROLES.admin);

  const editingRecipe = useMemo(
    () => recipes.find((item) => item.id === editingId) || null,
    [recipes, editingId],
  );

  const filteredRecipes = useMemo(() => {
    let result = recipes;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((r) =>
        (r.nazwa || "").toLowerCase().includes(q) ||
        (r.tagi || "").toLowerCase().includes(q) ||
        (r.skladniki || "").toLowerCase().includes(q)
      );
    }
    if (filterCategory) result = result.filter((r) => r.kategoria === filterCategory);
    if (filterMealType) result = result.filter((r) => r.meal_type === filterMealType);
    if (filterDiet) result = result.filter((r) => r.diet === filterDiet);
    if (filterStatus) result = result.filter((r) => (r.status || "roboczy") === filterStatus);
    if (filterDifficulty) result = result.filter((r) => r.difficulty === filterDifficulty);
    if (filterSource) result = result.filter((r) => (r.source || "administrator") === filterSource);
    return result;
  }, [recipes, searchQuery, filterCategory, filterMealType, filterDiet, filterStatus, filterDifficulty, filterSource]);

  const sortedRecipes = useMemo(() => {
    const list = [...filteredRecipes];
    const dir = sortDir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      if (sortField === "nazwa") return dir * (a.nazwa || "").localeCompare(b.nazwa || "", "pl");
      if (sortField === "czas") {
        const aNum = Number.parseInt((a.czas || "0").replace(/[^\d]/g, ""), 10) || 0;
        const bNum = Number.parseInt((b.czas || "0").replace(/[^\d]/g, ""), 10) || 0;
        return dir * (aNum - bNum);
      }
      return dir * ((a.id || 0) - (b.id || 0));
    });
    return list;
  }, [filteredRecipes, sortField, sortDir]);

  const totalFiltered = sortedRecipes.length;

  const pagedRecipes = useMemo(() => {
    const offset = (currentPage - 1) * ADMIN_PAGE_SIZE;
    return sortedRecipes.slice(offset, offset + ADMIN_PAGE_SIZE);
  }, [sortedRecipes, currentPage]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(totalFiltered / ADMIN_PAGE_SIZE)),
    [totalFiltered],
  );

  const knownTags = useMemo(() => {
    const tags = [];
    for (const recipe of recipes) {
      tags.push(...parseTags(recipe?.tagi || ""));
    }
    return uniqueTags(tags).sort((left, right) =>
      left.localeCompare(right, "pl", { sensitivity: "base" }),
    );
  }, [recipes]);

  const knownTagByKey = useMemo(() => {
    const map = new Map();
    for (const tag of knownTags) {
      const key = normalizeTagKey(tag);
      if (!key || map.has(key)) continue;
      map.set(key, tag);
    }
    return map;
  }, [knownTags]);

  const addTags = useMemo(() => uniqueTags(parseTags(addForm.tagi)), [addForm.tagi]);
  const editTags = useMemo(() => uniqueTags(parseTags(editForm.tagi)), [editForm.tagi]);

  const availableAddTagSuggestions = useMemo(() => {
    const used = new Set(addTags.map((tag) => normalizeTagKey(tag)));
    return knownTags.filter((tag) => !used.has(normalizeTagKey(tag)));
  }, [knownTags, addTags]);

  const availableEditTagSuggestions = useMemo(() => {
    const used = new Set(editTags.map((tag) => normalizeTagKey(tag)));
    return knownTags.filter((tag) => !used.has(normalizeTagKey(tag)));
  }, [knownTags, editTags]);

  const setFlashMessage = useRef((level, message) => {
    setFlash({ level, message });
  }).current;

  const clearFlash = useRef(() => {
    setFlash({ level: "", message: "" });
  }).current;

  const clearTagInput = (mode) => {
    if (mode === "add") {
      setAddTagInput("");
      return;
    }
    setEditTagInput("");
  };

  const resolveTagValue = (rawValue) => {
    const cleaned = asString(rawValue).trim().replace(/[.,;]+$/g, "");
    const key = normalizeTagKey(cleaned);
    if (!key) return "";
    const existing = knownTagByKey.get(key);
    return existing || cleaned;
  };

  const setTagsForMode = (mode, tags) => {
    const tagString = tagsToString(tags);
    if (mode === "add") {
      setAddForm((prev) => ({ ...prev, tagi: tagString }));
      return;
    }
    setEditForm((prev) => ({ ...prev, tagi: tagString }));
  };

  const addTagFromInput = (mode) => {
    const rawInput = mode === "add" ? addTagInput : editTagInput;
    const resolvedTag = resolveTagValue(rawInput);
    if (!resolvedTag) {
      clearTagInput(mode);
      return;
    }

    const currentTags = mode === "add" ? addTags : editTags;
    const existingKeys = new Set(currentTags.map((tag) => normalizeTagKey(tag)));
    const nextKey = normalizeTagKey(resolvedTag);

    if (existingKeys.has(nextKey)) {
      clearTagInput(mode);
      return;
    }

    setTagsForMode(mode, [...currentTags, resolvedTag]);
    clearTagInput(mode);
  };

  const removeTag = (mode, tagToRemove) => {
    const currentTags = mode === "add" ? addTags : editTags;
    const removeKey = normalizeTagKey(tagToRemove);
    const nextTags = currentTags.filter((tag) => normalizeTagKey(tag) !== removeKey);
    setTagsForMode(mode, nextTags);
  };

  const onTagInputKeyDown = (mode, event) => {
    if (event.key === "Enter" || event.key === "," || event.key === ";") {
      event.preventDefault();
      addTagFromInput(mode);
    }
  };

  const addInstructionStep = (mode) => {
    if (mode === "add") {
      setAddInstructionSteps((prev) => [...prev, ""]);
      return;
    }
    setEditInstructionSteps((prev) => [...prev, ""]);
  };

  const updateInstructionStep = (mode, stepIndex, value) => {
    if (mode === "add") {
      setAddInstructionSteps((prev) =>
        prev.map((step, index) => (index === stepIndex ? value : step)),
      );
      return;
    }
    setEditInstructionSteps((prev) =>
      prev.map((step, index) => (index === stepIndex ? value : step)),
    );
  };

  const removeInstructionStep = (mode, stepIndex) => {
    if (mode === "add") {
      setAddInstructionSteps((prev) => prev.filter((_, index) => index !== stepIndex));
      return;
    }
    setEditInstructionSteps((prev) => prev.filter((_, index) => index !== stepIndex));
  };

  const buildRecipePayload = (form, currentTags, pendingInput, instructionSteps) => {
    const pending = resolveTagValue(pendingInput);
    const payloadTags = pending ? [...currentTags, pending] : currentTags;
    return {
      ...form,
      opis: serializeInstructionSteps(instructionSteps),
      kategoria: normalizeRecipeCategory(form.kategoria),
      tagi: tagsToString(payloadTags),
      servings: form.servings ? Number.parseInt(form.servings, 10) || null : null,
    };
  };

  const loadRecipes = async () => {
    const response = await apiRequest("/recipes");
    const rows = Array.isArray(response?.recipes) ? response.recipes : [];
    const normalizedRows = rows.map((recipe) => ({
      ...recipe,
      kategoria: normalizeRecipeCategory(recipe?.kategoria),
      tagi: tagsToString(parseTags(recipe?.tagi)),
      meal_type: recipe?.meal_type || "",
      diet: recipe?.diet || "klasyczna",
      allergens: recipe?.allergens || "",
      difficulty: recipe?.difficulty || "",
      servings: recipe?.servings ?? null,
      budget_level: recipe?.budget_level || "",
      status: recipe?.status || "roboczy",
      source: recipe?.source || "administrator",
    }));
    setRecipes(normalizedRows);
    setCurrentPage((prev) => {
      const maxPage = Math.max(1, Math.ceil(normalizedRows.length / ADMIN_PAGE_SIZE));
      return Math.min(Math.max(prev, 1), maxPage);
    });

    if (!normalizedRows.some((item) => item.id === editingId)) {
      setEditingId(null);
      setEditForm(emptyRecipeForm());
      setEditInstructionSteps([]);
      setEditTagInput("");
    }
  };

  const loadUsers = async () => {
    const response = await apiRequest("/admin/users");
    const rows = Array.isArray(response?.users) ? response.users : [];
    setUsers(
      rows.map((user) => ({
        id: user?.id ?? null,
        username: user?.username || "",
        email: user?.email || "",
        registeredAt: user?.registeredAt || "",
        status: user?.status === "zawieszony" ? "zawieszony" : "aktywny",
      })),
    );
  };

  const checkAuth = useEffectEvent(async () => {
    try {
      const response = await apiRequest("/admin/me");
      setLoggedIn(Boolean(response?.loggedIn));
      setAdminEnabled(response?.adminEnabled !== false);
      if (response?.loggedIn) {
        await Promise.all([loadRecipes(), loadUsers()]);
      }
    } catch {
      setLoggedIn(false);
      setAdminEnabled(true);
    } finally {
      setAuthReady(true);
    }
  });

  useEffect(() => {
    void checkAuth();
  }, []);

  useEffect(() => {
    if (!loggedIn || adminSection !== "users") return;
    void loadUsers().catch(() => {
      setFlashMessage("error", "Nie udało się pobrać listy użytkowników.");
    });
  }, [loggedIn, adminSection, setFlashMessage]);

  useEffect(() => {
    if (!editingRecipe) return;
    setEditForm({
      nazwa: editingRecipe.nazwa || "",
      skladniki: editingRecipe.skladniki || "",
      opis: editingRecipe.opis || "",
      czas: editingRecipe.czas || "",
      kategoria: normalizeRecipeCategory(editingRecipe.kategoria),
      tagi: tagsToString(parseTags(editingRecipe.tagi || "")),
      link_filmu: editingRecipe.link_filmu || "",
      link_strony: editingRecipe.link_strony || "",
      meal_type: editingRecipe.meal_type || "",
      diet: editingRecipe.diet || "klasyczna",
      allergens: editingRecipe.allergens || "",
      difficulty: editingRecipe.difficulty || "",
      servings: editingRecipe.servings != null ? String(editingRecipe.servings) : "",
      budget_level: editingRecipe.budget_level || "",
      status: editingRecipe.status || "roboczy",
      source: editingRecipe.source || "administrator",
    });
    setEditInstructionSteps(adminInstructionStepsFromText(editingRecipe.opis || ""));
    setEditTagInput("");
    setEditErrors({});
  }, [editingRecipe]);

  useEffect(() => {
    setCurrentPage((prev) => Math.min(Math.max(prev, 1), totalPages));
  }, [totalPages]);

  const submitLogin = async (event) => {
    event.preventDefault();
    if (!password.trim()) return;
    if (!adminEnabled) {
      setLoginError("Logowanie admina jest wyłączone po stronie serwera.");
      return;
    }

    setLoading(true);
    setLoginError("");
    try {
      await apiRequest("/admin/login", { method: "POST", body: { password } });
      setLoggedIn(true);
      setPassword("");
      setFlashMessage("success", "Jesteś zalogowany jako administrator.");
      await Promise.all([loadRecipes(), loadUsers()]);
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "Nieudane logowanie.");
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await apiRequest("/admin/logout", { method: "POST" });
    } finally {
      setLoggedIn(false);
      setRecipes([]);
      setUsers([]);
      setCurrentPage(1);
      setEditingId(null);
      setEditForm(emptyRecipeForm());
      setEditInstructionSteps([]);
      setAddTagInput("");
      setEditTagInput("");
      setFlashMessage("info", "Wylogowano.");
    }
  };

  const saveNewRecipe = async (event) => {
    event.preventDefault();

    const errors = validateRecipeForm(addForm, addInstructionSteps);
    setAddErrors(errors || {});
    if (errors) {
      setFlashMessage("warning", "Popraw błędy w formularzu.");
      return;
    }

    setLoading(true);
    try {
      const payload = buildRecipePayload(
        addForm,
        addTags,
        addTagInput,
        addInstructionSteps,
      );
      const response = await apiRequest("/recipes", {
        method: "POST",
        body: payload,
      });
      setAddForm(emptyRecipeForm());
      setAddInstructionSteps([]);
      setAddTagInput("");
      setAddErrors({});
      setFlashMessage(
        "success",
        `Dodano przepis: ${response?.recipe?.nazwa || "przepis"} (ID: ${response?.recipe?.id ?? "-"})`,
      );
      setCurrentPage(1);
      await loadRecipes();
    } catch (error) {
      setFlashMessage(
        "error",
        error instanceof Error ? error.message : "Błąd zapisu przepisu.",
      );
    } finally {
      setLoading(false);
    }
  };

  const saveEditedRecipe = async (event, recipeId) => {
    event.preventDefault();
    if (!recipeId) return;

    const errors = validateRecipeForm(editForm, editInstructionSteps);
    setEditErrors(errors || {});
    if (errors) {
      setFlashMessage("warning", "Popraw błędy w formularzu.");
      return;
    }

    setLoading(true);
    try {
      const payload = buildRecipePayload(
        editForm,
        editTags,
        editTagInput,
        editInstructionSteps,
      );
      await apiRequest(`/recipes/${recipeId}`, {
        method: "PUT",
        body: payload,
      });
      setFlashMessage("success", "Zapisano zmiany w przepisie.");
      setEditTagInput("");
      setEditErrors({});
      await loadRecipes();
    } catch (error) {
      setFlashMessage(
        "error",
        error instanceof Error ? error.message : "Błąd zapisu zmian.",
      );
    } finally {
      setLoading(false);
    }
  };

  const requestDeleteRecipe = (recipe) => {
    setDeleteConfirm(recipe);
  };

  const confirmDeleteRecipe = async () => {
    if (!deleteConfirm) return;
    const recipeId = deleteConfirm.id;
    setDeleteLoading(true);
    try {
      await apiRequest(`/recipes/${recipeId}`, { method: "DELETE" });
      setFlashMessage("success", `Usunięto przepis: ${deleteConfirm.nazwa || ""}`);
      if (editingId === recipeId) {
        setEditingId(null);
        setEditForm(emptyRecipeForm());
        setEditInstructionSteps([]);
        setEditTagInput("");
      }
      setDeleteConfirm(null);
      await loadRecipes();
    } catch (error) {
      setFlashMessage(
        "error",
        error instanceof Error ? error.message : "Błąd usuwania przepisu.",
      );
    } finally {
      setDeleteLoading(false);
    }
  };

  const cancelDelete = () => {
    setDeleteConfirm(null);
  };

  const startEditing = (recipe) => {
    if (editingId === recipe.id) {
      cancelEditing();
      return;
    }

    setEditingId(recipe.id);
    setEditForm({
      nazwa: recipe.nazwa || "",
      skladniki: recipe.skladniki || "",
      opis: recipe.opis || "",
      czas: recipe.czas || "",
      kategoria: normalizeRecipeCategory(recipe.kategoria),
      tagi: tagsToString(parseTags(recipe.tagi || "")),
      link_filmu: recipe.link_filmu || "",
      link_strony: recipe.link_strony || "",
      meal_type: recipe.meal_type || "",
      diet: recipe.diet || "klasyczna",
      allergens: recipe.allergens || "",
      difficulty: recipe.difficulty || "",
      servings: recipe.servings != null ? String(recipe.servings) : "",
      budget_level: recipe.budget_level || "",
      status: recipe.status || "roboczy",
      source: recipe.source || "administrator",
    });
    setEditInstructionSteps(adminInstructionStepsFromText(recipe.opis || ""));
    setEditTagInput("");
    setEditErrors({});
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditForm(emptyRecipeForm());
    setEditInstructionSteps([]);
    setEditTagInput("");
    setEditErrors({});
  };

  const moveInstructionStep = (mode, fromIndex, toIndex) => {
    const setter = mode === "add" ? setAddInstructionSteps : setEditInstructionSteps;
    setter((prev) => {
      if (toIndex < 0 || toIndex >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  const duplicateRecipe = async (recipe) => {
    setLoading(true);
    try {
      const payload = {
        ...recipe,
        nazwa: `${recipe.nazwa} (kopia)`,
        id: undefined,
        status: "roboczy",
      };
      const response = await apiRequest("/recipes", { method: "POST", body: payload });
      setFlashMessage("success", `Zduplikowano: ${response?.recipe?.nazwa || "przepis"}`);
      await loadRecipes();
    } catch (error) {
      setFlashMessage("error", error instanceof Error ? error.message : "Błąd duplikowania.");
    } finally {
      setLoading(false);
    }
  };

  const exportRecipesJSON = () => {
    const data = JSON.stringify(filteredRecipes, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "przepisy.json";
    link.click();
    URL.revokeObjectURL(url);
    setFlashMessage("success", `Wyeksportowano ${filteredRecipes.length} przepisów (JSON).`);
  };

  const exportRecipesCSV = () => {
    const headers = ["id", "nazwa", "kategoria", "czas", "meal_type", "diet", "difficulty", "status", "tagi"];
    const rows = filteredRecipes.map((r) =>
      headers.map((h) => `"${String(r[h] || "").replace(/"/g, '""')}"`).join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "przepisy.csv";
    link.click();
    URL.revokeObjectURL(url);
    setFlashMessage("success", `Wyeksportowano ${filteredRecipes.length} przepisów (CSV).`);
  };

  const toggleSelectId = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === pagedRecipes.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pagedRecipes.map((r) => r.id)));
    }
  };

  const bulkChangeStatus = async (newStatus) => {
    if (selectedIds.size === 0) return;
    setLoading(true);
    try {
      let successCount = 0;
      for (const id of selectedIds) {
        try {
          const recipe = recipes.find((r) => r.id === id);
          if (recipe) {
            await apiRequest(`/recipes/${id}`, { method: "PUT", body: { ...recipe, status: newStatus } });
            successCount++;
          }
        } catch { /* continue */ }
      }
      setFlashMessage("success", `Zmieniono status ${successCount}/${selectedIds.size} przepisów.`);
      setSelectedIds(new Set());
      await loadRecipes();
    } catch {
      setFlashMessage("error", "Błąd podczas zmiany statusu.");
    } finally {
      setLoading(false);
    }
  };

  const bulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (adminRole !== ADMIN_ROLES.admin) {
      setFlashMessage("warning", "Brak uprawnień do usuwania.");
      return;
    }
    setLoading(true);
    try {
      let successCount = 0;
      for (const id of selectedIds) {
        try {
          await apiRequest(`/recipes/${id}`, { method: "DELETE" });
          successCount++;
        } catch { /* continue */ }
      }
      setFlashMessage("success", `Usunięto ${successCount}/${selectedIds.size} przepisów.`);
      setSelectedIds(new Set());
      await loadRecipes();
    } catch {
      setFlashMessage("error", "Błąd podczas usuwania.");
    } finally {
      setLoading(false);
    }
  };

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const clearFilters = () => {
    setSearchQuery("");
    setFilterCategory("");
    setFilterMealType("");
    setFilterDiet("");
    setFilterStatus("");
    setFilterDifficulty("");
    setFilterSource("");
  };

  const goToPrevPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };

  const goToNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  };

  if (!authReady) {
    return (
      <main className="admin-shell">
        <section className="admin-panel">
          <h1>Zaplecze Kuchenne</h1>
          <p className="small-note">Sprawdzanie sesji administratora...</p>
        </section>
      </main>
    );
  }

  if (!loggedIn) {
    return (
      <main className="admin-shell">
        <section className="admin-panel">
          <h1>Zaplecze Kuchenne</h1>
          <p className="small-note">Zaloguj się, aby zarządzać przepisami.</p>
          <form className="stack-form" onSubmit={submitLogin}>
            <div className="admin-field">
              <label htmlFor="admin-password">Hasło administratora</label>
              <input
                id="admin-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
              />
            </div>
            {loginError ? <div className="alert error">{loginError}</div> : null}
            {!adminEnabled ? (
              <div className="alert warning">
                Logowanie admina jest wyłączone. Ustaw `ADMIN_PASSWORD` i `ADMIN_SESSION_SECRET`.
              </div>
            ) : null}
            <button type="submit" className="btn send" disabled={loading || !adminEnabled}>
              {loading ? "Logowanie..." : "Zaloguj"}
            </button>
          </form>
          <p className="small-note top-gap">
            Powrót do strony głównej: <a href="/">co-moge-zjesc.pl</a>
          </p>
        </section>
      </main>
    );
  }

  const addFormValid = !validateRecipeForm(addForm, addInstructionSteps);
  const editFormValid = !validateRecipeForm(editForm, editInstructionSteps);
  const hasActiveFilters = searchQuery || filterCategory || filterMealType || filterDiet || filterStatus || filterDifficulty || filterSource;

  const renderRecipeFormFields = (prefix, form, setForm, errors, steps, stepHandlers, tagProps) => (
    <div className="admin-grid">
      <div className={`admin-field${errors.nazwa ? " has-error" : ""}`}>
        <label htmlFor={`${prefix}-nazwa`}>Nazwa dania <span className="field-req">*</span></label>
        <input
          id={`${prefix}-nazwa`}
          type="text"
          value={form.nazwa}
          onChange={(e) => setForm((prev) => ({ ...prev, nazwa: e.target.value }))}
          maxLength={100}
          placeholder="Min. 3 znaki, maks. 100"
        />
        <FieldError error={errors.nazwa} />
      </div>

      <div className={`admin-field${errors.skladniki ? " has-error" : ""}`}>
        <label htmlFor={`${prefix}-skladniki`}>Lista składników <span className="field-req">*</span></label>
        <textarea
          id={`${prefix}-skladniki`}
          value={form.skladniki}
          onChange={(e) => setForm((prev) => ({ ...prev, skladniki: e.target.value }))}
          placeholder="Jeden składnik na linię"
        />
        <FieldError error={errors.skladniki} />
      </div>

      <div className={`admin-field${errors.czas ? " has-error" : ""}`}>
        <label htmlFor={`${prefix}-czas`}>Czas przygotowania (min.) <span className="field-req">*</span></label>
        <input
          id={`${prefix}-czas`}
          type="number"
          min="1"
          max="600"
          value={form.czas}
          onChange={(e) => setForm((prev) => ({ ...prev, czas: e.target.value }))}
          placeholder="1–600"
        />
        <FieldError error={errors.czas} />
      </div>

      <div className="admin-field">
        <label htmlFor={`${prefix}-kategoria`}>Kategoria</label>
        <select
          id={`${prefix}-kategoria`}
          value={form.kategoria}
          onChange={(e) => setForm((prev) => ({ ...prev, kategoria: normalizeRecipeCategory(e.target.value) }))}
        >
          {RECIPE_CATEGORY_OPTIONS.map((cat) => (
            <option key={`${prefix}-cat-${cat}`} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      <div className="admin-field">
        <label htmlFor={`${prefix}-meal_type`}>Typ posiłku</label>
        <select
          id={`${prefix}-meal_type`}
          value={form.meal_type}
          onChange={(e) => setForm((prev) => ({ ...prev, meal_type: e.target.value }))}
        >
          {MEAL_TYPE_OPTIONS.map((opt) => (
            <option key={`${prefix}-mt-${opt.value}`} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div className="admin-field">
        <label htmlFor={`${prefix}-diet`}>Dieta</label>
        <select
          id={`${prefix}-diet`}
          value={form.diet}
          onChange={(e) => setForm((prev) => ({ ...prev, diet: e.target.value }))}
        >
          {DIET_OPTIONS.map((opt) => (
            <option key={`${prefix}-diet-${opt.value}`} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div className="admin-field">
        <label htmlFor={`${prefix}-difficulty`}>Trudność</label>
        <select
          id={`${prefix}-difficulty`}
          value={form.difficulty}
          onChange={(e) => setForm((prev) => ({ ...prev, difficulty: e.target.value }))}
        >
          {DIFFICULTY_OPTIONS.map((opt) => (
            <option key={`${prefix}-diff-${opt.value}`} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div className={`admin-field${errors.servings ? " has-error" : ""}`}>
        <label htmlFor={`${prefix}-servings`}>Porcje</label>
        <input
          id={`${prefix}-servings`}
          type="number"
          min="1"
          max="100"
          value={form.servings}
          onChange={(e) => setForm((prev) => ({ ...prev, servings: e.target.value }))}
          placeholder="Liczba porcji"
        />
        <FieldError error={errors.servings} />
      </div>

      <div className="admin-field">
        <label htmlFor={`${prefix}-budget_level`}>Budżet</label>
        <select
          id={`${prefix}-budget_level`}
          value={form.budget_level}
          onChange={(e) => setForm((prev) => ({ ...prev, budget_level: e.target.value }))}
        >
          {BUDGET_LEVEL_OPTIONS.map((opt) => (
            <option key={`${prefix}-bl-${opt.value}`} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div className="admin-field">
        <label htmlFor={`${prefix}-status`}>Status</label>
        <select
          id={`${prefix}-status`}
          value={form.status}
          onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={`${prefix}-st-${opt.value}`} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div className="admin-field">
        <label htmlFor={`${prefix}-source`}>Źródło przepisu</label>
        <select
          id={`${prefix}-source`}
          value={form.source || "administrator"}
          onChange={(e) => setForm((prev) => ({ ...prev, source: e.target.value }))}
        >
          {SOURCE_OPTIONS.map((opt) => (
            <option key={`${prefix}-src-${opt.value}`} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        {form.source === "uzytkownik" ? (
          <p className="small-note">Ten przepis został dodany przez użytkownika i wymaga weryfikacji.</p>
        ) : null}
      </div>

      <AllergensEditor
        idPrefix={prefix}
        value={form.allergens}
        onChange={(val) => setForm((prev) => ({ ...prev, allergens: val }))}
        disabled={loading}
      />

      <InstructionStepsEditor
        idPrefix={`${prefix}-opis`}
        label="Opis krok po kroku"
        steps={steps}
        onAddStep={stepHandlers.onAddStep}
        onChangeStep={stepHandlers.onChangeStep}
        onRemoveStep={stepHandlers.onRemoveStep}
        onMoveStep={stepHandlers.onMoveStep}
        disabled={loading}
        error={errors.opis}
      />

      <TagsEditor
        idPrefix={`${prefix}-tags`}
        label="Tagi dla AI"
        tags={tagProps.tags}
        inputValue={tagProps.inputValue}
        onInputChange={tagProps.onInputChange}
        onInputKeyDown={tagProps.onInputKeyDown}
        onAddTag={tagProps.onAddTag}
        onRemoveTag={tagProps.onRemoveTag}
        suggestions={tagProps.suggestions}
        disabled={loading}
      />

      <div className={`admin-field${errors.link_filmu ? " has-error" : ""}`}>
        <label htmlFor={`${prefix}-link-filmu`}>Link do filmu</label>
        <input
          id={`${prefix}-link-filmu`}
          type="url"
          value={form.link_filmu}
          onChange={(e) => setForm((prev) => ({ ...prev, link_filmu: e.target.value }))}
          placeholder="https://..."
        />
        <FieldError error={errors.link_filmu} />
      </div>

      <div className={`admin-field${errors.link_strony ? " has-error" : ""}`}>
        <label htmlFor={`${prefix}-link-strony`}>Link do strony</label>
        <input
          id={`${prefix}-link-strony`}
          type="url"
          value={form.link_strony}
          onChange={(e) => setForm((prev) => ({ ...prev, link_strony: e.target.value }))}
          placeholder="https://..."
        />
        <FieldError error={errors.link_strony} />
      </div>
    </div>
  );

  return (
    <main className="admin-shell">
      <header className="admin-hero">
        <div>
          <p className="hero-kicker">Panel administracyjny</p>
          <h1>Zaplecze Kuchenne</h1>
          <p className="small-note">Rola: {adminRole === "admin" ? "Administrator" : adminRole === "editor" ? "Edytor" : "Podgląd"}</p>
        </div>
        <div className="admin-toolbar">
          <button type="button" className="btn ghost" onClick={exportRecipesJSON} disabled={loading} aria-label="Eksport JSON">
            Eksport JSON
          </button>
          <button type="button" className="btn ghost" onClick={exportRecipesCSV} disabled={loading} aria-label="Eksport CSV">
            Eksport CSV
          </button>
          <a href="/" className="btn ghost inline-link">
            Strona główna
          </a>
          <button type="button" className="btn" onClick={logout}>
            Wyloguj
          </button>
        </div>
      </header>

      <div className="admin-section-tabs" role="tablist">
        <button type="button" className={`admin-tab${adminSection === "recipes" ? " active" : ""}`} role="tab" aria-selected={adminSection === "recipes"} onClick={() => setAdminSection("recipes")}>
          Zaplecze kuchenne
        </button>
        <button type="button" className={`admin-tab${adminSection === "users" ? " active" : ""}`} role="tab" aria-selected={adminSection === "users"} onClick={() => setAdminSection("users")}>
          Użytkownicy
        </button>
      </div>

      <Toast flash={flash} onDismiss={clearFlash} />

      {deleteConfirm ? (
        <ConfirmModal
          title="Usuwanie przepisu"
          message={`Czy na pewno chcesz usunąć przepis „${deleteConfirm.nazwa}"? Tej operacji nie można cofnąć.`}
          confirmLabel="Usuń przepis"
          onConfirm={confirmDeleteRecipe}
          onCancel={cancelDelete}
          loading={deleteLoading}
        />
      ) : null}

      {adminSection === "recipes" ? (<>
      {adminRole !== ADMIN_ROLES.viewer ? (
        <section className="admin-panel">
          <h2>Dodaj nowy przepis</h2>
          <form onSubmit={saveNewRecipe}>
            {renderRecipeFormFields("add", addForm, setAddForm, addErrors, addInstructionSteps, {
              onAddStep: () => addInstructionStep("add"),
              onChangeStep: (i, v) => updateInstructionStep("add", i, v),
              onRemoveStep: (i) => removeInstructionStep("add", i),
              onMoveStep: (from, to) => moveInstructionStep("add", from, to),
            }, {
              tags: addTags,
              inputValue: addTagInput,
              onInputChange: setAddTagInput,
              onInputKeyDown: (e) => onTagInputKeyDown("add", e),
              onAddTag: () => addTagFromInput("add"),
              onRemoveTag: (tag) => removeTag("add", tag),
              suggestions: availableAddTagSuggestions,
            })}

            <div className="top-gap admin-form-actions">
              <button type="submit" className="btn ghost admin-save-btn" disabled={loading || !addFormValid}>
                {loading ? "Zapisywanie..." : "Zapisz przepis"}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="admin-panel">
        <h2>Lista dań <span className="admin-count-badge">{totalFiltered}/{recipes.length}</span></h2>

        <div className="admin-search-bar">
          <input
            type="search"
            className="admin-search-input"
            placeholder="Szukaj po nazwie, tagach, składnikach..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            aria-label="Wyszukaj przepisy"
          />
        </div>

        <div className="admin-filters-row">
          <select value={filterCategory} onChange={(e) => { setFilterCategory(e.target.value); setCurrentPage(1); }} aria-label="Filtruj po kategorii">
            <option value="">Wszystkie kategorie</option>
            {RECIPE_CATEGORY_OPTIONS.map((c) => <option key={`fc-${c}`} value={c}>{c}</option>)}
          </select>
          <select value={filterMealType} onChange={(e) => { setFilterMealType(e.target.value); setCurrentPage(1); }} aria-label="Filtruj po typie posiłku">
            <option value="">Wszystkie typy</option>
            {MEAL_TYPE_OPTIONS.filter((o) => o.value).map((o) => <option key={`fmt-${o.value}`} value={o.value}>{o.label}</option>)}
          </select>
          <select value={filterDiet} onChange={(e) => { setFilterDiet(e.target.value); setCurrentPage(1); }} aria-label="Filtruj po diecie">
            <option value="">Wszystkie diety</option>
            {DIET_OPTIONS.map((o) => <option key={`fd-${o.value}`} value={o.value}>{o.label}</option>)}
          </select>
          <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }} aria-label="Filtruj po statusie">
            <option value="">Wszystkie statusy</option>
            {STATUS_OPTIONS.map((o) => <option key={`fs-${o.value}`} value={o.value}>{o.label}</option>)}
          </select>
          <select value={filterDifficulty} onChange={(e) => { setFilterDifficulty(e.target.value); setCurrentPage(1); }} aria-label="Filtruj po trudności">
            <option value="">Dowolna trudność</option>
            {DIFFICULTY_OPTIONS.filter((o) => o.value).map((o) => <option key={`fdf-${o.value}`} value={o.value}>{o.label}</option>)}
          </select>
          <select value={filterSource} onChange={(e) => { setFilterSource(e.target.value); setCurrentPage(1); }} aria-label="Filtruj po źródle">
            <option value="">Wszystkie źródła</option>
            {SOURCE_OPTIONS.map((o) => <option key={`fsrc-${o.value}`} value={o.value}>{o.label}</option>)}
          </select>
          {hasActiveFilters ? (
            <button type="button" className="btn ghost" onClick={clearFilters}>Wyczyść filtry</button>
          ) : null}
        </div>

        {selectedIds.size > 0 && adminRole !== ADMIN_ROLES.viewer ? (
          <div className="admin-bulk-bar">
            <span className="small-note">Zaznaczono: {selectedIds.size}</span>
            <button type="button" className="btn ghost" onClick={() => bulkChangeStatus("opublikowany")} disabled={loading}>Publikuj</button>
            <button type="button" className="btn ghost" onClick={() => bulkChangeStatus("archiwalny")} disabled={loading}>Archiwizuj</button>
            {adminRole === ADMIN_ROLES.admin ? (
              <button type="button" className="btn danger-btn" onClick={bulkDelete} disabled={loading}>Usuń zaznaczone</button>
            ) : null}
          </div>
        ) : null}

        {sortedRecipes.length === 0 ? (
          <p className="small-note admin-empty-state">{hasActiveFilters ? "Brak przepisów pasujących do filtrów." : "Brak przepisów."}</p>
        ) : (
          <div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th className="th-check">
                      <input type="checkbox" checked={selectedIds.size === pagedRecipes.length && pagedRecipes.length > 0} onChange={toggleSelectAll} aria-label="Zaznacz wszystkie" />
                    </th>
                    <th className="th-sortable" onClick={() => toggleSort("id")} aria-label="Sortuj po ID">
                      ID {sortField === "id" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                    </th>
                    <th className="th-sortable" onClick={() => toggleSort("nazwa")} aria-label="Sortuj po nazwie">
                      Nazwa {sortField === "nazwa" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                    </th>
                    <th>Kategoria</th>
                    <th>Status</th>
                    <th className="th-sortable" onClick={() => toggleSort("czas")} aria-label="Sortuj po czasie">
                      Czas {sortField === "czas" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                    </th>
                    <th>Tagi</th>
                    <th>Źródło</th>
                    <th>Akcje</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedRecipes.map((recipe) => (
                    <Fragment key={recipe.id}>
                      <tr className={editingId === recipe.id ? "row-editing" : ""}>
                        <td>
                          <input type="checkbox" checked={selectedIds.has(recipe.id)} onChange={() => toggleSelectId(recipe.id)} aria-label={`Zaznacz ${recipe.nazwa}`} />
                        </td>
                        <td>{recipe.id}</td>
                        <td className="td-nazwa">{recipe.nazwa}</td>
                        <td>{normalizeRecipeCategory(recipe.kategoria)}</td>
                        <td>
                          <span className={`status-badge status-${recipe.status || "roboczy"}`}>
                            {(recipe.status || "roboczy").charAt(0).toUpperCase() + (recipe.status || "roboczy").slice(1)}
                          </span>
                        </td>
                        <td>{recipe.czas || "-"}</td>
                        <td className="td-tagi">{recipe.tagi || "-"}</td>
                        <td>
                          <span className={`source-badge source-${recipe.source || "administrator"}`}>
                            {(SOURCE_OPTIONS.find((o) => o.value === (recipe.source || "administrator"))?.label) || "Administrator"}
                          </span>
                        </td>
                        <td>
                          <div className="admin-action-group">
                            {adminRole !== ADMIN_ROLES.viewer ? (
                              <button
                                type="button"
                                className="admin-action-btn"
                                title="Edytuj"
                                aria-label={`Edytuj przepis ${recipe.nazwa}`}
                                onClick={() => startEditing(recipe)}
                                disabled={loading}
                              >
                                Edytuj
                              </button>
                            ) : null}
                            {adminRole !== ADMIN_ROLES.viewer ? (
                              <button
                                type="button"
                                className="admin-action-btn"
                                title="Duplikuj"
                                aria-label={`Duplikuj przepis ${recipe.nazwa}`}
                                onClick={() => duplicateRecipe(recipe)}
                                disabled={loading}
                              >
                                Duplikuj
                              </button>
                            ) : null}
                            {adminRole === ADMIN_ROLES.admin ? (
                              <button
                                type="button"
                                className="admin-action-btn danger-text"
                                title="Usuń"
                                aria-label={`Usuń przepis ${recipe.nazwa}`}
                                onClick={() => requestDeleteRecipe(recipe)}
                                disabled={loading}
                              >
                                Usuń
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>

                      {editingId === recipe.id ? (
                        <tr className="admin-edit-row">
                          <td colSpan={9}>
                            <form
                              className="admin-inline-form"
                              onSubmit={(event) => saveEditedRecipe(event, recipe.id)}
                            >
                              {renderRecipeFormFields(`edit-${recipe.id}`, editForm, setEditForm, editErrors, editInstructionSteps, {
                                onAddStep: () => addInstructionStep("edit"),
                                onChangeStep: (i, v) => updateInstructionStep("edit", i, v),
                                onRemoveStep: (i) => removeInstructionStep("edit", i),
                                onMoveStep: (from, to) => moveInstructionStep("edit", from, to),
                              }, {
                                tags: editTags,
                                inputValue: editTagInput,
                                onInputChange: setEditTagInput,
                                onInputKeyDown: (e) => onTagInputKeyDown("edit", e),
                                onAddTag: () => addTagFromInput("edit"),
                                onRemoveTag: (tag) => removeTag("edit", tag),
                                suggestions: availableEditTagSuggestions,
                              })}

                              <div className="admin-inline-actions">
                                <button type="submit" className="btn ghost admin-save-btn" disabled={loading || !editFormValid}>
                                  {loading ? "Zapisywanie..." : "Zapisz zmiany"}
                                </button>
                                <button type="button" className="btn" onClick={cancelEditing} disabled={loading}>
                                  Anuluj
                                </button>
                              </div>
                            </form>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="admin-pagination">
              <button
                type="button"
                className="admin-page-btn"
                onClick={goToPrevPage}
                disabled={loading || currentPage <= 1}
                aria-label="Poprzednia strona"
              >
                ←
              </button>
              <div className="admin-page-indicator">
                Strona <strong>{currentPage}</strong> z {totalPages}
                <span className="admin-page-total"> ({totalFiltered} {totalFiltered === 1 ? "przepis" : "przepisów"})</span>
              </div>
              <button
                type="button"
                className="admin-page-btn"
                onClick={goToNextPage}
                disabled={loading || currentPage >= totalPages}
                aria-label="Następna strona"
              >
                →
              </button>
            </div>
          </div>
        )}
      </section>
      </>) : null}

      {adminSection === "users" ? (
        <section className="admin-panel">
          <h2>Użytkownicy <span className="admin-count-badge">{users.length}</span></h2>
          <p className="small-note">Zarządzaj kontami użytkowników aplikacji.</p>

          {users.length === 0 ? (
            <p className="small-note admin-empty-state">Brak zarejestrowanych użytkowników.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Nazwa</th>
                    <th>E-mail</th>
                    <th>Data rejestracji</th>
                    <th>Status</th>
                    <th>Akcje</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td>{user.id}</td>
                      <td>{user.username}</td>
                      <td>{user.email}</td>
                      <td>{asString(user.registeredAt).slice(0, 10) || "-"}</td>
                      <td>
                        <span className={`status-badge status-${user.status === "aktywny" ? "opublikowany" : "archiwalny"}`}>
                          {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                        </span>
                      </td>
                      <td>
                        <div className="admin-action-group">
                          <button
                            type="button"
                            className="admin-action-btn"
                            onClick={async () => {
                              setLoading(true);
                              try {
                                const suspended = user.status !== "zawieszony";
                                await apiRequest(`/admin/users/${user.id}/suspend`, {
                                  method: "PUT",
                                  body: { suspended },
                                });
                                setFlashMessage(
                                  "success",
                                  suspended
                                    ? `Zawieszono użytkownika ${user.username}.`
                                    : `Przywrócono użytkownika ${user.username}.`,
                                );
                                await loadUsers();
                              } catch (error) {
                                setFlashMessage(
                                  "error",
                                  error instanceof Error ? error.message : "Nie udało się zmienić statusu użytkownika.",
                                );
                              } finally {
                                setLoading(false);
                              }
                            }}
                            disabled={loading}
                          >
                            {user.status === "zawieszony" ? "Przywróć" : "Zawieś"}
                          </button>
                          <button
                            type="button"
                            className="admin-action-btn"
                            onClick={async () => {
                              setLoading(true);
                              try {
                                const response = await apiRequest(`/admin/users/${user.id}/reset-password`, {
                                  method: "POST",
                                });
                                const nextPassword = asString(response?.generatedPassword).trim();
                                if (!nextPassword) {
                                  throw new Error("Nie udało się wygenerować nowego hasła.");
                                }
                                setGeneratedPassword(nextPassword);
                                setFlashMessage("success", `Nowe hasło dla ${user.username} zostało wygenerowane.`);
                              } catch (error) {
                                setFlashMessage(
                                  "error",
                                  error instanceof Error ? error.message : "Nie udało się zresetować hasła.",
                                );
                              } finally {
                                setLoading(false);
                              }
                            }}
                            disabled={loading}
                          >
                            Resetuj hasło
                          </button>
                          <button
                            type="button"
                            className="admin-action-btn danger-text"
                            onClick={async () => {
                              const confirmed = window.confirm(
                                `Czy na pewno chcesz usunąć użytkownika ${user.username}?`,
                              );
                              if (!confirmed) return;
                              setLoading(true);
                              try {
                                await apiRequest(`/admin/users/${user.id}`, { method: "DELETE" });
                                setFlashMessage("success", `Usunięto użytkownika ${user.username}.`);
                                await loadUsers();
                              } catch (error) {
                                setFlashMessage(
                                  "error",
                                  error instanceof Error ? error.message : "Nie udało się usunąć użytkownika.",
                                );
                              } finally {
                                setLoading(false);
                              }
                            }}
                            disabled={loading}
                          >
                            Usuń
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {generatedPassword ? (
            <div className="admin-generated-password">
              <p className="small-note">Wygenerowane hasło (jednorazowy podgląd):</p>
              <div className="password-display">
                <code>{generatedPassword}</code>
                <button type="button" className="btn ghost" onClick={() => { navigator.clipboard.writeText(generatedPassword); setFlashMessage("success", "Skopiowano hasło do schowka."); }}>
                  Kopiuj
                </button>
                <button type="button" className="btn ghost" onClick={() => setGeneratedPassword("")}>
                  Ukryj
                </button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}

/* ── Cookie Banner ──────────────────────────────── */

function CookieBanner() {
  const [visible, setVisible] = useState(() => {
    try {
      return !localStorage.getItem("cookie-consent");
    } catch {
      return true;
    }
  });

  const handleConsent = (value) => {
    try {
      localStorage.setItem("cookie-consent", value);
    } catch {
      // localStorage niedostępne
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="cookie-banner" role="dialog" aria-label="Informacja o cookies">
      <div className="cookie-banner-inner">
        <p>
          Ta strona używa wyłącznie plików cookies niezbędnych do prawidłowego działania serwisu
          (sesja, preferencje). Nie stosujemy cookies analitycznych ani marketingowych.
        </p>
        <div className="cookie-actions">
          <button
            type="button"
            className="btn ghost cookie-accept"
            onClick={() => handleConsent("accepted")}
          >
            Rozumiem, akceptuję
          </button>
          <button
            type="button"
            className="btn cookie-decline"
            onClick={() => handleConsent("declined")}
          >
            Odrzucam opcjonalne
          </button>
          <a href="/legal/cookies" className="cookie-more-link">
            Polityka cookies
          </a>
        </div>
      </div>
    </div>
  );
}

/* ── Footer ─────────────────────────────────────── */

function AppFooter() {
  return (
    <footer className="app-footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <span className="footer-logo">{COMPANY_PROFILE.brandName}</span>
          <span className="footer-copy">
            &copy; {new Date().getFullYear()} {COMPANY_PROFILE.operatorName}
          </span>
          <span className="footer-note">{COMPANY_PROFILE.operatorNote}</span>
        </div>
        <div className="footer-links-grid" aria-label="Linki w stopce">
          {FOOTER_LINK_GROUPS.map((group, groupIndex) => (
            <Fragment key={group.label}>
              {groupIndex > 0 ? <div className="footer-separator" aria-hidden="true" /> : null}
              <nav className="footer-links-group" aria-label={group.label}>
                <span className="footer-links-label">{group.label}</span>
                <div className="footer-links">
                  {group.links.map((link) => (
                    <a key={link.href} href={link.href}>
                      {link.label}
                    </a>
                  ))}
                </div>
              </nav>
            </Fragment>
          ))}
        </div>
      </div>
    </footer>
  );
}

/* ── Legal Pages ────────────────────────────────── */

function ContentSection({ section, index }) {
  return (
    <section key={`content-section-${index}`} className="legal-section" id={section.id}>
      <h2>{section.heading}</h2>
      {section.text ? <div className="legal-text">{section.text}</div> : null}
      {Array.isArray(section.list) && section.list.length > 0 ? (
        <ul className="content-bullets">
          {section.list.map((item) => (
            <li key={`${section.heading}-${item}`}>{item}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function StaticPageLayout({ title, intro, sections, variant = "info" }) {
  return (
    <main className="legal-shell">
      <nav className="legal-nav">
        <a href="/" className="btn ghost inline-link legal-back">
          ← Wróć do aplikacji
        </a>
      </nav>
      <article className={`legal-card static-page static-page-${variant}`}>
        <p className="content-kicker">{COMPANY_PROFILE.brandName}</p>
        <h1>{title}</h1>
        {intro ? <p className="content-intro">{intro}</p> : null}
        {sections.map((section, index) => (
          <ContentSection key={`content-section-${index}`} section={section} index={index} />
        ))}
      </article>
      <AppFooter />
      <CookieBanner />
    </main>
  );
}

function LegalPage({ type }) {
  const content = LEGAL_PAGE_CONTENT[type] || LEGAL_PAGE_CONTENT.terms;
  return (
    <StaticPageLayout
      title={content.title}
      intro={content.intro}
      sections={content.sections}
      variant="legal"
    />
  );
}

function InfoPage({ type }) {
  const content = INFO_PAGE_CONTENT[type] || INFO_PAGE_CONTENT.about;
  return (
    <StaticPageLayout
      title={content.title}
      intro={content.intro}
      sections={content.sections}
      variant="info"
    />
  );
}

/* ── App Root ───────────────────────────────────── */

function App() {
  const path = routePath();
  if (path === "/zaloguj") return <AdminPanelPage />;
  if (path === "/legal/terms") return <LegalPage type="terms" />;
  if (path === "/legal/privacy") return <LegalPage type="privacy" />;
  if (path === "/legal/cookies") return <LegalPage type="cookies" />;
  if (path === "/contact") return <InfoPage type="contact" />;
  if (path === "/faq") return <InfoPage type="faq" />;
  if (path === "/jak-to-dziala" || path === "/how-it-works") return <InfoPage type="how" />;
  if (path === "/o-projekcie" || path === "/about") return <InfoPage type="about" />;
  return (
    <>
      <UserChatPage />
      <AppFooter />
      <CookieBanner />
    </>
  );
}

export default App;

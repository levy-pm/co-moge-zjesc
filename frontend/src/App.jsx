import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import "./index.css";
import { useEffectEvent } from "react";

const API_BASE = "/backend";
const ADMIN_PAGE_SIZE = 10;
const DEFAULT_RECIPE_CATEGORY = "Posilek";
const RECIPE_CATEGORY_OPTIONS = ["Posilek", "Deser"];
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
      "Mam kurczaka, ryż i brokuła. Co z tego zrobić?",
      "Szukam czegoś szybkiego do 20 minut.",
      "Chcę coś lekkiego i wysokobiałkowego.",
      "Mam ochotę na zupę krem.",
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
      "Mam twaróg i wanilię. Co słodkiego mogę z tego zrobić?",
      "Szukam szybkiego deseru do 20 minut.",
      "Mam ochotę na coś czekoladowego.",
      "Chcę lekki deser z owocami sezonowymi.",
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

function ChatFiltersBar({ filters, onChange, onReset, disabled }) {
  const pills = activeFilterPills(filters);

  return (
    <section className="filters-wrap" aria-label="Filtry rekomendacji">
      <div className="filters-head">
        <h3>Filtry</h3>
        <div className="filters-actions">
          {pills.length > 0 ? <span className="filters-count">{pills.length} aktywne</span> : null}
          <button type="button" className="btn reset-btn" onClick={onReset} disabled={disabled}>
            Wyczyść filtry
          </button>
        </div>
      </div>

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
    </section>
  );
}

function LandingTrustSections() {
  return (
    <section className="landing-content" aria-label="Informacje o aplikacji">
      <article className="landing-block">
        <h2>Jak to działa</h2>
        <ol>
          <li>Wybierz tryb: sycący posiłek albo coś słodkiego.</li>
          <li>Wpisz składniki, dodaj zdjęcie lub ustaw filtry.</li>
          <li>Otrzymasz 2 propozycje i od razu przejdziesz do szczegółów przepisu.</li>
        </ol>
      </article>

      <article className="landing-block">
        <h2>Dla kogo jest aplikacja</h2>
        <ul>
          <li>Dla osób, które gotują z tego, co mają w lodówce.</li>
          <li>Dla zabieganych, którzy chcą szybki przepis w kilka minut.</li>
          <li>Dla użytkowników z dietą i ograniczeniami żywieniowymi.</li>
        </ul>
      </article>

      <article className="landing-block">
        <h2>FAQ</h2>
        <div className="faq-grid">
          <div>
            <h3>Czy mogę wpisać składniki z lodówki?</h3>
            <p>Tak. To najprostszy sposób, żeby dostać trafniejsze propozycje.</p>
          </div>
          <div>
            <h3>Czy mogę dodać zdjęcie?</h3>
            <p>Tak. Zdjęcie składników jest analizowane przez AI i zamieniane na prompt.</p>
          </div>
          <div>
            <h3>Czy uwzględniacie dietę i alergie?</h3>
            <p>Tak. Działają filtry i dodatkowe ograniczenia wpisane ręcznie w wiadomości.</p>
          </div>
          <div>
            <h3>Czy przepisy są generowane przez AI?</h3>
            <p>Tak. Dlatego zawsze warto zweryfikować skład i kroki przed gotowaniem.</p>
          </div>
          <div>
            <h3>Czy mogę dostać szybkie dania lub desery?</h3>
            <p>Tak. Ustaw filtr czasu i wpisz dodatkowo preferowany limit minut.</p>
          </div>
        </div>
      </article>

      <article className="landing-block ai-note">
        <h2>AI i ograniczenia rekomendacji</h2>
        <p>
          Rekomendacje są tworzone automatycznie przez AI. Aplikacja pomaga zawęzić wybór, ale nie
          zastępuje porady dietetycznej ani medycznej. Przy alergiach zawsze sprawdź składniki i
          technikę przygotowania.
        </p>
      </article>
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
  disabled,
}) {
  return (
    <div className="admin-field full">
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

      <div className="admin-steps-wrap">
        {steps.map((step, index) => {
          const stepId = `${idPrefix}-step-${index + 1}`;
          return (
            <div key={stepId} className="admin-step-item">
              <div className="admin-step-head">
                <label htmlFor={stepId} className="admin-step-title">
                  Krok {index + 1}
                </label>
                <button
                  type="button"
                  className="admin-step-remove-btn"
                  onClick={() => onRemoveStep(index)}
                  disabled={disabled}
                  aria-label={`Usuń krok ${index + 1}`}
                >
                  Usuń
                </button>
              </div>
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
  const [flash, setFlash] = useState("");
  const [optionsRound, setOptionsRound] = useState(0);

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

  const resetConversation = () => {
    requestTokenRef.current += 1;
    setPrompt("");
    setMessages([]);
    setPendingOptions([]);
    setSelectedRecipe(null);
    setSelectedOption(null);
    setExcludedRecipeIds([]);
    setOptionsRound(0);
    setFlash("");
    setLoading(false);
    setChoosingRecipe(false);
    setChoosingIndex(-1);
    if (cameraInputRef.current) {
      cameraInputRef.current.value = "";
    }
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

  const sendPrompt = async (rawPrompt) => {
    const trimmed = rawPrompt.trim();
    if (!trimmed || loading) return;
    const filtersForRequest = normalizeChatFiltersForRequest(chatFilters);
    if (trimmed.length > CHAT_PROMPT_MAX_CHARS) {
      setFlash(`Wiadomość jest zbyt długa. Maksymalnie ${CHAT_PROMPT_MAX_CHARS} znaków.`);
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

    setFlash("");
    setPrompt("");
    setLoading(true);
    setSelectedOption(null);
    setSelectedRecipe(null);
    setPendingOptions([]);
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
      const message = error instanceof Error ? error.message : "Błąd połączenia z serwerem.";
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Szef kuchni upuścił talerz: ${message}`,
        },
      ]);
      setPendingOptions([]);
      setFlash(message);
    } finally {
      if (requestToken === requestTokenRef.current) {
        setLoading(false);
      }
    }
  };

  const submitPrompt = (event) => {
    event.preventDefault();
    void sendPrompt(prompt);
  };

  const handlePromptKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendPrompt(prompt);
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

  const sendPhoto = async (file) => {
    if (!file || loading) return;
    const filtersForRequest = normalizeChatFiltersForRequest(chatFilters);

    const photoCaption =
      activeCategory === "Deser"
        ? "Wysłałem zdjęcie składników do deseru."
        : "Wysłałem zdjęcie produktów do analizy.";

    let imageDataUrl = "";
    try {
      imageDataUrl = await optimizeChatImage(file);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Nie udało się przygotować zdjęcia.";
      setFlash(message);
      return;
    }

    const userMessage = {
      role: "user",
      content: photoCaption,
      imageUrl: imageDataUrl,
      imageAlt: "Zdjęcie produktów przesłane do czatu",
    };
    const nextHistory = [...messages, { role: "user", content: photoCaption }].slice(-6);
    const requestToken = requestTokenRef.current + 1;
    requestTokenRef.current = requestToken;

    setFlash("");
    setPrompt("");
    setLoading(true);
    setSelectedOption(null);
    setSelectedRecipe(null);
    setPendingOptions([]);
    setExcludedRecipeIds([]);
    setMessages((prev) => [...prev, userMessage]);

    try {
      const response = await apiRequest("/chat/photo", {
        method: "POST",
        body: {
          imageDataUrl,
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

      const needsClarification = Boolean(response?.needsClarification);
      const clarificationQuestion = asString(response?.clarificationQuestion).trim();
      const constraintNote = asString(response?.constraintNote).trim();
      const assistantText = sanitizeAssistantMessageForDisplay(
        needsClarification ? clarificationQuestion || response?.assistantText : response?.assistantText,
        resolvedCategory,
        photoCaption,
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
      const message = error instanceof Error ? error.message : "Błąd połączenia z serwerem.";
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Szef kuchni upuścił talerz: ${message}`,
        },
      ]);
      setPendingOptions([]);
      setFlash(message);
    } finally {
      if (requestToken === requestTokenRef.current) {
        setLoading(false);
      }
    }
  };

  const handleCameraInputChange = (event) => {
    const file = event.target.files?.[0] || null;
    event.target.value = "";
    if (!file) return;
    void sendPhoto(file);
  };

  const openSelectedOption = async (option, chosenIndex) => {
    if (choosingRecipe || loading) return;

    setChoosingRecipe(true);
    setChoosingIndex(chosenIndex);
    setSelectedOption(option);
    setFlash("");

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
            setPendingOptions([]);
            setSelectedRecipe(recipeFromApiRecipe(response.recipe));
            return;
          }
        } catch {
          // Fallback poniżej
        }
      }

      setPendingOptions([]);
      setSelectedRecipe(recipeFromOption(option || {}));
    } catch {
      setFlash("Nie udało się otworzyć przepisu. Spróbuj ponownie.");
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
    setPendingOptions([]);
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content:
          activeCategory === "Deser"
            ? "Jasne! Szukamy dalej. Na jaki deser masz teraz największą ochotę?"
            : "Jasne! Szukamy dalej. Na co masz ochotę?",
      },
    ]);
  };

  const hasMessages = messages.length > 0;
  const selectedSource = selectedRecipe?.source === "baza" ? "Przepis z bazy" : "Propozycja";
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

  return (
    <main
      className={`user-shell ${
        activeCategory === "Deser" ? "mode-deser" : "mode-posilek"
      }`}
    >
      <div className="ambient ambient-a" />
      <div className="ambient ambient-b" />

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

            {flash ? <div className="alert error">{flash}</div> : null}

            <section className="recipe-stage">
              <div className="recipe-stage-head">
                <div>
                  <p className="recipe-source">{selectedSource}</p>
                  <h2>{selectedRecipe.title || "Danie"}</h2>
                  <p className="recipe-description">{selectedRecipe.shortDescription}</p>
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
                <button type="button" className="btn recipe-back-btn" onClick={backToSearch}>
                  Wróć do szukania
                </button>
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
                      <ul className="recipe-list compact">
                        {shoppingList.map((item, index) => (
                          <li key={`shopping-${index}`}>{item}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>Lista zakupów będzie dostępna w kolejnym etapie.</p>
                    )}
                    <button type="button" className="btn ghost recipe-future-btn" disabled>
                      Zapisz do ulubionych (wkrótce)
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

              {flash ? <div className="alert error">{flash}</div> : null}

              {messages.map((message, index) => (
                <ChatBubble key={`${message.role}-${index}`} role={message.role} content={message.content} imageUrl={message.imageUrl} imageAlt={message.imageAlt} />
              ))}

              {loading ? <TypingBubble /> : null}

              {!hasMessages ? (
                <div className="empty-state">
                  <h3>{modeConfig.emptyTitle}</h3>
                  <p>{modeConfig.emptyDescription}</p>
                  <StarterPrompts
                    loading={loading}
                    prompts={modeConfig.starterPrompts}
                    onPick={sendPrompt}
                  />
                  <LandingTrustSections />
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
            <ChatFiltersBar
              filters={safeFilters}
              onChange={updateFilter}
              onReset={clearFilters}
              disabled={loading || choosingRecipe}
            />
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
                    aria-label="Dodaj zdjęcie składników"
                    title="Dodaj zdjęcie składników"
                    onClick={openCameraCapture}
                    disabled={loading}
                  >
                    <svg className="camera-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                  </button>
                  <span className="camera-hint">
                    Zdjęcie składników
                  </span>
                </div>
                <button
                  type="submit"
                  className="btn send"
                  disabled={loading}
                  aria-label="Wyślij wiadomość"
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
              Dodaj zdjęcie produktów lub zawartości lodówki — AI rozpozna składniki i zaproponuje przepis. Akceptowane formaty: JPG, PNG, WEBP, HEIC.
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
  };
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

  const editingRecipe = useMemo(
    () => recipes.find((item) => item.id === editingId) || null,
    [recipes, editingId],
  );

  const pagedRecipes = useMemo(() => {
    const offset = (currentPage - 1) * ADMIN_PAGE_SIZE;
    return recipes.slice(offset, offset + ADMIN_PAGE_SIZE);
  }, [recipes, currentPage]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(recipes.length / ADMIN_PAGE_SIZE)),
    [recipes.length],
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

  const setFlashMessage = (level, message) => {
    setFlash({ level, message });
  };

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
    };
  };

  const loadRecipes = async () => {
    const response = await apiRequest("/recipes");
    const rows = Array.isArray(response?.recipes) ? response.recipes : [];
    const normalizedRows = rows.map((recipe) => ({
      ...recipe,
      kategoria: normalizeRecipeCategory(recipe?.kategoria),
      tagi: tagsToString(parseTags(recipe?.tagi)),
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

  const checkAuth = useEffectEvent(async () => {
    try {
      const response = await apiRequest("/admin/me");
      setLoggedIn(Boolean(response?.loggedIn));
      setAdminEnabled(response?.adminEnabled !== false);
      if (response?.loggedIn) {
        await loadRecipes();
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
    });
    setEditInstructionSteps(adminInstructionStepsFromText(editingRecipe.opis || ""));
    setEditTagInput("");
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
      await loadRecipes();
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

    if (!addForm.nazwa.trim() || !addForm.skladniki.trim()) {
      setFlashMessage("warning", "Nazwa i składniki są wymagane.");
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
      setFlashMessage(
        "success",
        `Dodano: ${response?.recipe?.nazwa || "przepis"} (ID: ${response?.recipe?.id ?? "-"})`,
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

    if (!editForm.nazwa.trim() || !editForm.skladniki.trim()) {
      setFlashMessage("warning", "Nazwa i składniki są wymagane.");
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
      setFlashMessage("success", "Zapisano zmiany.");
      setEditTagInput("");
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

  const deleteRecipe = async (recipeId) => {
    if (!recipeId) return;
    setLoading(true);
    try {
      await apiRequest(`/recipes/${recipeId}`, { method: "DELETE" });
      setFlashMessage("success", "Usunięto przepis.");
      if (editingId === recipeId) {
        setEditingId(null);
        setEditForm(emptyRecipeForm());
        setEditInstructionSteps([]);
        setEditTagInput("");
      }
      await loadRecipes();
    } catch (error) {
      setFlashMessage(
        "error",
        error instanceof Error ? error.message : "Błąd usuwania przepisu.",
      );
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (recipe) => {
    if (editingId === recipe.id) {
      setEditingId(null);
      setEditForm(emptyRecipeForm());
      setEditInstructionSteps([]);
      setEditTagInput("");
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
    });
    setEditInstructionSteps(adminInstructionStepsFromText(recipe.opis || ""));
    setEditTagInput("");
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

  return (
    <main className="admin-shell">
      <header className="admin-hero">
        <div>
          <p className="hero-kicker">Panel administracyjny</p>
          <h1>Zaplecze Kuchenne</h1>
        </div>
        <div className="admin-toolbar">
          <a href="/" className="btn ghost inline-link">
            Strona główna
          </a>
          <button type="button" className="btn" onClick={logout}>
            Wyloguj
          </button>
        </div>
      </header>

      {flash.message ? <div className={`alert ${flash.level}`}>{flash.message}</div> : null}

      <section className="admin-panel">
        <h2>Dodaj nowy przepis</h2>
        <form onSubmit={saveNewRecipe}>
          <div className="admin-grid">
            <div className="admin-field">
              <label htmlFor="add-nazwa">Nazwa dania</label>
              <input
                id="add-nazwa"
                type="text"
                value={addForm.nazwa}
                onChange={(event) =>
                  setAddForm((prev) => ({ ...prev, nazwa: event.target.value }))
                }
              />
            </div>

            <div className="admin-field">
              <label htmlFor="add-skladniki">Lista składników</label>
              <textarea
                id="add-skladniki"
                value={addForm.skladniki}
                onChange={(event) =>
                  setAddForm((prev) => ({ ...prev, skladniki: event.target.value }))
                }
              />
            </div>

            <div className="admin-field">
              <label htmlFor="add-czas">Czas przygotowania (min.)</label>
              <input
                id="add-czas"
                type="text"
                value={addForm.czas}
                onChange={(event) =>
                  setAddForm((prev) => ({ ...prev, czas: event.target.value }))
                }
              />
            </div>

            <div className="admin-field">
              <label htmlFor="add-kategoria">Kategoria przepisu</label>
              <select
                id="add-kategoria"
                value={addForm.kategoria}
                onChange={(event) =>
                  setAddForm((prev) => ({
                    ...prev,
                    kategoria: normalizeRecipeCategory(event.target.value),
                  }))
                }
              >
                {RECIPE_CATEGORY_OPTIONS.map((category) => (
                  <option key={`add-category-${category}`} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <InstructionStepsEditor
              idPrefix="add-opis"
              label="Opis krok po kroku"
              steps={addInstructionSteps}
              onAddStep={() => addInstructionStep("add")}
              onChangeStep={(stepIndex, value) =>
                updateInstructionStep("add", stepIndex, value)
              }
              onRemoveStep={(stepIndex) => removeInstructionStep("add", stepIndex)}
              disabled={loading}
            />

            <TagsEditor
              idPrefix="add-tags"
              label="Tagi dla AI"
              tags={addTags}
              inputValue={addTagInput}
              onInputChange={setAddTagInput}
              onInputKeyDown={(event) => onTagInputKeyDown("add", event)}
              onAddTag={() => addTagFromInput("add")}
              onRemoveTag={(tag) => removeTag("add", tag)}
              suggestions={availableAddTagSuggestions}
              disabled={loading}
            />

            <div className="admin-field">
              <label htmlFor="add-link-filmu">Link do filmu</label>
              <input
                id="add-link-filmu"
                type="text"
                value={addForm.link_filmu}
                onChange={(event) =>
                  setAddForm((prev) => ({ ...prev, link_filmu: event.target.value }))
                }
              />
            </div>

            <div className="admin-field">
              <label htmlFor="add-link-strony">Link do strony</label>
              <input
                id="add-link-strony"
                type="text"
                value={addForm.link_strony}
                onChange={(event) =>
                  setAddForm((prev) => ({ ...prev, link_strony: event.target.value }))
                }
              />
            </div>
          </div>

          <div className="top-gap">
            <button type="submit" className="btn send" disabled={loading}>
              {loading ? "Zapisywanie..." : "Zapisz przepis"}
            </button>
          </div>
        </form>
      </section>

      <section className="admin-panel">
        <h2>Lista dań</h2>
        {recipes.length === 0 ? (
          <p className="small-note">Brak przepisów.</p>
        ) : (
          <div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Nazwa</th>
                    <th>Kategoria</th>
                    <th>Tagi</th>
                    <th>Edytuj</th>
                    <th>Usuń</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedRecipes.map((recipe) => (
                    <Fragment key={recipe.id}>
                      <tr>
                        <td>{recipe.id}</td>
                        <td>{recipe.nazwa}</td>
                        <td>{normalizeRecipeCategory(recipe.kategoria)}</td>
                        <td>{recipe.tagi || "-"}</td>
                        <td>
                          <button
                            type="button"
                            className="admin-icon-btn"
                            title="Edytuj"
                            aria-label={`Edytuj przepis ${recipe.nazwa}`}
                            onClick={() => startEditing(recipe)}
                            disabled={loading}
                          >
                            📝
                          </button>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="admin-icon-btn danger"
                            title="Usuń"
                            aria-label={`Usuń przepis ${recipe.nazwa}`}
                            onClick={() => deleteRecipe(recipe.id)}
                            disabled={loading}
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>

                      {editingId === recipe.id ? (
                        <tr className="admin-edit-row">
                          <td colSpan={6}>
                            <form
                              className="admin-inline-form"
                              onSubmit={(event) => saveEditedRecipe(event, recipe.id)}
                            >
                              <div className="admin-grid">
                                <div className="admin-field">
                                  <label htmlFor={`edit-nazwa-${recipe.id}`}>Nazwa dania</label>
                                  <input
                                    id={`edit-nazwa-${recipe.id}`}
                                    type="text"
                                    value={editForm.nazwa}
                                    onChange={(event) =>
                                      setEditForm((prev) => ({ ...prev, nazwa: event.target.value }))
                                    }
                                  />
                                </div>

                                <div className="admin-field">
                                  <label htmlFor={`edit-skladniki-${recipe.id}`}>
                                    Lista składników
                                  </label>
                                  <textarea
                                    id={`edit-skladniki-${recipe.id}`}
                                    value={editForm.skladniki}
                                    onChange={(event) =>
                                      setEditForm((prev) => ({
                                        ...prev,
                                        skladniki: event.target.value,
                                      }))
                                    }
                                  />
                                </div>

                                <div className="admin-field">
                                  <label htmlFor={`edit-czas-${recipe.id}`}>Czas przygotowania (min.)</label>
                                  <input
                                    id={`edit-czas-${recipe.id}`}
                                    type="text"
                                    value={editForm.czas}
                                    onChange={(event) =>
                                      setEditForm((prev) => ({ ...prev, czas: event.target.value }))
                                    }
                                  />
                                </div>

                                <div className="admin-field">
                                  <label htmlFor={`edit-kategoria-${recipe.id}`}>Kategoria przepisu</label>
                                  <select
                                    id={`edit-kategoria-${recipe.id}`}
                                    value={editForm.kategoria}
                                    onChange={(event) =>
                                      setEditForm((prev) => ({
                                        ...prev,
                                        kategoria: normalizeRecipeCategory(event.target.value),
                                      }))
                                    }
                                  >
                                    {RECIPE_CATEGORY_OPTIONS.map((category) => (
                                      <option key={`edit-category-${recipe.id}-${category}`} value={category}>
                                        {category}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                <InstructionStepsEditor
                                  idPrefix={`edit-opis-${recipe.id}`}
                                  label="Opis krok po kroku"
                                  steps={editInstructionSteps}
                                  onAddStep={() => addInstructionStep("edit")}
                                  onChangeStep={(stepIndex, value) =>
                                    updateInstructionStep("edit", stepIndex, value)
                                  }
                                  onRemoveStep={(stepIndex) =>
                                    removeInstructionStep("edit", stepIndex)
                                  }
                                  disabled={loading}
                                />

                                <TagsEditor
                                  idPrefix={`edit-tags-${recipe.id}`}
                                  label="Tagi"
                                  tags={editTags}
                                  inputValue={editTagInput}
                                  onInputChange={setEditTagInput}
                                  onInputKeyDown={(event) => onTagInputKeyDown("edit", event)}
                                  onAddTag={() => addTagFromInput("edit")}
                                  onRemoveTag={(tag) => removeTag("edit", tag)}
                                  suggestions={availableEditTagSuggestions}
                                  disabled={loading}
                                />

                                <div className="admin-field">
                                  <label htmlFor={`edit-link-filmu-${recipe.id}`}>Link do filmu</label>
                                  <input
                                    id={`edit-link-filmu-${recipe.id}`}
                                    type="text"
                                    value={editForm.link_filmu}
                                    onChange={(event) =>
                                      setEditForm((prev) => ({
                                        ...prev,
                                        link_filmu: event.target.value,
                                      }))
                                    }
                                  />
                                </div>

                                <div className="admin-field">
                                  <label htmlFor={`edit-link-strony-${recipe.id}`}>Link do strony</label>
                                  <input
                                    id={`edit-link-strony-${recipe.id}`}
                                    type="text"
                                    value={editForm.link_strony}
                                    onChange={(event) =>
                                      setEditForm((prev) => ({
                                        ...prev,
                                        link_strony: event.target.value,
                                      }))
                                    }
                                  />
                                </div>
                              </div>

                              <div className="admin-inline-actions">
                                <button type="submit" className="btn send" disabled={loading}>
                                  {loading ? "Zapisywanie..." : "Zapisz"}
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
                <strong>{currentPage}</strong>/{totalPages}
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
          <span className="footer-logo">Co mogę zjeść?</span>
          <span className="footer-copy">&copy; {new Date().getFullYear()} [NAZWA FIRMY]. Wszelkie prawa zastrzeżone.</span>
        </div>
        <nav className="footer-links" aria-label="Linki prawne">
          <a href="/legal/terms">Regulamin</a>
          <a href="/legal/privacy">Polityka prywatności</a>
          <a href="/legal/cookies">Polityka cookies</a>
          <a href="/contact">Kontakt</a>
          <a href="/contact#o-projekcie">O projekcie</a>
        </nav>
      </div>
    </footer>
  );
}

/* ── Legal Pages ────────────────────────────────── */

const LEGAL_CONTENT = {
  terms: {
    title: "Regulamin serwisu \u201ECo mogę zjeść?\u201D",
    sections: [
      {
        heading: "§1 Postanowienia ogólne",
        text: `1. Niniejszy regulamin określa zasady korzystania z serwisu internetowego „Co mogę zjeść?" (dalej: „Serwis"), dostępnego pod adresem [ADRES STRONY].
2. Właścicielem i administratorem Serwisu jest [NAZWA FIRMY], z siedzibą pod adresem [ADRES], NIP: [NIP], e-mail: [EMAIL].
3. Korzystanie z Serwisu oznacza akceptację niniejszego regulaminu.`,
      },
      {
        heading: "§2 Opis usługi",
        text: `1. Serwis umożliwia użytkownikom uzyskanie propozycji kulinarnych generowanych z wykorzystaniem sztucznej inteligencji (AI).
2. Użytkownik podaje składniki, preferencje lub zdjęcie produktów, a Serwis proponuje przepisy na ich podstawie.
3. Propozycje dań mają charakter informacyjny i inspiracyjny — nie stanowią porady dietetycznej ani medycznej.`,
      },
      {
        heading: "§3 Korzystanie z AI",
        text: `1. Propozycje przepisów są generowane automatycznie przez modele AI na podstawie danych podanych przez użytkownika oraz bazy przepisów.
2. Właściciel Serwisu nie gwarantuje poprawności, kompletności ani bezpieczeństwa wygenerowanych przepisów.
3. Użytkownik powinien samodzielnie ocenić przydatność propozycji, w szczególności pod kątem alergii, nietolerancji pokarmowych i bezpieczeństwa żywności.
4. Serwis nie zastępuje profesjonalnej porady dietetyka, lekarza ani innego specjalisty.`,
      },
      {
        heading: "§4 Przesyłanie zdjęć",
        text: `1. Użytkownik może przesłać zdjęcie produktów w celu ich automatycznego rozpoznania przez AI.
2. Przesłane zdjęcia są przetwarzane wyłącznie w celu analizy składników i nie są trwale przechowywane na serwerze po zakończeniu sesji.
3. Użytkownik ponosi odpowiedzialność za treść przesyłanych materiałów.
4. Zabrania się przesyłania treści niezgodnych z prawem lub naruszających prawa osób trzecich.`,
      },
      {
        heading: "§5 Ograniczenie odpowiedzialności",
        text: `1. Właściciel Serwisu nie ponosi odpowiedzialności za skutki zastosowania wygenerowanych przepisów, w szczególności za reakcje alergiczne, zatrucia pokarmowe lub inne szkody zdrowotne.
2. Serwis jest udostępniany w stanie „tak jak jest" (as-is), bez gwarancji dostępności i nieprzerwanego działania.
3. Właściciel nie odpowiada za przerwy w działaniu Serwisu spowodowane czynnikami zewnętrznymi.`,
      },
      {
        heading: "§6 Postanowienia końcowe",
        text: `1. Regulamin wchodzi w życie z dniem [DATA AKTUALIZACJI].
2. Właściciel zastrzega sobie prawo do zmiany regulaminu. Zmiany obowiązują od momentu ich opublikowania w Serwisie.
3. W sprawach nieuregulowanych regulaminem zastosowanie mają przepisy prawa polskiego.`,
      },
    ],
  },
  privacy: {
    title: "Polityka prywatności",
    sections: [
      {
        heading: "1. Administrator danych",
        text: `Administratorem danych osobowych jest [NAZWA FIRMY], z siedzibą pod adresem [ADRES], NIP: [NIP]. Kontakt w sprawach dotyczących danych osobowych: [EMAIL].`,
      },
      {
        heading: "2. Zakres zbieranych danych",
        text: `Serwis przetwarza następujące dane:
• Anonimowy identyfikator sesji (cookie sesyjne)
• Adres IP (w formie skróconej / zahashowanej — do celów bezpieczeństwa i limitowania zapytań)
• Treść zapytań tekstowych wprowadzonych do czatu
• Zdjęcia przesłane do analizy składników (przetwarzane tymczasowo, nie przechowywane trwale)
• Informacje o wyborach użytkownika (zaakceptowane / odrzucone propozycje — bez danych osobowych)`,
      },
      {
        heading: "3. Cel przetwarzania",
        text: `Dane przetwarzane są w celu:
• Świadczenia usługi generowania propozycji kulinarnych
• Analizy zdjęć produktów przy użyciu modeli AI
• Zapewnienia bezpieczeństwa Serwisu (ochrona przed nadużyciami)
• Poprawy jakości usługi`,
      },
      {
        heading: "4. Przetwarzanie danych przez AI",
        text: `1. Treść zapytań i zdjęcia mogą być przekazywane do zewnętrznych dostawców usług AI (np. Groq, Google Gemini) wyłącznie w celu generowania odpowiedzi.
2. Dane nie są wykorzystywane do trenowania modeli AI.
3. Dostawcy AI przetwarzają dane zgodnie ze swoimi politykami prywatności.`,
      },
      {
        heading: "5. Okres przechowywania",
        text: `• Dane sesyjne: usuwane po zakończeniu sesji lub po 24 godzinach nieaktywności
• Zdjęcia: przetwarzane w czasie rzeczywistym, nie przechowywane trwale
• Logi serwera: przechowywane do 30 dni w celach bezpieczeństwa`,
      },
      {
        heading: "6. Prawa użytkownika",
        text: `Użytkownikowi przysługuje prawo do:
• Dostępu do swoich danych
• Sprostowania danych
• Usunięcia danych
• Ograniczenia przetwarzania
• Wniesienia sprzeciwu
• Przenoszenia danych
Kontakt: [EMAIL]`,
      },
      {
        heading: "7. Zmiany polityki",
        text: `Polityka prywatności może ulec zmianie. Aktualna wersja jest zawsze dostępna w Serwisie. Data ostatniej aktualizacji: [DATA AKTUALIZACJI].`,
      },
    ],
  },
  cookies: {
    title: "Polityka cookies",
    sections: [
      {
        heading: "1. Czym są pliki cookies?",
        text: `Pliki cookies (ciasteczka) to niewielkie pliki tekstowe zapisywane na urządzeniu użytkownika podczas korzystania z serwisu internetowego.`,
      },
      {
        heading: "2. Jakie cookies stosujemy?",
        text: `Serwis „Co mogę zjeść?" wykorzystuje wyłącznie cookies niezbędne do działania:
• Cookie sesyjne — utrzymanie sesji użytkownika i limitu zapytań
• Cookie preferencji — zapamiętanie zgody na cookies (localStorage)

Nie stosujemy cookies:
• Analitycznych (Google Analytics itp.)
• Marketingowych / reklamowych
• Śledzących użytkownika między stronami`,
      },
      {
        heading: "3. Podstawa prawna",
        text: `Cookies niezbędne do działania serwisu nie wymagają zgody użytkownika (art. 173 ust. 3 Prawa telekomunikacyjnego). Informujemy o nich w ramach transparentności.`,
      },
      {
        heading: "4. Zarządzanie cookies",
        text: `Użytkownik może zarządzać plikami cookies poprzez ustawienia przeglądarki internetowej. Wyłączenie cookies sesyjnych może ograniczyć funkcjonalność Serwisu (np. limity zapytań mogą nie działać prawidłowo).`,
      },
      {
        heading: "5. Kontakt",
        text: `W razie pytań dotyczących cookies prosimy o kontakt: [EMAIL]. Data ostatniej aktualizacji: [DATA AKTUALIZACJI].`,
      },
    ],
  },
  contact: {
    title: "Kontakt",
    sections: [
      {
        heading: "Dane kontaktowe",
        text: `[NAZWA FIRMY]
Adres: [ADRES]
NIP: [NIP]
E-mail: [EMAIL]`,
      },
      {
        heading: "Zgłoszenia i pytania",
        text: `W sprawach dotyczących:
• Działania serwisu — prosimy o kontakt na adres [EMAIL]
• Danych osobowych — prosimy o kontakt na adres [EMAIL] z tematem „Dane osobowe"
• Błędów w przepisach — prosimy o kontakt na adres [EMAIL] z tematem „Przepis"
• Współpracy — prosimy o kontakt na adres [EMAIL] z tematem „Współpraca"

Staramy się odpowiadać w ciągu 3 dni roboczych.`,
      },
      {
        heading: "Informacja o projekcie",
        text: `„Co mogę zjeść?" to serwis wykorzystujący sztuczną inteligencję do proponowania przepisów kulinarnych na podstawie dostępnych składników. Naszym celem jest ułatwienie codziennego planowania posiłków i ograniczenie marnowania żywności.`,
      },
    ],
  },
};

function LegalPage({ type }) {
  const content = LEGAL_CONTENT[type] || LEGAL_CONTENT.terms;

  return (
    <main className="legal-shell">
      <nav className="legal-nav">
        <a href="/" className="btn ghost inline-link legal-back">
          ← Wróć do aplikacji
        </a>
      </nav>
      <article className="legal-card">
        <h1>{content.title}</h1>
        {content.sections.map((section, index) => {
          const sectionId =
            type === "contact" && /projekt/i.test(section.heading) ? "o-projekcie" : undefined;
          return (
            <section key={`legal-section-${index}`} className="legal-section" id={sectionId}>
              <h2>{section.heading}</h2>
              <div className="legal-text">{section.text}</div>
            </section>
          );
        })}
        <p className="legal-placeholder-note">
          Uwaga: Miejsca oznaczone nawiasami kwadratowymi [NAZWA FIRMY], [ADRES], [EMAIL], [NIP], [DATA AKTUALIZACJI]
          wymagają uzupełnienia danymi firmy przed publikacją.
        </p>
      </article>
      <AppFooter />
    </main>
  );
}

/* ── App Root ───────────────────────────────────── */

function App() {
  const path = routePath();
  if (path === "/zaloguj") return <AdminPanelPage />;
  if (path === "/legal/terms") return <LegalPage type="terms" />;
  if (path === "/legal/privacy") return <LegalPage type="privacy" />;
  if (path === "/legal/cookies") return <LegalPage type="cookies" />;
  if (path === "/contact") return <LegalPage type="contact" />;
  return (
    <>
      <UserChatPage />
      <AppFooter />
      <CookieBanner />
    </>
  );
}

export default App;

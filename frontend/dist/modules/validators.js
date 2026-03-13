function safeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

const CHAT_FILTER_DIET_VALUES = new Set([
  "any",
  "classic",
  "vegetarian",
  "vegan",
  "gluten_free",
  "lactose_free",
]);
const CHAT_FILTER_TIME_VALUES = new Set(["any", "15", "30", "45"]);
const CHAT_FILTER_DIFFICULTY_VALUES = new Set(["any", "easy", "medium"]);
const CHAT_FILTER_BUDGET_VALUES = new Set(["any", "low", "medium"]);

function validateChatFilters(filters) {
  if (filters === undefined) {
    return { ok: true };
  }

  if (!isPlainObject(filters)) {
    return { ok: false, status: 400, error: "Pole filters musi byc obiektem." };
  }

  const diet = safeString(filters.diet || "any");
  if (diet && !CHAT_FILTER_DIET_VALUES.has(diet)) {
    return { ok: false, status: 400, error: "Niepoprawna wartosc filters.diet." };
  }

  const maxTime = safeString(filters.maxTime || "any");
  if (maxTime && !CHAT_FILTER_TIME_VALUES.has(maxTime)) {
    return { ok: false, status: 400, error: "Niepoprawna wartosc filters.maxTime." };
  }

  const difficulty = safeString(filters.difficulty || "any");
  if (difficulty && !CHAT_FILTER_DIFFICULTY_VALUES.has(difficulty)) {
    return { ok: false, status: 400, error: "Niepoprawna wartosc filters.difficulty." };
  }

  const budget = safeString(filters.budget || "any");
  if (budget && !CHAT_FILTER_BUDGET_VALUES.has(budget)) {
    return { ok: false, status: 400, error: "Niepoprawna wartosc filters.budget." };
  }

  if (
    filters.ingredientLimitFive !== undefined &&
    typeof filters.ingredientLimitFive !== "boolean"
  ) {
    return {
      ok: false,
      status: 400,
      error: "Pole filters.ingredientLimitFive musi byc typu boolean.",
    };
  }

  return { ok: true };
}

function validateChatPayload(payload, promptMaxChars, maxHistoryItems = 6, maxExcludedItems = 64) {
  if (!isPlainObject(payload)) {
    return { ok: false, status: 400, error: "Niepoprawny payload zapytania." };
  }

  const prompt = safeString(payload.prompt);
  if (!prompt) {
    return { ok: false, status: 400, error: "Pole prompt jest wymagane." };
  }

  if (prompt.length > promptMaxChars) {
    return {
      ok: false,
      status: 400,
      error: `Prompt jest zbyt dlugi. Maksymalna dlugosc: ${promptMaxChars} znakow.`,
    };
  }

  if (payload.history !== undefined && !Array.isArray(payload.history)) {
    return { ok: false, status: 400, error: "Pole history musi byc tablica." };
  }
  if (Array.isArray(payload.history) && payload.history.length > maxHistoryItems * 4) {
    return { ok: false, status: 400, error: "Historia rozmowy jest zbyt dluga." };
  }

  if (payload.excludedRecipeIds !== undefined && !Array.isArray(payload.excludedRecipeIds)) {
    return { ok: false, status: 400, error: "Pole excludedRecipeIds musi byc tablica." };
  }
  if (
    Array.isArray(payload.excludedRecipeIds) &&
    payload.excludedRecipeIds.length > maxExcludedItems
  ) {
    return { ok: false, status: 400, error: "Za duzo elementow excludedRecipeIds." };
  }

  const filtersValidation = validateChatFilters(payload.filters);
  if (!filtersValidation.ok) {
    return filtersValidation;
  }

  return { ok: true };
}

function validatePhotoPayload(payload) {
  if (!isPlainObject(payload)) {
    return { ok: false, status: 400, error: "Niepoprawny payload zapytania." };
  }

  const imageDataUrl = safeString(payload.imageDataUrl);
  if (!imageDataUrl) {
    return { ok: false, status: 400, error: "Pole imageDataUrl jest wymagane." };
  }

  if (!/^data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+$/.test(imageDataUrl)) {
    return { ok: false, status: 400, error: "Niepoprawny format imageDataUrl." };
  }

  const filtersValidation = validateChatFilters(payload.filters);
  if (!filtersValidation.ok) {
    return filtersValidation;
  }

  return { ok: true };
}

function validateFeedbackPayload(payload) {
  if (!isPlainObject(payload)) {
    return { ok: false, status: 400, error: "Niepoprawny payload zapytania." };
  }

  const action = safeString(payload.action);
  if (!action) {
    return { ok: false, status: 400, error: "Pole action jest wymagane." };
  }

  const allowedActions = new Set([
    "accept",
    "accepted",
    "reject",
    "rejected",
    "followup",
    "regenerate",
  ]);
  if (!allowedActions.has(action)) {
    return { ok: false, status: 400, error: "Niepoprawna wartosc pola action." };
  }

  return { ok: true };
}

function validateAdminLoginPayload(payload) {
  if (!isPlainObject(payload)) {
    return { ok: false, status: 400, error: "Niepoprawny payload logowania." };
  }

  const password = safeString(payload.password);
  if (!password) {
    return { ok: false, status: 400, error: "Pole password jest wymagane." };
  }
  if (password.length > 256) {
    return { ok: false, status: 400, error: "Pole password jest zbyt dlugie." };
  }
  return { ok: true };
}

module.exports = {
  validateAdminLoginPayload,
  validateChatPayload,
  validateChatFilters,
  validateFeedbackPayload,
  validatePhotoPayload,
};

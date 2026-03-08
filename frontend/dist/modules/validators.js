function safeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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
  validateFeedbackPayload,
  validatePhotoPayload,
};

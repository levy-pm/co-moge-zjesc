const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { URL } = require("url");

const distPath = path.resolve(__dirname, "..", "dist");
const storeDir = path.join(distPath, "tmp");
const storeFile = path.join(storeDir, "store.json");
const port = Number(process.env.PORT || 3000);
const maxBodySize = 1024 * 1024;

const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const SESSION_SECRET =
  process.env.ADMIN_SESSION_SECRET ||
  process.env.SESSION_SECRET ||
  "change-this-admin-session-secret";
const SESSION_TTL_SECONDS = Number(process.env.ADMIN_SESSION_TTL_SECONDS || 60 * 60 * 12);

const MIME_TYPES = {
  ".css": "text/css; charset=UTF-8",
  ".html": "text/html; charset=UTF-8",
  ".ico": "image/x-icon",
  ".js": "application/javascript; charset=UTF-8",
  ".json": "application/json; charset=UTF-8",
  ".map": "application/json; charset=UTF-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=UTF-8",
};

function safeInt(value) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function safeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function mimeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || "application/octet-stream";
}

function sendJson(res, statusCode, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=UTF-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    ...extraHeaders,
  });
  res.end(body);
}

function sendText(res, statusCode, text, extraHeaders = {}) {
  res.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=UTF-8",
    "Content-Length": Buffer.byteLength(text),
    ...extraHeaders,
  });
  res.end(text);
}

function sendFile(req, res, filePath) {
  fs.readFile(filePath, (error, content) => {
    if (error) {
      sendText(res, 404, "Not found");
      return;
    }

    const headers = {
      "Content-Type": mimeFor(filePath),
      "Content-Length": content.length,
      "Cache-Control": "public, max-age=0",
    };
    res.writeHead(200, headers);

    if (req.method === "HEAD") {
      res.end();
      return;
    }

    res.end(content);
  });
}

function parseCookies(req) {
  const raw = req.headers.cookie;
  if (!raw) return {};

  return raw.split(";").reduce((acc, part) => {
    const [name, ...rest] = part.trim().split("=");
    if (!name) return acc;
    acc[name] = decodeURIComponent(rest.join("="));
    return acc;
  }, {});
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let body = "";

    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBodySize) {
        reject(new Error("Payload too large"));
        req.destroy();
        return;
      }
      body += chunk.toString("utf8");
    });

    req.on("end", () => {
      if (!body.trim()) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });

    req.on("error", reject);
  });
}

function defaultStore() {
  return {
    recipes: [],
    feedback: [],
    nextRecipeId: 1,
    nextFeedbackId: 1,
  };
}

function normalizeStore(raw) {
  const base = defaultStore();
  if (!raw || typeof raw !== "object") return base;

  const recipes = Array.isArray(raw.recipes) ? raw.recipes : [];
  const feedback = Array.isArray(raw.feedback) ? raw.feedback : [];

  const normalizedRecipes = recipes
    .map((recipe) => ({
      id: safeInt(recipe.id),
      nazwa: safeString(recipe.nazwa),
      skladniki: safeString(recipe.skladniki),
      opis: safeString(recipe.opis),
      czas: safeString(recipe.czas),
      tagi: safeString(recipe.tagi),
    }))
    .filter((recipe) => recipe.id !== null)
    .sort((left, right) => left.id - right.id);

  const maxRecipeId = normalizedRecipes.reduce((max, recipe) => Math.max(max, recipe.id), 0);
  const maxFeedbackId = feedback.reduce((max, row) => Math.max(max, safeInt(row.id) || 0), 0);

  return {
    recipes: normalizedRecipes,
    feedback,
    nextRecipeId: Math.max(safeInt(raw.nextRecipeId) || 1, maxRecipeId + 1),
    nextFeedbackId: Math.max(safeInt(raw.nextFeedbackId) || 1, maxFeedbackId + 1),
  };
}

function loadStore() {
  try {
    fs.mkdirSync(storeDir, { recursive: true });
    if (!fs.existsSync(storeFile)) {
      const empty = defaultStore();
      fs.writeFileSync(storeFile, JSON.stringify(empty, null, 2), "utf8");
      return empty;
    }

    const parsed = JSON.parse(fs.readFileSync(storeFile, "utf8"));
    return normalizeStore(parsed);
  } catch (error) {
    console.error("Store load error:", error);
    return defaultStore();
  }
}

let store = loadStore();

function persistStore() {
  fs.mkdirSync(storeDir, { recursive: true });
  fs.writeFileSync(storeFile, JSON.stringify(store, null, 2), "utf8");
}

function listRecipesDesc() {
  return [...store.recipes].sort((left, right) => right.id - left.id);
}

function getRecipeById(recipeId) {
  return store.recipes.find((recipe) => recipe.id === recipeId) || null;
}

function normalizeRecipePayload(payload) {
  return {
    nazwa: safeString(payload?.nazwa),
    skladniki: safeString(payload?.skladniki),
    opis: safeString(payload?.opis),
    czas: safeString(payload?.czas),
    tagi: safeString(payload?.tagi),
  };
}

function addRecipe(payload) {
  const recipe = normalizeRecipePayload(payload);
  recipe.id = store.nextRecipeId;
  store.nextRecipeId += 1;
  store.recipes.push(recipe);
  persistStore();
  return recipe;
}

function updateRecipe(recipeId, payload) {
  const recipe = getRecipeById(recipeId);
  if (!recipe) return null;
  const next = normalizeRecipePayload(payload);
  recipe.nazwa = next.nazwa;
  recipe.skladniki = next.skladniki;
  recipe.opis = next.opis;
  recipe.czas = next.czas;
  recipe.tagi = next.tagi;
  persistStore();
  return recipe;
}

function deleteRecipe(recipeId) {
  const before = store.recipes.length;
  store.recipes = store.recipes.filter((recipe) => recipe.id !== recipeId);
  if (store.recipes.length === before) return false;
  persistStore();
  return true;
}

function createAdminToken() {
  const payload = {
    role: "admin",
    exp: Date.now() + SESSION_TTL_SECONDS * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${signature}`;
}

function verifyAdminToken(token) {
  if (!token || typeof token !== "string") return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;

  const [encoded, signature] = parts;
  const expected = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(encoded)
    .digest("base64url");

  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  if (!crypto.timingSafeEqual(left, right)) return false;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (!payload || payload.role !== "admin") return false;
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return false;
    return true;
  } catch {
    return false;
  }
}

function isAdminRequest(req) {
  const cookies = parseCookies(req);
  return verifyAdminToken(cookies.admin_session);
}

function requireAdmin(req, res) {
  if (isAdminRequest(req)) return true;
  sendJson(res, 401, { error: "Wymagane logowanie admina." });
  return false;
}

function buildDbContext() {
  if (store.recipes.length === 0) {
    return "Brak polaczenia z baza.";
  }

  return store.recipes
    .map(
      (recipe) =>
        `ID:${recipe.id} | Danie:${recipe.nazwa} | Sklad:${recipe.skladniki} | Tagi:${recipe.tagi}`,
    )
    .join("\n");
}

function normalizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter(
      (item) =>
        item &&
        (item.role === "user" || item.role === "assistant") &&
        typeof item.content === "string",
    )
    .slice(-6)
    .map((item) => ({ role: item.role, content: item.content }));
}

function normalizeOption(option) {
  const recipeId = safeInt(option?.recipe_id);
  return {
    recipe_id: recipeId,
    title: safeString(option?.title) || "Danie",
    why: safeString(option?.why),
    ingredients:
      safeString(option?.ingredients) || "AI nie podalo dokladnych skladnikow.",
    instructions:
      safeString(option?.instructions) || "AI nie podalo instrukcji. Sprobuj dopytac na czacie.",
    time: safeString(option?.time) || "Brak danych",
  };
}

function readGroqApiKey() {
  return (
    process.env.GROQ_API_KEY ||
    process.env.GROQ_KEY ||
    process.env.GROQ_TOKEN ||
    ""
  );
}

async function groqCompletion(messages, options = {}) {
  const apiKey = readGroqApiKey();
  if (!apiKey) {
    throw new Error("Blad konfiguracji: Brak klucza API Groq w zmiennej GROQ_API_KEY.");
  }

  const payload = {
    model: GROQ_MODEL,
    messages,
  };

  if (options.jsonObject) {
    payload.response_format = { type: "json_object" };
  }

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const raw = await response.text();
    throw new Error(`Blad Groq HTTP ${response.status}: ${raw.slice(0, 300)}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("Blad AI: pusta odpowiedz modelu.");
  }
  return content;
}

async function generateOptions(prompt, history, excludedRecipeIds) {
  const systemMsg = `
Jestes doswiadczonym Szefem Kuchni. Odpowiadaj WYLACZNIE poprawnym formatem JSON.
ZADANIE: Generuj dokladnie 2 rozne, konkretne propozycje dan.

ZASADY JAKOSCI:
1. SKLADNIKI: BARDZO PRECYZYJNE (ilosci, miary).
2. INSTRUKCJE: Pelny opis krok po kroku.

Struktura JSON:
{
  "assistant_text": "Krotka odpowiedz tekstowa.",
  "options": [
    { "recipe_id": 1, "title": "...", "why": "...", "ingredients": "...", "instructions": "...", "time": "..." },
    { "recipe_id": null, "title": "...", "why": "...", "ingredients": "...", "instructions": "...", "time": "..." }
  ]
}
PRIORYTET: 1. Baza (wpisz ID). 2. Internet (ID=null, ale wypelnij reszte).
`.trim();

  const excluded = Array.isArray(excludedRecipeIds)
    ? excludedRecipeIds.map((value) => safeInt(value)).filter((value) => value !== null)
    : [];

  const messages = [{ role: "system", content: systemMsg }, ...normalizeHistory(history)];
  const excludedTxt = excluded.length > 0 ? excluded.join(", ") : "(brak)";
  messages.push({
    role: "user",
    content: `User chce: ${prompt}\nBaza:${buildDbContext()}\nOdrzucone ID:${excludedTxt}`,
  });

  const raw = await groqCompletion(messages, { jsonObject: true });
  const parsed = JSON.parse(raw);
  const assistantText = safeString(parsed?.assistant_text) || "Oto co przygotowalem:";
  const optionsRaw = Array.isArray(parsed?.options) ? parsed.options : [];
  const options = [];

  for (const item of optionsRaw) {
    const option = normalizeOption(item);
    if (option.recipe_id !== null) {
      const recipe = getRecipeById(option.recipe_id);
      if (recipe) {
        option.title = recipe.nazwa;
        option.ingredients = recipe.skladniki || "";
        option.instructions = recipe.opis || option.instructions;
        option.time = recipe.czas || "Brak danych";
      }
    }
    options.push(option);
    if (options.length >= 2) break;
  }

  return { assistantText, options };
}

function logFeedback(payload) {
  const option1 = payload?.option1 || {};
  const option2 = payload?.option2 || {};

  store.feedback.push({
    id: store.nextFeedbackId++,
    ts: new Date().toISOString(),
    user_text: safeString(payload?.userText),
    option1_title: safeString(option1?.title),
    option1_recipe_id: safeInt(option1?.recipe_id),
    option2_title: safeString(option2?.title),
    option2_recipe_id: safeInt(option2?.recipe_id),
    action: safeString(payload?.action),
    chosen_index: safeInt(payload?.chosenIndex),
    follow_up_answer: safeString(payload?.followUpAnswer),
  });

  persistStore();
}

function createGeneratedRecipe(skladniki, opis) {
  const recipe = {
    id: store.nextRecipeId++,
    nazwa: `Przepis z: ${skladniki.slice(0, 30)}...`,
    skladniki,
    opis,
    czas: "",
    tagi: "",
  };
  store.recipes.push(recipe);
  persistStore();
  return recipe;
}

async function handleApi(req, res, pathname) {
  const method = req.method || "GET";

  if (method === "GET" && pathname === "/backend/health") {
    sendJson(res, 200, {
      ok: true,
      recipes: store.recipes.length,
      feedback: store.feedback.length,
    });
    return true;
  }

  if (method === "GET" && pathname === "/backend/admin/me") {
    sendJson(res, 200, { loggedIn: isAdminRequest(req) });
    return true;
  }

  if (method === "POST" && pathname === "/backend/admin/login") {
    let payload;
    try {
      payload = await readJsonBody(req);
    } catch {
      sendJson(res, 400, { error: "Bledne dane JSON." });
      return true;
    }

    const password = safeString(payload?.password);
    if (password !== ADMIN_PASSWORD) {
      sendJson(res, 401, { error: "Zle haslo!" });
      return true;
    }

    const token = createAdminToken();
    sendJson(
      res,
      200,
      { ok: true },
      {
        "Set-Cookie": `admin_session=${encodeURIComponent(
          token,
        )}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}`,
      },
    );
    return true;
  }

  if (method === "POST" && pathname === "/backend/admin/logout") {
    sendJson(
      res,
      200,
      { ok: true },
      { "Set-Cookie": "admin_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0" },
    );
    return true;
  }

  if (method === "POST" && pathname === "/backend/chat/options") {
    let payload;
    try {
      payload = await readJsonBody(req);
    } catch {
      sendJson(res, 400, { error: "Bledne dane JSON." });
      return true;
    }

    const prompt = safeString(payload?.prompt);
    if (!prompt) {
      sendJson(res, 400, { error: "Pole prompt jest wymagane." });
      return true;
    }

    try {
      const result = await generateOptions(
        prompt,
        payload?.history || [],
        payload?.excludedRecipeIds || [],
      );
      sendJson(res, 200, result);
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error
            ? error.message
            : "Szef kuchni upuscil talerz (Blad AI).",
      });
    }
    return true;
  }

  if (method === "POST" && pathname === "/backend/chat/feedback") {
    let payload;
    try {
      payload = await readJsonBody(req);
    } catch {
      sendJson(res, 400, { error: "Bledne dane JSON." });
      return true;
    }

    logFeedback(payload);
    sendJson(res, 200, { ok: true });
    return true;
  }

  if (method === "POST" && pathname === "/backend/generuj") {
    let payload;
    try {
      payload = await readJsonBody(req);
    } catch {
      sendJson(res, 400, { error: "Bledne dane JSON." });
      return true;
    }

    const skladniki = safeString(payload?.skladniki);
    if (!skladniki) {
      sendJson(res, 400, { error: "Wpisz najpierw jakies skladniki." });
      return true;
    }

    try {
      const content = await groqCompletion([
        {
          role: "system",
          content: "Jestes Szefem Kuchni. Podaj konkretny przepis na podstawie skladnikow.",
        },
        {
          role: "user",
          content: `Mam te skladniki: ${skladniki}. Co moge z nich zrobic? Podaj tytul i opis wykonania.`,
        },
      ]);

      const recipe = createGeneratedRecipe(skladniki, content);
      sendJson(res, 200, { przepis: content, recipe });
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error
            ? error.message
            : "Szef kuchni ma przerwe (Blad serwera).",
      });
    }
    return true;
  }

  const publicRecipeMatch = pathname.match(/^\/backend\/public\/recipes\/(\d+)\/?$/);
  if (method === "GET" && publicRecipeMatch) {
    const recipeId = safeInt(publicRecipeMatch[1]);
    const recipe = recipeId === null ? null : getRecipeById(recipeId);
    if (!recipe) {
      sendJson(res, 404, { error: "Nie znaleziono przepisu." });
      return true;
    }
    sendJson(res, 200, { recipe });
    return true;
  }

  if (pathname === "/backend/recipes" && method === "GET") {
    if (!requireAdmin(req, res)) return true;
    sendJson(res, 200, { recipes: listRecipesDesc() });
    return true;
  }

  if (pathname === "/backend/recipes" && method === "POST") {
    if (!requireAdmin(req, res)) return true;

    let payload;
    try {
      payload = await readJsonBody(req);
    } catch {
      sendJson(res, 400, { error: "Bledne dane JSON." });
      return true;
    }

    const next = normalizeRecipePayload(payload);
    if (!next.nazwa || !next.skladniki) {
      sendJson(res, 400, { error: "Nazwa i skladniki sa wymagane." });
      return true;
    }

    const recipe = addRecipe(next);
    sendJson(res, 201, { recipe });
    return true;
  }

  const recipeMatch = pathname.match(/^\/backend\/recipes\/(\d+)\/?$/);
  if (recipeMatch) {
    if (!requireAdmin(req, res)) return true;

    const recipeId = safeInt(recipeMatch[1]);
    if (recipeId === null) {
      sendJson(res, 400, { error: "Niepoprawne ID przepisu." });
      return true;
    }

    if (method === "GET") {
      const recipe = getRecipeById(recipeId);
      if (!recipe) {
        sendJson(res, 404, { error: "Nie znaleziono przepisu." });
        return true;
      }
      sendJson(res, 200, { recipe });
      return true;
    }

    if (method === "PUT") {
      let payload;
      try {
        payload = await readJsonBody(req);
      } catch {
        sendJson(res, 400, { error: "Bledne dane JSON." });
        return true;
      }

      const next = normalizeRecipePayload(payload);
      if (!next.nazwa || !next.skladniki) {
        sendJson(res, 400, { error: "Nazwa i skladniki sa wymagane." });
        return true;
      }

      const recipe = updateRecipe(recipeId, next);
      if (!recipe) {
        sendJson(res, 404, { error: "Nie znaleziono przepisu." });
        return true;
      }

      sendJson(res, 200, { recipe });
      return true;
    }

    if (method === "DELETE") {
      const deleted = deleteRecipe(recipeId);
      if (!deleted) {
        sendJson(res, 404, { error: "Nie znaleziono przepisu." });
        return true;
      }

      sendJson(res, 200, { ok: true });
      return true;
    }
  }

  if (pathname.startsWith("/backend/")) {
    sendJson(res, 404, { error: "Nieznany endpoint." });
    return true;
  }

  return false;
}

function resolveStaticPath(pathname) {
  const target = pathname === "/" ? "/index.html" : pathname;
  const full = path.resolve(distPath, `.${target}`);
  const rootPrefix = distPath.endsWith(path.sep) ? distPath : `${distPath}${path.sep}`;
  if (full !== distPath && !full.startsWith(rootPrefix)) {
    return null;
  }

  if (!fs.existsSync(full)) {
    return null;
  }

  const stat = fs.statSync(full);
  if (!stat.isFile()) {
    return null;
  }

  return full;
}

const server = http.createServer(async (req, res) => {
  const method = req.method || "GET";
  const urlObj = new URL(req.url || "/", "http://localhost");
  const pathname = decodeURIComponent(urlObj.pathname || "/");

  try {
    const handledApi = await handleApi(req, res, pathname);
    if (handledApi) return;
  } catch (error) {
    console.error("API unexpected error:", error);
    sendJson(res, 500, { error: "Blad wewnetrzny serwera." });
    return;
  }

  if (method !== "GET" && method !== "HEAD") {
    sendText(res, 405, "Method not allowed");
    return;
  }

  const staticPath = resolveStaticPath(pathname);
  if (staticPath) {
    sendFile(req, res, staticPath);
    return;
  }

  sendFile(req, res, path.join(distPath, "index.html"));
});

server.listen(port, () => {
  console.log(`Backend Node + frontend React dziala na porcie ${port}`);
});

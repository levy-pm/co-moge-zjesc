const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { URL } = require("url");
let mysql = null;

try {
  mysql = require("mysql2/promise");
} catch {
  mysql = null;
}

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
const DB_HOST = process.env.DB_HOST || process.env.MYSQL_HOST || "";
const DB_PORT = Number(process.env.DB_PORT || process.env.MYSQL_PORT || 3306);
const DB_USER = process.env.DB_USER || process.env.MYSQL_USER || "";
const DB_PASSWORD = process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD || "";
const DB_NAME =
  process.env.DB_NAME || process.env.MYSQL_DATABASE || "problems_co-moge-zjesc";
const DB_TABLE_RAW = process.env.DB_TABLE || "recipes";
const DB_CHARSET_RAW = process.env.DB_CHARSET || "utf8mb3";

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

const DB_TABLE = safeIdentifier(DB_TABLE_RAW, "recipes");
const DB_CHARSET = safeIdentifier(DB_CHARSET_RAW, "utf8mb3");
const DB_COLLATION = `${DB_CHARSET}_general_ci`;
const DB_MATCH_MIN_SCORE = 3;
let dbPool = null;
let dbEnabled = false;
let dbLastError = "";

function safeInt(value) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function safeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function safeIdentifier(value, fallback) {
  return /^[A-Za-z0-9_]+$/.test(value) ? value : fallback;
}

function safeLink(value) {
  return safeString(value).slice(0, 1024);
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
      link_filmu: safeLink(recipe.link_filmu),
      link_strony: safeLink(recipe.link_strony),
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

function cloneRecipeWithId(recipe, id) {
  return {
    ...recipe,
    id: safeInt(id),
  };
}

function hasDbConfig() {
  return Boolean(DB_HOST && DB_USER && DB_NAME);
}

async function initDatabase() {
  if (!hasDbConfig()) {
    dbLastError = "Missing DB_HOST or DB_USER.";
    console.warn("[db] Missing DB config, fallback to file store.");
    return;
  }

  if (!mysql) {
    dbLastError = "mysql2 module is missing.";
    console.warn("[db] mysql2 module is missing, fallback to file store.");
    return;
  }

  try {
    dbPool = mysql.createPool({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
      charset: DB_CHARSET,
      waitForConnections: true,
      connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
      queueLimit: 0,
    });

    const createSql = `
      CREATE TABLE IF NOT EXISTS \`${DB_TABLE}\` (
        id INT NOT NULL AUTO_INCREMENT,
        nazwa VARCHAR(255) NOT NULL,
        czas VARCHAR(255) NOT NULL DEFAULT '',
        skladniki TEXT NOT NULL,
        opis TEXT NOT NULL,
        tagi VARCHAR(512) NOT NULL DEFAULT '',
        link_filmu VARCHAR(1024) NOT NULL DEFAULT '',
        link_strony VARCHAR(1024) NOT NULL DEFAULT '',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=${DB_CHARSET} COLLATE=${DB_COLLATION};
    `;
    await dbPool.query(createSql);

    dbEnabled = true;
    dbLastError = "";
    console.log(`[db] Connected to MySQL ${DB_NAME}.${DB_TABLE} on ${DB_HOST}:${DB_PORT}`);
  } catch (error) {
    dbEnabled = false;
    dbLastError = error instanceof Error ? error.message : String(error);
    console.error("[db] MySQL init failed, fallback to file store:", dbLastError);
  }
}

async function listRecipesDesc() {
  if (dbEnabled && dbPool) {
    const [rows] = await dbPool.query(
      `SELECT id, nazwa, skladniki, opis, czas, tagi, link_filmu, link_strony
       FROM \`${DB_TABLE}\`
       ORDER BY id DESC`,
    );

    return rows
      .map((row) => ({
        id: safeInt(row.id),
        nazwa: safeString(row.nazwa),
        skladniki: safeString(row.skladniki),
        opis: safeString(row.opis),
        czas: safeString(row.czas),
        tagi: safeString(row.tagi),
        link_filmu: safeLink(row.link_filmu),
        link_strony: safeLink(row.link_strony),
      }))
      .filter((row) => row.id !== null);
  }

  return [...store.recipes]
    .map((recipe) => ({
      id: safeInt(recipe.id),
      nazwa: safeString(recipe.nazwa),
      skladniki: safeString(recipe.skladniki),
      opis: safeString(recipe.opis),
      czas: safeString(recipe.czas),
      tagi: safeString(recipe.tagi),
      link_filmu: safeLink(recipe.link_filmu),
      link_strony: safeLink(recipe.link_strony),
    }))
    .filter((row) => row.id !== null)
    .sort((left, right) => right.id - left.id);
}

async function getRecipeById(recipeId) {
  if (dbEnabled && dbPool) {
    const [rows] = await dbPool.query(
      `SELECT id, nazwa, skladniki, opis, czas, tagi, link_filmu, link_strony
       FROM \`${DB_TABLE}\`
       WHERE id = ?
       LIMIT 1`,
      [recipeId],
    );
    if (!Array.isArray(rows) || rows.length === 0) return null;

    const row = rows[0];
    return {
      id: safeInt(row.id),
      nazwa: safeString(row.nazwa),
      skladniki: safeString(row.skladniki),
      opis: safeString(row.opis),
      czas: safeString(row.czas),
      tagi: safeString(row.tagi),
      link_filmu: safeLink(row.link_filmu),
      link_strony: safeLink(row.link_strony),
    };
  }

  const recipe = store.recipes.find((item) => item.id === recipeId) || null;
  if (!recipe) return null;
  return {
    id: safeInt(recipe.id),
    nazwa: safeString(recipe.nazwa),
    skladniki: safeString(recipe.skladniki),
    opis: safeString(recipe.opis),
    czas: safeString(recipe.czas),
    tagi: safeString(recipe.tagi),
    link_filmu: safeLink(recipe.link_filmu),
    link_strony: safeLink(recipe.link_strony),
  };
}

function normalizeRecipePayload(payload) {
  return {
    nazwa: safeString(payload?.nazwa),
    skladniki: safeString(payload?.skladniki),
    opis: safeString(payload?.opis),
    czas: safeString(payload?.czas),
    tagi: safeString(payload?.tagi),
    link_filmu: safeLink(payload?.link_filmu),
    link_strony: safeLink(payload?.link_strony),
  };
}

async function addRecipe(payload) {
  const recipe = normalizeRecipePayload(payload);
  if (dbEnabled && dbPool) {
    const [result] = await dbPool.query(
      `INSERT INTO \`${DB_TABLE}\`
      (nazwa, czas, skladniki, opis, tagi, link_filmu, link_strony)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        recipe.nazwa,
        recipe.czas,
        recipe.skladniki,
        recipe.opis,
        recipe.tagi,
        recipe.link_filmu,
        recipe.link_strony,
      ],
    );
    return cloneRecipeWithId(recipe, result.insertId);
  }

  recipe.id = store.nextRecipeId;
  store.nextRecipeId += 1;
  store.recipes.push(recipe);
  persistStore();
  return recipe;
}

async function updateRecipe(recipeId, payload) {
  const next = normalizeRecipePayload(payload);

  if (dbEnabled && dbPool) {
    const [result] = await dbPool.query(
      `UPDATE \`${DB_TABLE}\`
       SET nazwa = ?, czas = ?, skladniki = ?, opis = ?, tagi = ?, link_filmu = ?, link_strony = ?
       WHERE id = ?`,
      [
        next.nazwa,
        next.czas,
        next.skladniki,
        next.opis,
        next.tagi,
        next.link_filmu,
        next.link_strony,
        recipeId,
      ],
    );

    if (!result || result.affectedRows === 0) return null;
    return getRecipeById(recipeId);
  }

  const recipe = store.recipes.find((item) => item.id === recipeId);
  if (!recipe) return null;

  recipe.nazwa = next.nazwa;
  recipe.skladniki = next.skladniki;
  recipe.opis = next.opis;
  recipe.czas = next.czas;
  recipe.tagi = next.tagi;
  recipe.link_filmu = next.link_filmu;
  recipe.link_strony = next.link_strony;
  persistStore();
  return recipe;
}

async function deleteRecipe(recipeId) {
  if (dbEnabled && dbPool) {
    const [result] = await dbPool.query(`DELETE FROM \`${DB_TABLE}\` WHERE id = ?`, [recipeId]);
    return Boolean(result && result.affectedRows > 0);
  }

  const before = store.recipes.length;
  store.recipes = store.recipes.filter((recipe) => recipe.id !== recipeId);
  if (store.recipes.length === before) return false;
  persistStore();
  return true;
}

async function countRecipes() {
  if (dbEnabled && dbPool) {
    const [rows] = await dbPool.query(`SELECT COUNT(*) AS total FROM \`${DB_TABLE}\``);
    return safeInt(rows?.[0]?.total) || 0;
  }
  return store.recipes.length;
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

function removeDiacritics(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const STOP_WORDS = new Set([
  "oraz",
  "albo",
  "dla",
  "tego",
  "te",
  "ten",
  "jest",
  "bede",
  "bedzie",
  "chce",
  "chcialbym",
  "szukam",
  "mam",
  "ktore",
  "ktory",
  "ktora",
  "czy",
  "jak",
  "jaki",
  "jakie",
  "jakis",
  "moze",
  "prosze",
  "potrzebuje",
  "na",
  "do",
  "po",
  "od",
  "z",
  "ze",
  "i",
  "a",
  "o",
  "w",
  "we",
]);

function normalizePhrase(value) {
  return removeDiacritics(safeString(value).toLowerCase())
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function scoreRecipeNameSimilarity(prompt, recipeName) {
  const normalizedPrompt = normalizePhrase(prompt);
  const normalizedName = normalizePhrase(recipeName);
  if (!normalizedPrompt || !normalizedName) return 0;

  let score = 0;
  if (normalizedPrompt === normalizedName) score += 140;
  if (
    (normalizedPrompt.length >= 4 && normalizedName.includes(normalizedPrompt)) ||
    (normalizedName.length >= 4 && normalizedPrompt.includes(normalizedName))
  ) {
    score += 90;
  }

  const promptTokens = normalizedPrompt
    .split(" ")
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
  const nameTokens = normalizedName
    .split(" ")
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
  if (promptTokens.length === 0 || nameTokens.length === 0) return score;

  const promptSet = new Set(promptTokens);
  let overlap = 0;
  for (const token of nameTokens) {
    if (promptSet.has(token)) overlap += 1;
  }
  if (overlap === 0) return score;

  score += overlap * 18;
  if (overlap / nameTokens.length >= 0.6) score += 24;
  return score;
}

function findMatchingRecipes(prompt, recipes, excludedSet, limit = 2, minScore = 1) {
  const normalizedPrompt = normalizePhrase(prompt);
  if (!normalizedPrompt) return [];

  return recipes
    .filter((recipe) => !excludedSet.has(recipe.id))
    .map((recipe) => ({ recipe, score: scoreRecipeNameSimilarity(normalizedPrompt, recipe.nazwa) }))
    .filter((item) => item.score >= minScore)
    .sort((left, right) => right.score - left.score || right.recipe.id - left.recipe.id)
    .slice(0, limit)
    .map((item) => item.recipe);
}

function findNameSimilarRecipes(prompt, recipes, excludedSet, limit = 1) {
  return recipes
    .filter((recipe) => !excludedSet.has(recipe.id))
    .map((recipe) => ({ recipe, score: scoreRecipeNameSimilarity(prompt, recipe.nazwa) }))
    .filter((item) => item.score >= 36)
    .sort((left, right) => right.score - left.score || right.recipe.id - left.recipe.id)
    .slice(0, limit)
    .map((item) => item.recipe);
}

function buildDbContext(recipes) {
  if (!Array.isArray(recipes) || recipes.length === 0) {
    return "Brak przepisow w bazie.";
  }

  return recipes
    .slice(0, 80)
    .map((recipe) => {
      const opisSkrot = safeString(recipe.opis).slice(0, 180);
      const skladnikiSkrot = safeString(recipe.skladniki).slice(0, 240);
      return (
        `ID:${recipe.id} | Nazwa:${recipe.nazwa} | Czas:${recipe.czas || "brak"} | ` +
        `Tagi:${recipe.tagi || "-"} | Skladniki:${skladnikiSkrot} | Opis:${opisSkrot}`
      );
    })
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
    link_filmu: safeLink(option?.link_filmu),
    link_strony: safeLink(option?.link_strony),
  };
}

const INTERNET_RECIPE_CATALOG = [
  {
    title: "Shakshuka z pomidorami",
    why: "Popularny przepis sniadaniowy znany z kuchni bliskowschodniej i blogow kulinarnych.",
    ingredients: "Pomidory, papryka, cebula, czosnek, jajka, kmin rzymski, oliwa.",
    instructions:
      "Podsmaz cebule i papryke. Dodaj pomidory i przyprawy. Zrob gniazda i zetnij jajka pod przykryciem.",
    time: "20-25 min",
  },
  {
    title: "Pasta aglio e olio",
    why: "Klasyczne danie wloskie, bardzo czesto polecane jako szybki i pewny przepis.",
    ingredients: "Spaghetti, czosnek, oliwa, chili, pietruszka, sol.",
    instructions:
      "Ugotuj makaron al dente. Czosnek podsmaz na oliwie z chili. Wymieszaj z makaronem i pietruszka.",
    time: "15-20 min",
  },
  {
    title: "Dahl z czerwonej soczewicy",
    why: "Sprawdzona, sycaca propozycja oparta o popularne przepisy kuchni indyjskiej.",
    ingredients: "Czerwona soczewica, pomidory, cebula, czosnek, imbir, curry, mleko kokosowe.",
    instructions:
      "Podsmaz cebule z przyprawami, dodaj soczewice i pomidory, gotuj do miekkosci, na koniec dodaj mleko kokosowe.",
    time: "30-35 min",
  },
  {
    title: "Kurczak teriyaki z ryzem",
    why: "Znany przepis azjatycki, czesto odtwarzany na podstawie autentycznych receptur.",
    ingredients: "Filet z kurczaka, sos sojowy, miod, czosnek, imbir, ryz, szczypiorek.",
    instructions:
      "Obsmaz kurczaka, dodaj sos teriyaki i zredukuj. Podawaj z ugotowanym ryzem i szczypiorkiem.",
    time: "25-30 min",
  },
  {
    title: "Zupa krem z pieczonej dyni",
    why: "Powszechnie znana i wielokrotnie testowana propozycja sezonowa.",
    ingredients: "Dynia, cebula, czosnek, bulion, smietanka lub mleko kokosowe, pestki dyni.",
    instructions:
      "Upiecz dynie z cebula i czosnkiem, zblenduj z bulionem, dopraw i podawaj z pestkami.",
    time: "35-45 min",
  },
];

function hashPromptSeed(prompt) {
  const text = normalizePhrase(prompt);
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function internetFallbackOptions(prompt, limit = 2, existingOptions = []) {
  const seed = hashPromptSeed(prompt);
  const usedTitles = new Set(
    existingOptions.map((option) => normalizePhrase(option?.title || "")).filter(Boolean),
  );
  const options = [];

  let offset = 0;
  const maxLoop = INTERNET_RECIPE_CATALOG.length * 3;
  while (options.length < limit && offset < maxLoop) {
    const recipe = INTERNET_RECIPE_CATALOG[(seed + offset) % INTERNET_RECIPE_CATALOG.length];
    offset += 1;
    if (!recipe) continue;

    const key = normalizePhrase(recipe.title);
    if (usedTitles.has(key)) continue;
    usedTitles.add(key);
    options.push(
      normalizeOption({
        recipe_id: null,
        ...recipe,
      }),
    );
  }

  return options;
}

function isDbLikeOption(option, recipes) {
  const optionTitle = safeString(option?.title);
  if (!optionTitle) return false;
  return recipes.some((recipe) => scoreRecipeNameSimilarity(optionTitle, recipe.nazwa) >= 36);
}

function optionFromRecipe(recipe, whyText) {
  return normalizeOption({
    recipe_id: recipe.id,
    title: recipe.nazwa,
    why: whyText || "To danie pasuje do Twojego zapytania.",
    ingredients: recipe.skladniki,
    instructions: recipe.opis,
    time: recipe.czas || "Brak danych",
    link_filmu: recipe.link_filmu || "",
    link_strony: recipe.link_strony || "",
  });
}

function buildAssistantText(requiredRecipe, hasDbMatch) {
  if (requiredRecipe) {
    return "Mam dwie propozycje. Jedna jest dopasowana po nazwie dania, ktore wpisales.";
  }
  if (hasDbMatch) {
    return "Mam dwie propozycje dopasowane do Twojego zapytania.";
  }
  return "Mam dwie propozycje oparte o sprawdzone przepisy.";
}

function fallbackOptionsFromRecipes(prompt, recipes, excludedSet) {
  const nameSimilar = findNameSimilarRecipes(prompt, recipes, excludedSet, 1);
  const matched = findMatchingRecipes(prompt, recipes, excludedSet, 2, DB_MATCH_MIN_SCORE);
  const options = [];
  const used = new Set();

  if (nameSimilar.length > 0) {
    options.push(
      optionFromRecipe(
        nameSimilar[0],
        "To danie ma nazwe bardzo podobna do Twojego zapytania.",
      ),
    );
    used.add(nameSimilar[0].id);
  }

  for (const row of matched) {
    if (options.length >= 2) break;
    if (used.has(row.id)) continue;
    options.push(optionFromRecipe(row, "To danie pasuje do Twojego zapytania."));
    used.add(row.id);
  }

  if (options.length < 2) {
    options.push(...internetFallbackOptions(prompt, 2 - options.length, options));
  }

  return {
    assistantText: buildAssistantText(nameSimilar[0] || null, matched.length > 0),
    options: options.slice(0, 2),
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
  const allRecipes = await listRecipesDesc();
  const excluded = Array.isArray(excludedRecipeIds)
    ? excludedRecipeIds.map((value) => safeInt(value)).filter((value) => value !== null)
    : [];
  const excludedSet = new Set(excluded);
  const availableRecipes = allRecipes.filter((recipe) => !excludedSet.has(recipe.id));
  const nameSimilar = findNameSimilarRecipes(prompt, availableRecipes, excludedSet, 1);
  const requiredRecipe = nameSimilar[0] || null;
  const strongMatched = findMatchingRecipes(
    prompt,
    availableRecipes,
    excludedSet,
    4,
    DB_MATCH_MIN_SCORE,
  );
  const allowedDbIds = new Set(strongMatched.map((recipe) => recipe.id));
  if (requiredRecipe) {
    allowedDbIds.add(requiredRecipe.id);
  }
  const hasDbMatch = allowedDbIds.size > 0;

  if (!readGroqApiKey()) {
    return fallbackOptionsFromRecipes(prompt, availableRecipes, excludedSet);
  }

  const systemMsg = `
Jestes doswiadczonym Szefem Kuchni. Odpowiadasz zawsze po polsku i tylko poprawnym JSON.
WAZNE:
1) Generujesz DOKLADNIE 2 rozne propozycje.
2) Jesli WYMAGANE_DB_ID nie jest "brak" (wykryta podobna nazwa przepisu/dania), jedna opcja MUSI miec ten recipe_id.
3) Jesli WYMAGANE_DB_ID to "brak", nie wymuszaj recipe_id z bazy.
4) Gdy brak sensownego dopasowania, podawaj propozycje oparte o prawdziwe, znane przepisy (internet/klasyka).
5) Dla recipe_id podawaj nazwe, czas, streszczenie, liste skladnikow i instrukcje.

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

  const messages = [{ role: "system", content: systemMsg }, ...normalizeHistory(history)];
  const excludedTxt = excluded.length > 0 ? excluded.join(", ") : "(brak)";
  const requiredDbTxt = requiredRecipe
    ? `${requiredRecipe.id} (${requiredRecipe.nazwa})`
    : "brak";
  const allowedDbIdsTxt =
    allowedDbIds.size > 0 ? Array.from(allowedDbIds).join(", ") : "(brak)";
  const dbContext = hasDbMatch
    ? buildDbContext(availableRecipes.filter((recipe) => allowedDbIds.has(recipe.id)))
    : "Brak dopasowanych przepisow z bazy do tego zapytania.";
  messages.push({
    role: "user",
    content:
      `Pytanie uzytkownika: ${prompt}\n` +
      `WYMAGANE_DB_ID: ${requiredDbTxt}\n` +
      `DOZWOLONE_DB_ID: ${allowedDbIdsTxt}\n` +
      `CZY_JEST_DOPASOWANIE_Z_BAZY: ${hasDbMatch ? "tak" : "nie"}\n` +
      `Kontekst bazy:\n${dbContext}\n` +
      `Odrzucone ID: ${excludedTxt}`,
  });

  const raw = await groqCompletion(messages, { jsonObject: true });
  let parsed = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {};
  }

  const optionsRaw = Array.isArray(parsed?.options) ? parsed.options : [];
  const options = [];
  const usedRecipeIds = new Set();
  const recipeMap = new Map(availableRecipes.map((recipe) => [recipe.id, recipe]));

  for (const item of optionsRaw) {
    const option = normalizeOption(item);
    if (option.recipe_id !== null) {
      const recipe = recipeMap.get(option.recipe_id);
      if (recipe && allowedDbIds.has(recipe.id)) {
        options.push(optionFromRecipe(recipe, option.why || "To danie pasuje do Twojego zapytania."));
        usedRecipeIds.add(recipe.id);
      }
      if (options.length >= 2) break;
      continue;
    }

    if (!hasDbMatch && isDbLikeOption(option, availableRecipes)) {
      continue;
    }

    options.push(option);

    if (options.length >= 2) break;
  }

  if (requiredRecipe && !usedRecipeIds.has(requiredRecipe.id)) {
    const requiredOption = optionFromRecipe(
      requiredRecipe,
      "To danie ma nazwe najbardziej zblizona do Twojego zapytania.",
    );
    if (options.length < 2) {
      options.unshift(requiredOption);
    } else {
      const nonDbIndex = options.findIndex((item) => item.recipe_id === null);
      if (nonDbIndex >= 0) {
        options[nonDbIndex] = requiredOption;
      } else {
        options[1] = requiredOption;
      }
    }
    usedRecipeIds.add(requiredRecipe.id);
  }

  if (hasDbMatch && options.length < 2) {
    for (const recipe of strongMatched) {
      if (options.length >= 2) break;
      if (usedRecipeIds.has(recipe.id)) continue;
      options.push(optionFromRecipe(recipe, "To danie jest zgodne z Twoim zapytaniem."));
      usedRecipeIds.add(recipe.id);
    }
  }

  if (options.length < 2) {
    options.push(...internetFallbackOptions(prompt, 2 - options.length, options));
  }

  while (options.length < 2) {
    options.push(
      normalizeOption({
        recipe_id: null,
        title: "Klasyczne danie domowe",
        why: "Awaryjna propozycja oparta o sprawdzone przepisy.",
        ingredients: "Podaj konkretne skladniki, a przygotuje bardziej precyzyjna liste.",
        instructions: "Dopytaj o szczegoly i poziom trudnosci, a doprecyzuje przygotowanie.",
        time: "25-35 min",
      }),
    );
  }

  const assistantText = buildAssistantText(requiredRecipe, hasDbMatch);
  return { assistantText, options: options.slice(0, 2) };
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

async function createGeneratedRecipe(skladniki, opis) {
  const payload = {
    nazwa: `Przepis z: ${skladniki.slice(0, 30)}...`,
    skladniki,
    opis,
    czas: "",
    tagi: "",
    link_filmu: "",
    link_strony: "",
  };
  return addRecipe(payload);
}

async function handleApi(req, res, pathname) {
  const method = req.method || "GET";

  if (method === "GET" && pathname === "/backend/health") {
    const recipes = await countRecipes();
    sendJson(res, 200, {
      ok: true,
      storage: dbEnabled ? "mysql" : "file",
      dbName: DB_NAME,
      dbTable: DB_TABLE,
      dbError: dbEnabled ? "" : dbLastError,
      recipes,
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

      const recipe = await createGeneratedRecipe(skladniki, content);
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
    const recipe = recipeId === null ? null : await getRecipeById(recipeId);
    if (!recipe) {
      sendJson(res, 404, { error: "Nie znaleziono przepisu." });
      return true;
    }
    sendJson(res, 200, { recipe });
    return true;
  }

  if (pathname === "/backend/recipes" && method === "GET") {
    if (!requireAdmin(req, res)) return true;
    sendJson(res, 200, { recipes: await listRecipesDesc() });
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

    const recipe = await addRecipe(next);
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
      const recipe = await getRecipeById(recipeId);
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

      const recipe = await updateRecipe(recipeId, next);
      if (!recipe) {
        sendJson(res, 404, { error: "Nie znaleziono przepisu." });
        return true;
      }

      sendJson(res, 200, { recipe });
      return true;
    }

    if (method === "DELETE") {
      const deleted = await deleteRecipe(recipeId);
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

async function startServer() {
  await initDatabase();

  server.listen(port, () => {
    const storage = dbEnabled ? `mysql:${DB_NAME}.${DB_TABLE}` : "file";
    console.log(`Backend Node + frontend React dziala na porcie ${port} (recipes=${storage})`);
  });
}

startServer().catch((error) => {
  console.error("Startup error:", error);
  server.listen(port, () => {
    console.log(`Backend Node + frontend React dziala na porcie ${port} (recipes=file)`);
  });
});

const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { URL } = require("url");
const {
  buildJsonRepairPrompt,
  buildPhotoAnalysisPrompt,
  buildRecipeChatSystemPrompt,
  buildRecipeChatUserPrompt,
} = require("./chat-prompts");
const { createLogger, hashValue } = require("./modules/logger");
const { createRequestContext, attachRequestContext, requestDurationMs } = require("./modules/request-context");
const { createWindowRateLimiter } = require("./modules/rate-limiter");
const { createSessionStore } = require("./modules/session-store");
const { createSessionManager } = require("./modules/session-manager");
const { fetchWithTimeout, postJsonWithRetry, sleep } = require("./modules/ai-client");
const { createOpsTelemetry } = require("./modules/ops-telemetry");
const { createOpsRoutesHandler } = require("./modules/ops-routes");
const { createAdminRoutesHandler } = require("./modules/admin-routes");
const {
  classifyPrompt,
  safeBlockedChatResponse,
  sanitizeHistory: sanitizePolicyHistory,
  sanitizeModelOutputText,
} = require("./modules/ai-policy");
const {
  validateAdminLoginPayload,
  validateChatPayload,
  validateFeedbackPayload,
  validatePhotoPayload,
} = require("./modules/validators");
const { validateInlineImageDataUrl: validateInlineImageDataUrlGuard } = require("./modules/upload-guards");
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
const maxBodySize = Number(process.env.MAX_BODY_SIZE_BYTES || 8 * 1024 * 1024);

const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const GEMINI_VISION_MODEL =
  process.env.GEMINI_VISION_MODEL ||
  process.env.GOOGLE_VISION_MODEL ||
  "gemini-2.5-flash";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const SESSION_SECRET =
  process.env.ADMIN_SESSION_SECRET ||
  process.env.SESSION_SECRET ||
  "";
const SESSION_TTL_SECONDS = Number(process.env.ADMIN_SESSION_TTL_SECONDS || 60 * 60 * 12);
const USER_SESSION_SECRET =
  process.env.USER_SESSION_SECRET || process.env.SESSION_SECRET || SESSION_SECRET;
const USER_SESSION_TTL_SECONDS = Number(process.env.USER_SESSION_TTL_SECONDS || 60 * 60 * 12);
const USER_SESSION_REMEMBER_TTL_SECONDS = Number(
  process.env.USER_SESSION_REMEMBER_TTL_SECONDS || 60 * 60 * 24 * 30,
);
const USER_LOGIN_RATE_LIMIT_MAX = Number(process.env.USER_LOGIN_RATE_LIMIT_MAX || 10);
const USER_ROUTE_RATE_LIMIT_MAX = Number(process.env.USER_ROUTE_RATE_LIMIT_MAX || 90);
const DB_HOST = process.env.DB_HOST || process.env.MYSQL_HOST || "";
const DB_PORT = Number(process.env.DB_PORT || process.env.MYSQL_PORT || 3306);
const DB_USER = process.env.DB_USER || process.env.MYSQL_USER || "";
const DB_PASSWORD = process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD || "";
const DB_NAME =
  process.env.DB_NAME || process.env.MYSQL_DATABASE || "problems_co-moge-zjesc";
const DB_TABLE_RAW = process.env.DB_TABLE || "recipes";
const DB_CHARSET_RAW = process.env.DB_CHARSET || "utf8mb4";

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
const DB_CHARSET_CANDIDATE = safeIdentifier(DB_CHARSET_RAW, "utf8mb4").toLowerCase();
const DB_CHARSET =
  DB_CHARSET_CANDIDATE === "utf8" || DB_CHARSET_CANDIDATE === "utf8mb4"
    ? DB_CHARSET_CANDIDATE
    : "utf8mb4";
const DB_COLLATION = `${DB_CHARSET}_general_ci`;
const DB_MATCH_MIN_SCORE = 36;
const USERS_TABLE = safeIdentifier(process.env.USERS_TABLE || "users", "users");
const USER_FAVORITES_TABLE = safeIdentifier(
  process.env.USER_FAVORITES_TABLE || "user_favorites",
  "user_favorites",
);
const USER_SHOPPING_LISTS_TABLE = safeIdentifier(
  process.env.USER_SHOPPING_LISTS_TABLE || "user_shopping_lists",
  "user_shopping_lists",
);
const MAX_CHAT_IMAGE_BYTES = Number(process.env.CHAT_IMAGE_MAX_BYTES || 6 * 1024 * 1024);
const DEFAULT_RECIPE_CATEGORY = "Posilek";
const RECIPE_CATEGORIES = new Set(["Deser", "Posilek"]);
const GEMINI_MODEL_DISCOVERY_TTL_MS = 5 * 60 * 1000;
const MAX_HISTORY_ITEMS = Number(process.env.CHAT_HISTORY_MAX_ITEMS || 6);
const MAX_HISTORY_ITEM_CHARS = Number(process.env.CHAT_HISTORY_ITEM_MAX_CHARS || 700);
const CHAT_PROMPT_MAX_CHARS = Number(process.env.CHAT_PROMPT_MAX_CHARS || 1500);
const CHAT_FEEDBACK_MAX_ITEMS = Number(process.env.CHAT_FEEDBACK_MAX_ITEMS || 4000);
const CHAT_FEEDBACK_TEXT_MAX_CHARS = Number(process.env.CHAT_FEEDBACK_TEXT_MAX_CHARS || 600);
const RECIPE_TEXT_MAX_CHARS = Number(process.env.RECIPE_TEXT_MAX_CHARS || 8000);
const AI_HTTP_TIMEOUT_MS = Number(process.env.AI_HTTP_TIMEOUT_MS || 20_000);
const AI_HTTP_MAX_RETRIES = Number(process.env.AI_HTTP_MAX_RETRIES || 1);
const CHAT_OPTIONS_RATE_LIMIT_MAX = Number(process.env.CHAT_OPTIONS_RATE_LIMIT_MAX || 24);
const CHAT_PHOTO_RATE_LIMIT_MAX = Number(process.env.CHAT_PHOTO_RATE_LIMIT_MAX || 10);
const CHAT_FEEDBACK_RATE_LIMIT_MAX = Number(process.env.CHAT_FEEDBACK_RATE_LIMIT_MAX || 40);
const ADMIN_ROUTE_RATE_LIMIT_MAX = Number(process.env.ADMIN_ROUTE_RATE_LIMIT_MAX || 60);
const ADMIN_LOGIN_RATE_LIMIT_MAX = Number(process.env.ADMIN_LOGIN_RATE_LIMIT_MAX || 6);
const OPS_ALERT_WINDOW_MS = Number(process.env.OPS_ALERT_WINDOW_MS || 60_000);
const OPS_ALERT_COOLDOWN_MS = Number(process.env.OPS_ALERT_COOLDOWN_MS || 30_000);
const OPS_ALERT_HTTP_5XX_THRESHOLD = Number(process.env.OPS_ALERT_HTTP_5XX_THRESHOLD || 8);
const OPS_ALERT_HTTP_429_THRESHOLD = Number(process.env.OPS_ALERT_HTTP_429_THRESHOLD || 25);
const OPS_ALERT_BLOCKED_PROMPT_THRESHOLD = Number(
  process.env.OPS_ALERT_BLOCKED_PROMPT_THRESHOLD || 12,
);
const OPS_ALERT_SUSPICIOUS_UPLOAD_THRESHOLD = Number(
  process.env.OPS_ALERT_SUSPICIOUS_UPLOAD_THRESHOLD || 8,
);
const OPS_ALERT_READINESS_FAILURE_THRESHOLD = Number(
  process.env.OPS_ALERT_READINESS_FAILURE_THRESHOLD || 3,
);
const OPS_ALERT_AI_FAILURE_THRESHOLD = Number(process.env.OPS_ALERT_AI_FAILURE_THRESHOLD || 8);
const OPS_ALERT_WEBHOOK_URL = safeString(process.env.OPS_ALERT_WEBHOOK_URL || "");
const OPS_ALERT_WEBHOOK_TIMEOUT_MS = Number(process.env.OPS_ALERT_WEBHOOK_TIMEOUT_MS || 4_000);
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000);
const CHAT_SESSION_REQUEST_LIMIT = Number(process.env.CHAT_SESSION_REQUEST_LIMIT || 20);
const CHAT_SESSION_PHOTO_LIMIT = Number(process.env.CHAT_SESSION_PHOTO_LIMIT || 6);
const CHAT_FEEDBACK_SESSION_LIMIT = Number(process.env.CHAT_FEEDBACK_SESSION_LIMIT || 24);
const ANON_SESSION_IDLE_TTL_MS = Number(process.env.ANON_SESSION_IDLE_TTL_MS || 30 * 60 * 1000);
const ANON_SESSION_ABSOLUTE_TTL_MS = Number(
  process.env.ANON_SESSION_ABSOLUTE_TTL_MS || 24 * 60 * 60 * 1000,
);
const ANON_SESSION_COOLDOWN_MS = Number(process.env.ANON_SESSION_COOLDOWN_MS || 5 * 60 * 1000);
const ANON_SESSION_SECRET = process.env.ANON_SESSION_SECRET || process.env.SESSION_SECRET || "";
const SESSION_STORE_CLEANUP_INTERVAL_MS = Number(
  process.env.SESSION_STORE_CLEANUP_INTERVAL_MS || 60_000,
);
const ANON_SESSION_TABLE = safeIdentifier(process.env.ANON_SESSION_TABLE || "anonymous_sessions", "anonymous_sessions");
const ANON_SESSION_COOLDOWN_TABLE = safeIdentifier(
  process.env.ANON_SESSION_COOLDOWN_TABLE || "anonymous_session_cooldowns",
  "anonymous_session_cooldowns",
);
const ANON_SESSION_FILE_PATH =
  process.env.ANON_SESSION_FILE_PATH || path.join(storeDir, "anonymous-sessions.json");
const FEEDBACK_RETENTION_DAYS = Number(process.env.FEEDBACK_RETENTION_DAYS || 14);
const FEEDBACK_RETENTION_MS = Math.max(1, FEEDBACK_RETENTION_DAYS) * 24 * 60 * 60 * 1000;
const MAINTENANCE_MODE = /^(1|true|yes|on)$/i.test(String(process.env.MAINTENANCE_MODE || ""));
const MAINTENANCE_FLAG_FILE =
  process.env.MAINTENANCE_FLAG_FILE || path.join(storeDir, "maintenance.flag");
const MAINTENANCE_RETRY_AFTER_SECONDS = Number(
  process.env.MAINTENANCE_RETRY_AFTER_SECONDS || 120,
);
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const TRUST_PROXY = /^(1|true|yes|on)$/i.test(String(process.env.TRUST_PROXY || ""));
const COOKIE_SECURE = /^(1|true|yes|on)$/i.test(
  String(process.env.COOKIE_SECURE || (IS_PRODUCTION ? "true" : "false")),
);
const ANON_SESSION_COOKIE_NAME = COOKIE_SECURE ? "__Host-anon_session" : "anon_session";
const ADMIN_SESSION_COOKIE_NAME = COOKIE_SECURE ? "__Host-admin_session" : "admin_session";
const USER_SESSION_COOKIE_NAME = COOKIE_SECURE ? "__Host-user_session" : "user_session";
const ADMIN_SECURITY_READY = Boolean(ADMIN_PASSWORD) && SESSION_SECRET.length >= 32;
const USER_SECURITY_READY = USER_SESSION_SECRET.length >= 32;
const ALLOWED_CHAT_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);
const ALLOWED_CHAT_IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"]);
const BASE_SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Content-Security-Policy":
    "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self'",
};
if (IS_PRODUCTION) {
  BASE_SECURITY_HEADERS["Strict-Transport-Security"] =
    "max-age=63072000; includeSubDomains; preload";
}
const logger = createLogger({ service: "co-moge-zjesc-backend" });
const ipRateLimiter = createWindowRateLimiter({ defaultWindowMs: RATE_LIMIT_WINDOW_MS });
let dbPool = null;
let dbEnabled = false;
let dbLastError = "";
let geminiModelsCache = null;
let sessionStore = null;
let sessionManager = null;
let sessionCleanupInterval = null;

async function emitOpsAlertWebhook(alertPayload) {
  if (!OPS_ALERT_WEBHOOK_URL) return;

  try {
    await fetchWithTimeout(
      OPS_ALERT_WEBHOOK_URL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          source: "co-moge-zjesc-backend",
          ts: new Date().toISOString(),
          alert: alertPayload,
        }),
      },
      OPS_ALERT_WEBHOOK_TIMEOUT_MS,
    );
  } catch (error) {
    logger.warn("ops/alert", "Alert webhook delivery failed", {
      error: error instanceof Error ? error.message : String(error),
      eventType: alertPayload?.eventType || "",
    });
  }
}

const opsTelemetry = createOpsTelemetry({
  logger,
  onAlert: (payload) => {
    emitOpsAlertWebhook(payload).catch(() => {});
  },
  windowMs: OPS_ALERT_WINDOW_MS,
  cooldownMs: OPS_ALERT_COOLDOWN_MS,
  http5xxThreshold: OPS_ALERT_HTTP_5XX_THRESHOLD,
  http429Threshold: OPS_ALERT_HTTP_429_THRESHOLD,
  blockedPromptThreshold: OPS_ALERT_BLOCKED_PROMPT_THRESHOLD,
  suspiciousUploadThreshold: OPS_ALERT_SUSPICIOUS_UPLOAD_THRESHOLD,
  readinessFailureThreshold: OPS_ALERT_READINESS_FAILURE_THRESHOLD,
  aiUpstreamFailureThreshold: OPS_ALERT_AI_FAILURE_THRESHOLD,
});

function safeInt(value) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function safeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function safeLimitedString(value, maxChars) {
  return safeString(value).slice(0, Math.max(0, maxChars || 0));
}

function safeIdentifier(value, fallback) {
  return /^[A-Za-z0-9_]+$/.test(value) ? value : fallback;
}

function safeLink(value) {
  const raw = safeLimitedString(value, 1024);
  if (!raw) return "";

  const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "";
    }
    return raw;
  } catch {
    return "";
  }
}

function safeBool(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) return true;
    if (["0", "false", "no", "off"].includes(normalized)) return false;
  }
  return fallback;
}

function normalizeEmail(value) {
  return safeLimitedString(value, 190).toLowerCase();
}

function safeIsoDate(value) {
  const raw = safeString(value);
  if (!raw) return "";
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) return "";
  return new Date(parsed).toISOString();
}

function randomPassword(length = 16) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*?";
  let output = "";
  for (let i = 0; i < length; i += 1) {
    const randomIndex = crypto.randomInt(0, chars.length);
    output += chars[randomIndex];
  }
  return output;
}

function hashUserPassword(password) {
  const pass = safeLimitedString(password, 512);
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(pass, salt, 64);
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
}

function verifyUserPassword(password, passwordHash) {
  const stored = safeString(passwordHash);
  const parts = stored.split(":");
  if (parts.length !== 2) return false;

  const [saltHex, hashHex] = parts;
  if (!/^[a-f0-9]+$/i.test(saltHex) || !/^[a-f0-9]+$/i.test(hashHex)) {
    return false;
  }

  try {
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    const actual = crypto.scryptSync(safeLimitedString(password, 512), salt, expected.length);
    if (actual.length !== expected.length) return false;
    return crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function timingSafeStringEquals(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function getClientIp(req) {
  if (req?.context?.ip) {
    return safeString(req.context.ip) || "unknown";
  }
  if (TRUST_PROXY) {
    const forwardedFor = safeString(req?.headers?.["x-forwarded-for"]);
    if (forwardedFor) {
      const ip = forwardedFor.split(",")[0]?.trim();
      if (ip) return ip;
    }
  }
  return safeString(req?.socket?.remoteAddress) || "unknown";
}

function sessionIdHash(sessionId) {
  return hashValue(
    safeString(sessionId),
    ANON_SESSION_SECRET || SESSION_SECRET || "session-log-secret",
  );
}

function isMaintenanceModeActive() {
  if (MAINTENANCE_MODE) return true;
  return fs.existsSync(MAINTENANCE_FLAG_FILE);
}

function isMaintenanceBypassPath(pathname) {
  return (
    pathname === "/backend/health" ||
    pathname === "/backend/readiness" ||
    pathname === "/backend/admin/ops-metrics"
  );
}

function applyRateLimit(res, result, maxRequests) {
  res.setHeader("X-RateLimit-Limit", String(maxRequests));
  res.setHeader("X-RateLimit-Remaining", String(result.remaining));
  if (!result.allowed) {
    res.setHeader("Retry-After", String(result.retryAfterSeconds));
  }
}

function enforceRateLimit(req, res, scope, maxRequests, errorMessage) {
  const ip = getClientIp(req);
  ipRateLimiter.cleanup();
  const result = ipRateLimiter.consume(scope, ip, maxRequests, RATE_LIMIT_WINDOW_MS);
  applyRateLimit(res, result, maxRequests);
  if (result.allowed) return true;

  logger.warn("security", "IP rate limit exceeded", {
    requestId: req?.context?.requestId,
    scope,
    ipHash: hashValue(ip, ANON_SESSION_SECRET || SESSION_SECRET || "ip-rate-limit"),
    retryAfterSeconds: result.retryAfterSeconds,
  });

  sendJson(res, 429, {
    error: errorMessage || "Za duzo zapytan. Sprobuj ponownie za chwile.",
  });
  return false;
}

function shouldRequireJsonBody(req) {
  const method = req?.method || "GET";
  return method === "POST" || method === "PUT" || method === "PATCH";
}

function hasJsonContentType(req) {
  const contentType = safeString(req?.headers?.["content-type"]).toLowerCase();
  return contentType.startsWith("application/json");
}

function ensureJsonRequest(req, res) {
  if (!shouldRequireJsonBody(req)) return true;
  if (hasJsonContentType(req)) return true;

  sendJson(res, 415, { error: "Wymagany naglowek Content-Type: application/json." });
  return false;
}

function isSameOriginRequest(req) {
  const originHeader = safeString(req?.headers?.origin);
  if (!originHeader) return true;
  const hostHeader = safeString(req?.headers?.host).toLowerCase();
  if (!hostHeader) return false;

  try {
    const originUrl = new URL(originHeader);
    return originUrl.host.toLowerCase() === hostHeader;
  } catch {
    return false;
  }
}

function ensureSameOrigin(req, res) {
  if (isSameOriginRequest(req)) return true;
  sendJson(res, 403, { error: "Niedozwolone pochodzenie zapytania." });
  return false;
}

function mapJsonParseError(error) {
  const message = safeString(error?.message);
  if (message === "Payload too large") {
    return { status: 413, error: "Payload jest zbyt duzy." };
  }
  return { status: 400, error: "Bledne dane JSON." };
}

async function parseJsonBodyOrRespond(req, res) {
  if (!ensureJsonRequest(req, res)) {
    return null;
  }

  try {
    return await readJsonBody(req);
  } catch (error) {
    const mapped = mapJsonParseError(error);
    sendJson(res, mapped.status, { error: mapped.error });
    return null;
  }
}

async function resolveAnonymousSessionOrRespond(req, res) {
  if (!sessionManager) {
    sendJson(res, 503, { error: "Warstwa sesji nie jest gotowa." });
    return null;
  }

  const resolved = await sessionManager.resolveSession(req, res);
  if (!resolved?.ok) {
    if (resolved?.retryAfterSeconds) {
      res.setHeader("Retry-After", String(resolved.retryAfterSeconds));
    }
    logger.warn("auth/session", "Session resolve blocked", {
      requestId: req?.context?.requestId,
      code: resolved?.code || "SESSION_BLOCKED",
    });
    sendJson(res, resolved?.status || 429, { error: resolved?.message || "Sesja zablokowana." });
    return null;
  }

  return resolved.session;
}

async function enforceSessionQuotaOrRespond(req, res, session, quotaType) {
  const result = await sessionManager.enforceQuota(req, session, quotaType);
  if (result?.ok) {
    const headers = sessionManager.sessionHeaders(result.session);
    for (const [name, value] of Object.entries(headers)) {
      res.setHeader(name, value);
    }
    return result.session;
  }

  logger.warn("security", "Session quota exceeded", {
    requestId: req?.context?.requestId,
    code: result?.code || "SESSION_QUOTA",
    quotaType,
  });
  if (result?.retryAfterSeconds) {
    res.setHeader("Retry-After", String(result.retryAfterSeconds));
  }
  sendJson(res, result?.status || 429, { error: result?.message || "Limit sesji przekroczony." });
  return null;
}

function mapModelError(error, fallbackMessage) {
  const message = safeString(error?.message);
  const normalized = removeDiacritics(message.toLowerCase());
  if (normalized.includes("niepoprawny format") || normalized.includes("zdjecie jest zbyt duze")) {
    return { status: 400, message };
  }
  return { status: 502, message: fallbackMessage };
}

function isPromptTooLong(prompt) {
  return safeString(prompt).length > CHAT_PROMPT_MAX_CHARS;
}

function cookieSameSiteValue() {
  const raw = safeString(process.env.COOKIE_SAME_SITE || "Lax").toLowerCase();
  if (raw === "strict") return "Strict";
  if (raw === "none") return COOKIE_SECURE ? "None" : "Lax";
  return "Lax";
}

function adminCookieHeader(tokenValue, maxAgeSeconds) {
  const cookieParts = [
    `${ADMIN_SESSION_COOKIE_NAME}=${encodeURIComponent(tokenValue)}`,
    "Path=/",
    "HttpOnly",
    `SameSite=${cookieSameSiteValue()}`,
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (COOKIE_SECURE) {
    cookieParts.push("Secure");
  }
  return cookieParts.join("; ");
}

function clearAdminCookieHeader() {
  return adminCookieHeader("", 0);
}

function userCookieHeader(tokenValue, maxAgeSeconds = null) {
  const cookieParts = [
    `${USER_SESSION_COOKIE_NAME}=${encodeURIComponent(tokenValue)}`,
    "Path=/",
    "HttpOnly",
    `SameSite=${cookieSameSiteValue()}`,
  ];
  if (typeof maxAgeSeconds === "number") {
    cookieParts.push(`Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`);
  }
  if (COOKIE_SECURE) {
    cookieParts.push("Secure");
  }
  return cookieParts.join("; ");
}

function clearUserCookieHeader() {
  return userCookieHeader("", 0);
}

function truncateForModel(value, maxChars) {
  return safeLimitedString(value, maxChars).replace(/\s+/g, " ").trim();
}

function redactSensitiveText(value) {
  let text = truncateForModel(value, CHAT_PROMPT_MAX_CHARS);
  if (!text) return "";

  text = text.replace(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, "[email]");
  text = text.replace(/\b(?:\+?\d[\d\s().-]{7,}\d)\b/g, "[telefon]");
  text = text.replace(/\b(?:sk|gsk|AIza)[-_A-Za-z0-9]{10,}\b/g, "[secret]");
  return text;
}

function isPromptInjectionLike(value) {
  const normalized = removeDiacritics(truncateForModel(value, 600).toLowerCase());
  if (!normalized) return false;

  return (
    normalized.includes("ignore previous instructions") ||
    normalized.includes("zignoruj poprzednie instrukcje") ||
    normalized.includes("system prompt") ||
    normalized.includes("prompt systemowy") ||
    normalized.includes("pokaz sekrety") ||
    normalized.includes("pokaz .env") ||
    normalized.includes("api key") ||
    normalized.includes("admin_session") ||
    normalized.includes("session secret")
  );
}

function normalizeRecipeCategory(value) {
  const raw = safeString(value);
  const normalized = removeDiacritics(raw.toLowerCase());
  const canonical =
    normalized === "deser" ? "Deser" : normalized === "posilek" ? "Posilek" : raw;
  if (RECIPE_CATEGORIES.has(canonical)) return canonical;
  return DEFAULT_RECIPE_CATEGORY;
}

function filterRecipesByCategory(recipes, category) {
  const expected = normalizeRecipeCategory(category);
  if (!Array.isArray(recipes)) return [];
  return recipes.filter((recipe) => normalizeRecipeCategory(recipe?.kategoria) === expected);
}

function normalizePreparationTime(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const rounded = Math.max(0, Math.round(value));
    return `${rounded} minut`;
  }

  if (typeof value === "bigint") {
    const nonNegative = value < 0n ? 0n : value;
    return `${nonNegative.toString()} minut`;
  }

  const raw = safeString(value);
  if (!raw) return "";

  const compact = raw.replace(/\s+/g, " ").trim().replace(/[.,;:]+$/g, "");
  const normalized = removeDiacritics(compact.toLowerCase());

  const plainRange = normalized.match(/^(\d{1,4})\s*-\s*(\d{1,4})$/);
  if (plainRange) {
    return `${plainRange[1]}-${plainRange[2]} minut`;
  }

  const plainSingle = normalized.match(/^(\d{1,4})$/);
  if (plainSingle) {
    return `${plainSingle[1]} minut`;
  }

  const minuteRange = normalized.match(
    /^(\d{1,4})\s*-\s*(\d{1,4})\s*(m|min\.?|mins?|minut|minuty|minute|minutes)$/,
  );
  if (minuteRange) {
    return `${minuteRange[1]}-${minuteRange[2]} minut`;
  }

  const minuteSingle = normalized.match(
    /^(\d{1,4})\s*(m|min\.?|mins?|minut|minuty|minute|minutes)$/,
  );
  if (minuteSingle) {
    return `${minuteSingle[1]} minut`;
  }

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
    ...BASE_SECURITY_HEADERS,
    ...extraHeaders,
  });
  res.end(body);
}

function sendText(res, statusCode, text, extraHeaders = {}) {
  res.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=UTF-8",
    "Content-Length": Buffer.byteLength(text),
    "Cache-Control": "no-store",
    ...BASE_SECURITY_HEADERS,
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

    const fileName = path.basename(filePath);
    const immutableAsset = /-[A-Za-z0-9_-]{8,}\./.test(fileName);
    const headers = {
      "Content-Type": mimeFor(filePath),
      "Content-Length": content.length,
      "Cache-Control": immutableAsset
        ? "public, max-age=31536000, immutable"
        : "public, max-age=0, must-revalidate",
      ...BASE_SECURITY_HEADERS,
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
    const value = rest.join("=");
    try {
      acc[name] = decodeURIComponent(value);
    } catch {
      acc[name] = value;
    }
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
    users: [],
    userFavorites: [],
    userShoppingLists: [],
    nextRecipeId: 1,
    nextFeedbackId: 1,
    nextUserId: 1,
    nextFavoriteId: 1,
  };
}

function normalizeStore(raw) {
  const base = defaultStore();
  if (!raw || typeof raw !== "object") return base;

  const recipes = Array.isArray(raw.recipes) ? raw.recipes : [];
  const feedback = Array.isArray(raw.feedback) ? raw.feedback : [];
  const users = Array.isArray(raw.users) ? raw.users : [];
  const userFavorites = Array.isArray(raw.userFavorites) ? raw.userFavorites : [];
  const userShoppingLists = Array.isArray(raw.userShoppingLists) ? raw.userShoppingLists : [];

  const normalizedRecipes = recipes
    .map((recipe) => ({
      id: safeInt(recipe.id),
      nazwa: safeString(recipe.nazwa),
      skladniki: safeString(recipe.skladniki),
      opis: safeString(recipe.opis),
      czas: normalizePreparationTime(recipe.czas),
      kategoria: normalizeRecipeCategory(recipe.kategoria),
      tagi: safeString(recipe.tagi),
      link_filmu: safeLink(recipe.link_filmu),
      link_strony: safeLink(recipe.link_strony),
      meal_type: safeLimitedString(recipe.meal_type, 32).toLowerCase(),
      diet: safeLimitedString(recipe.diet, 32).toLowerCase() || "klasyczna",
      allergens: safeLimitedString(normalizeAllergens(recipe.allergens), 512),
      difficulty: safeLimitedString(recipe.difficulty, 32).toLowerCase(),
      servings: normalizeServings(recipe.servings),
      budget_level: safeLimitedString(recipe.budget_level, 32).toLowerCase(),
      status: safeLimitedString(recipe.status, 24).toLowerCase() || "roboczy",
      source: safeLimitedString(recipe.source, 24).toLowerCase() || "administrator",
      author_user_id: safeInt(recipe.author_user_id),
    }))
    .filter((recipe) => recipe.id !== null)
    .sort((left, right) => left.id - right.id);

  const maxRecipeId = normalizedRecipes.reduce((max, recipe) => Math.max(max, recipe.id), 0);
  const normalizedFeedback = feedback
    .map((row) => ({
      id: safeInt(row?.id),
      ts: safeLimitedString(row?.ts, 64),
      user_text: safeLimitedString(row?.user_text, CHAT_FEEDBACK_TEXT_MAX_CHARS),
      option1_title: safeLimitedString(row?.option1_title, 160),
      option1_recipe_id: safeInt(row?.option1_recipe_id),
      option2_title: safeLimitedString(row?.option2_title, 160),
      option2_recipe_id: safeInt(row?.option2_recipe_id),
      action: safeLimitedString(row?.action, 40),
      chosen_index: safeInt(row?.chosen_index),
      follow_up_answer: safeLimitedString(row?.follow_up_answer, CHAT_FEEDBACK_TEXT_MAX_CHARS),
    }))
    .filter((row) => row.id !== null)
    .slice(-CHAT_FEEDBACK_MAX_ITEMS);

  const normalizedUsers = users
    .map((user) => ({
      id: safeInt(user?.id),
      username: safeLimitedString(user?.username, 64),
      email: normalizeEmail(user?.email),
      password_hash: safeLimitedString(user?.password_hash, 255),
      status: safeLimitedString(user?.status, 24).toLowerCase() || "aktywny",
      role: safeLimitedString(user?.role, 24).toLowerCase() || "user",
      created_at: safeIsoDate(user?.created_at) || new Date().toISOString(),
      updated_at: safeIsoDate(user?.updated_at) || new Date().toISOString(),
      last_login_at: safeIsoDate(user?.last_login_at),
    }))
    .filter((user) => user.id !== null && user.username && user.email && user.password_hash)
    .sort((left, right) => left.id - right.id);

  const normalizedFavorites = userFavorites
    .map((favorite) => ({
      id: safeInt(favorite?.id),
      user_id: safeInt(favorite?.user_id),
      recipe_id: safeInt(favorite?.recipe_id),
      title: safeLimitedString(favorite?.title, 255),
      short_description: safeLimitedString(favorite?.short_description, 600),
      prep_time: safeLimitedString(favorite?.prep_time, 80),
      category: normalizeRecipeCategory(favorite?.category),
      saved_at: safeIsoDate(favorite?.saved_at) || new Date().toISOString(),
    }))
    .filter((favorite) => favorite.id !== null && favorite.user_id !== null && favorite.title)
    .sort((left, right) => right.id - left.id);

  const normalizedShoppingLists = userShoppingLists
    .map((list) => ({
      user_id: safeInt(list?.user_id),
      recipe_title: safeLimitedString(list?.recipe_title, 255),
      items_json: JSON.stringify(
        normalizeUserListItems(
          Array.isArray(list?.items_json)
            ? list.items_json
            : Array.isArray(list?.items)
              ? list.items
              : safeString(list?.items_json)
                ? (() => {
                    try {
                      const parsed = JSON.parse(safeString(list.items_json));
                      return Array.isArray(parsed) ? parsed : [];
                    } catch {
                      return [];
                    }
                  })()
                : [],
          200,
          200,
        ),
      ),
      saved_at: safeIsoDate(list?.saved_at) || new Date().toISOString(),
      updated_at: safeIsoDate(list?.updated_at) || new Date().toISOString(),
    }))
    .filter((list) => list.user_id !== null);

  const maxFeedbackId = normalizedFeedback.reduce(
    (max, row) => Math.max(max, safeInt(row.id) || 0),
    0,
  );
  const maxUserId = normalizedUsers.reduce((max, user) => Math.max(max, safeInt(user.id) || 0), 0);
  const maxFavoriteId = normalizedFavorites.reduce(
    (max, favorite) => Math.max(max, safeInt(favorite.id) || 0),
    0,
  );

  return {
    recipes: normalizedRecipes,
    feedback: normalizedFeedback,
    users: normalizedUsers,
    userFavorites: normalizedFavorites,
    userShoppingLists: normalizedShoppingLists,
    nextRecipeId: Math.max(safeInt(raw.nextRecipeId) || 1, maxRecipeId + 1),
    nextFeedbackId: Math.max(safeInt(raw.nextFeedbackId) || 1, maxFeedbackId + 1),
    nextUserId: Math.max(safeInt(raw.nextUserId) || 1, maxUserId + 1),
    nextFavoriteId: Math.max(safeInt(raw.nextFavoriteId) || 1, maxFavoriteId + 1),
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
    logger.warn("app", "Store load error, fallback to empty store", {
      error: error instanceof Error ? error.message : String(error),
    });
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

async function addColumnIfMissing(tableName, columnName, definitionSql) {
  if (!dbPool) return;
  try {
    await dbPool.query(
      `ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${definitionSql}`,
    );
  } catch (error) {
    if (!(error && error.code === "ER_DUP_FIELDNAME")) {
      throw error;
    }
  }
}

async function addIndexIfMissing(tableName, indexName, columnsSql) {
  if (!dbPool) return;
  try {
    await dbPool.query(
      `ALTER TABLE \`${tableName}\` ADD INDEX \`${indexName}\` (${columnsSql})`,
    );
  } catch (error) {
    if (!(error && (error.code === "ER_DUP_KEYNAME" || error.code === "ER_MULTIPLE_KEY"))) {
      throw error;
    }
  }
}

async function initDatabase() {
  if (!hasDbConfig()) {
    dbLastError = "Missing DB_HOST or DB_USER.";
    logger.warn("app", "Missing DB config, fallback to file store", {
      dbHostConfigured: Boolean(DB_HOST),
      dbUserConfigured: Boolean(DB_USER),
    });
    return;
  }

  if (!mysql) {
    dbLastError = "mysql2 module is missing.";
    logger.warn("app", "mysql2 module missing, fallback to file store");
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

    const createRecipesSql = `
      CREATE TABLE IF NOT EXISTS \`${DB_TABLE}\` (
        id INT NOT NULL AUTO_INCREMENT,
        nazwa VARCHAR(255) NOT NULL,
        czas VARCHAR(255) NOT NULL DEFAULT '',
        skladniki TEXT NOT NULL,
        opis TEXT NOT NULL,
        kategoria VARCHAR(32) NOT NULL DEFAULT '${DEFAULT_RECIPE_CATEGORY}',
        tagi VARCHAR(512) NOT NULL DEFAULT '',
        link_filmu VARCHAR(1024) NOT NULL DEFAULT '',
        link_strony VARCHAR(1024) NOT NULL DEFAULT '',
        meal_type VARCHAR(32) NOT NULL DEFAULT '',
        diet VARCHAR(32) NOT NULL DEFAULT 'klasyczna',
        allergens VARCHAR(512) NOT NULL DEFAULT '',
        difficulty VARCHAR(32) NOT NULL DEFAULT '',
        servings INT NULL DEFAULT NULL,
        budget_level VARCHAR(32) NOT NULL DEFAULT '',
        status VARCHAR(24) NOT NULL DEFAULT 'roboczy',
        source VARCHAR(24) NOT NULL DEFAULT 'administrator',
        author_user_id INT NULL DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=${DB_CHARSET} COLLATE=${DB_COLLATION};
    `;
    await dbPool.query(createRecipesSql);

    await addColumnIfMissing(
      DB_TABLE,
      "kategoria",
      `VARCHAR(32) NOT NULL DEFAULT '${DEFAULT_RECIPE_CATEGORY}' AFTER opis`,
    );
    await addColumnIfMissing(DB_TABLE, "meal_type", "VARCHAR(32) NOT NULL DEFAULT ''");
    await addColumnIfMissing(DB_TABLE, "diet", "VARCHAR(32) NOT NULL DEFAULT 'klasyczna'");
    await addColumnIfMissing(DB_TABLE, "allergens", "VARCHAR(512) NOT NULL DEFAULT ''");
    await addColumnIfMissing(DB_TABLE, "difficulty", "VARCHAR(32) NOT NULL DEFAULT ''");
    await addColumnIfMissing(DB_TABLE, "servings", "INT NULL DEFAULT NULL");
    await addColumnIfMissing(DB_TABLE, "budget_level", "VARCHAR(32) NOT NULL DEFAULT ''");
    await addColumnIfMissing(DB_TABLE, "status", "VARCHAR(24) NOT NULL DEFAULT 'roboczy'");
    await addColumnIfMissing(DB_TABLE, "source", "VARCHAR(24) NOT NULL DEFAULT 'administrator'");
    await addColumnIfMissing(DB_TABLE, "author_user_id", "INT NULL DEFAULT NULL");

    // Stabilize schema for existing deployments.
    await dbPool.query(
      `ALTER TABLE \`${DB_TABLE}\` MODIFY COLUMN kategoria VARCHAR(32) NOT NULL DEFAULT '${DEFAULT_RECIPE_CATEGORY}'`,
    );
    await dbPool.query(
      `ALTER TABLE \`${DB_TABLE}\` MODIFY COLUMN status VARCHAR(24) NOT NULL DEFAULT 'roboczy'`,
    );
    await dbPool.query(
      `ALTER TABLE \`${DB_TABLE}\` MODIFY COLUMN source VARCHAR(24) NOT NULL DEFAULT 'administrator'`,
    );
    await dbPool.query(`UPDATE \`${DB_TABLE}\` SET status = 'roboczy' WHERE status IS NULL OR status = ''`);
    await dbPool.query(
      `UPDATE \`${DB_TABLE}\` SET source = 'administrator' WHERE source IS NULL OR source = ''`,
    );
    await addIndexIfMissing(DB_TABLE, "idx_recipe_status", "`status`");
    await addIndexIfMissing(DB_TABLE, "idx_recipe_source", "`source`");
    await addIndexIfMissing(DB_TABLE, "idx_recipe_author", "`author_user_id`");

    const createUsersSql = `
      CREATE TABLE IF NOT EXISTS \`${USERS_TABLE}\` (
        id INT NOT NULL AUTO_INCREMENT,
        username VARCHAR(64) NOT NULL,
        email VARCHAR(190) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        status VARCHAR(24) NOT NULL DEFAULT 'aktywny',
        role VARCHAR(24) NOT NULL DEFAULT 'user',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        last_login_at TIMESTAMP NULL DEFAULT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uniq_users_email (email)
      ) ENGINE=InnoDB DEFAULT CHARSET=${DB_CHARSET} COLLATE=${DB_COLLATION};
    `;
    await dbPool.query(createUsersSql);

    await addColumnIfMissing(USERS_TABLE, "status", "VARCHAR(24) NOT NULL DEFAULT 'aktywny'");
    await addColumnIfMissing(USERS_TABLE, "role", "VARCHAR(24) NOT NULL DEFAULT 'user'");
    await addColumnIfMissing(USERS_TABLE, "last_login_at", "TIMESTAMP NULL DEFAULT NULL");
    await dbPool.query(
      `ALTER TABLE \`${USERS_TABLE}\` MODIFY COLUMN status VARCHAR(24) NOT NULL DEFAULT 'aktywny'`,
    );
    await dbPool.query(
      `ALTER TABLE \`${USERS_TABLE}\` MODIFY COLUMN role VARCHAR(24) NOT NULL DEFAULT 'user'`,
    );
    await addIndexIfMissing(USERS_TABLE, "idx_users_status", "`status`");

    const createFavoritesSql = `
      CREATE TABLE IF NOT EXISTS \`${USER_FAVORITES_TABLE}\` (
        id INT NOT NULL AUTO_INCREMENT,
        user_id INT NOT NULL,
        recipe_id INT NULL DEFAULT NULL,
        title VARCHAR(255) NOT NULL,
        short_description VARCHAR(600) NOT NULL DEFAULT '',
        prep_time VARCHAR(80) NOT NULL DEFAULT '',
        category VARCHAR(32) NOT NULL DEFAULT '${DEFAULT_RECIPE_CATEGORY}',
        saved_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=${DB_CHARSET} COLLATE=${DB_COLLATION};
    `;
    await dbPool.query(createFavoritesSql);
    await addIndexIfMissing(USER_FAVORITES_TABLE, "idx_favorites_user", "`user_id`");
    await addIndexIfMissing(USER_FAVORITES_TABLE, "idx_favorites_recipe", "`recipe_id`");

    const createShoppingSql = `
      CREATE TABLE IF NOT EXISTS \`${USER_SHOPPING_LISTS_TABLE}\` (
        user_id INT NOT NULL,
        recipe_title VARCHAR(255) NOT NULL DEFAULT '',
        items_json TEXT NOT NULL,
        saved_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=${DB_CHARSET} COLLATE=${DB_COLLATION};
    `;
    await dbPool.query(createShoppingSql);
    await addColumnIfMissing(USER_SHOPPING_LISTS_TABLE, "updated_at", "TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");

    dbEnabled = true;
    dbLastError = "";
    logger.info("app", "Connected to MySQL", {
      dbName: DB_NAME,
      dbTable: DB_TABLE,
      dbHost: DB_HOST,
      dbPort: DB_PORT,
    });
  } catch (error) {
    dbEnabled = false;
    dbLastError = error instanceof Error ? error.message : String(error);
    logger.warn("app", "MySQL init failed, fallback to file store", {
      error: dbLastError,
    });
  }
}

async function initAnonymousSessionLayer() {
  sessionStore = await createSessionStore({
    logger,
    mysqlPool: dbEnabled && dbPool ? dbPool : null,
    sessionsFilePath: ANON_SESSION_FILE_PATH,
    sessionsTable: ANON_SESSION_TABLE,
    cooldownsTable: ANON_SESSION_COOLDOWN_TABLE,
  });

  sessionManager = createSessionManager({
    store: sessionStore,
    logger,
    cookieName: ANON_SESSION_COOKIE_NAME,
    cookieSecret: ANON_SESSION_SECRET || SESSION_SECRET,
    secureCookie: COOKIE_SECURE,
    sameSite: process.env.COOKIE_SAME_SITE || "Lax",
    idleTtlMs: ANON_SESSION_IDLE_TTL_MS,
    absoluteTtlMs: ANON_SESSION_ABSOLUTE_TTL_MS,
    chatQuota: CHAT_SESSION_REQUEST_LIMIT,
    photoQuota: CHAT_SESSION_PHOTO_LIMIT,
    feedbackQuota: CHAT_FEEDBACK_SESSION_LIMIT,
    cooldownMs: ANON_SESSION_COOLDOWN_MS,
    ipHashSecret: ANON_SESSION_SECRET || SESSION_SECRET,
    redisReady: process.env.SESSION_REDIS_ENABLED || "",
  });

  if (sessionCleanupInterval) {
    clearInterval(sessionCleanupInterval);
  }
  sessionCleanupInterval = setInterval(() => {
    sessionManager
      .cleanupExpiredSessions()
      .catch((error) => {
        logger.warn("auth/session", "Session cleanup failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      });
  }, SESSION_STORE_CLEANUP_INTERVAL_MS);
  if (typeof sessionCleanupInterval.unref === "function") {
    sessionCleanupInterval.unref();
  }
}

function mapRecipeRow(row) {
  return {
    id: safeInt(row.id),
    nazwa: safeString(row.nazwa),
    skladniki: safeString(row.skladniki),
    opis: safeString(row.opis),
    czas: normalizePreparationTime(row.czas),
    kategoria: normalizeRecipeCategory(row.kategoria),
    tagi: safeString(row.tagi),
    link_filmu: safeLink(row.link_filmu),
    link_strony: safeLink(row.link_strony),
    meal_type: safeString(row.meal_type),
    diet: safeString(row.diet) || "klasyczna",
    allergens: safeString(row.allergens),
    difficulty: safeString(row.difficulty),
    servings: normalizeServings(row.servings),
    budget_level: safeString(row.budget_level),
    status: normalizeRecipeStatus(row.status),
    source: normalizeRecipeSource(row.source),
    author_user_id: safeInt(row.author_user_id),
  };
}

async function listRecipesDesc() {
  if (dbEnabled && dbPool) {
    const [rows] = await dbPool.query(
      `SELECT id, nazwa, skladniki, opis, czas, kategoria, tagi, link_filmu, link_strony,
              meal_type, diet, allergens, difficulty, servings, budget_level, status, source, author_user_id
       FROM \`${DB_TABLE}\`
       ORDER BY id DESC`,
    );

    return rows.map(mapRecipeRow).filter((row) => row.id !== null);
  }

  return [...store.recipes]
    .map(mapRecipeRow)
    .filter((row) => row.id !== null)
    .sort((left, right) => right.id - left.id);
}

async function getRecipeById(recipeId) {
  if (dbEnabled && dbPool) {
    const [rows] = await dbPool.query(
      `SELECT id, nazwa, skladniki, opis, czas, kategoria, tagi, link_filmu, link_strony,
              meal_type, diet, allergens, difficulty, servings, budget_level, status, source, author_user_id
       FROM \`${DB_TABLE}\`
       WHERE id = ?
       LIMIT 1`,
      [recipeId],
    );
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return mapRecipeRow(rows[0]);
  }

  const recipe = store.recipes.find((item) => item.id === recipeId) || null;
  if (!recipe) return null;
  return mapRecipeRow(recipe);
}

const RECIPE_MEAL_TYPES = new Set(["sniadanie", "lunch", "obiad", "kolacja", "przekaska", "deser"]);
const RECIPE_DIETS = new Set(["klasyczna", "wegetarianska", "weganska", "bez_glutenu", "bez_laktozy"]);
const RECIPE_DIFFICULTIES = new Set(["latwe", "srednie", "trudne"]);
const RECIPE_BUDGET_LEVELS = new Set(["niski", "sredni", "wysoki"]);
const RECIPE_STATUSES = new Set(["roboczy", "weryfikacja", "opublikowany", "archiwalny"]);
const RECIPE_SOURCES = new Set(["administrator", "uzytkownik", "internet"]);
const KNOWN_ALLERGENS = new Set(["gluten", "laktoza", "orzechy", "jaja", "soja", "ryby", "skorupiaki", "seler", "gorczyca", "sezam", "lupiny", "mięczaki"]);
const USER_STATUSES = new Set(["aktywny", "zawieszony"]);
const USER_ROLES = new Set(["user", "admin"]);

function normalizeMealType(value) {
  const raw = removeDiacritics(safeString(value).toLowerCase());
  return RECIPE_MEAL_TYPES.has(raw) ? raw : "";
}

function normalizeDiet(value) {
  const raw = removeDiacritics(safeString(value).toLowerCase());
  return RECIPE_DIETS.has(raw) ? raw : "klasyczna";
}

function normalizeDifficulty(value) {
  const raw = removeDiacritics(safeString(value).toLowerCase());
  return RECIPE_DIFFICULTIES.has(raw) ? raw : "";
}

function normalizeBudgetLevel(value) {
  const raw = removeDiacritics(safeString(value).toLowerCase());
  return RECIPE_BUDGET_LEVELS.has(raw) ? raw : "";
}

function normalizeRecipeStatus(value) {
  const raw = removeDiacritics(safeString(value).toLowerCase());
  return RECIPE_STATUSES.has(raw) ? raw : "roboczy";
}

function normalizeRecipeSource(value) {
  const raw = removeDiacritics(safeString(value).toLowerCase());
  return RECIPE_SOURCES.has(raw) ? raw : "administrator";
}

function normalizeUserStatus(value) {
  const raw = removeDiacritics(safeString(value).toLowerCase());
  return USER_STATUSES.has(raw) ? raw : "aktywny";
}

function normalizeUserRole(value) {
  const raw = removeDiacritics(safeString(value).toLowerCase());
  return USER_ROLES.has(raw) ? raw : "user";
}

function normalizeAllergens(value) {
  if (typeof value === "string") {
    return value.split(/[,;]+/).map(a => a.trim().toLowerCase()).filter(a => a).join(", ");
  }
  if (Array.isArray(value)) {
    return value.map(a => safeString(a).toLowerCase()).filter(Boolean).join(", ");
  }
  return "";
}

function normalizeServings(value) {
  const num = typeof value === "number" ? value : Number.parseInt(String(value), 10);
  if (!Number.isFinite(num) || num < 1) return null;
  return Math.min(Math.round(num), 100);
}

function validateRecipePayload(payload) {
  const errors = {};
  const nazwa = safeString(payload?.nazwa);
  if (!nazwa) {
    errors.nazwa = "Nazwa dania jest wymagana.";
  } else if (nazwa.length < 3) {
    errors.nazwa = "Nazwa musi mieć min. 3 znaki.";
  } else if (nazwa.length > 100) {
    errors.nazwa = "Nazwa może mieć maks. 100 znaków.";
  }

  if (!safeString(payload?.skladniki)) {
    errors.skladniki = "Lista składników jest wymagana.";
  }

  const czasRaw = safeString(payload?.czas);
  if (!czasRaw) {
    errors.czas = "Czas przygotowania jest wymagany.";
  } else {
    const num = Number.parseInt(czasRaw.replace(/[^\d]/g, ""), 10);
    if (!Number.isFinite(num) || num < 1 || num > 600) {
      errors.czas = "Czas musi być liczbą od 1 do 600 minut.";
    }
  }

  const opis = safeString(payload?.opis);
  if (!opis || !/krok\s*\d/i.test(opis)) {
    const stepsArr = opis ? opis.split(/\r?\n/).filter(l => l.trim()) : [];
    if (stepsArr.length === 0) {
      errors.opis = "Minimum 1 krok przepisu jest wymagany.";
    }
  }

  const tags = safeString(payload?.tagi)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (tags.length === 0) {
    errors.tagi = "Minimum 1 tag przepisu jest wymagany.";
  }

  const linkFilmu = safeString(payload?.link_filmu);
  if (linkFilmu && !safeLink(linkFilmu)) {
    errors.link_filmu = "Niepoprawny URL filmu.";
  }

  const linkStrony = safeString(payload?.link_strony);
  if (linkStrony && !safeLink(linkStrony)) {
    errors.link_strony = "Niepoprawny URL strony.";
  }

  const rawStatus = removeDiacritics(safeString(payload?.status).toLowerCase());
  if (rawStatus && !RECIPE_STATUSES.has(rawStatus)) {
    errors.status = "Niepoprawny status przepisu.";
  }

  const rawSource = removeDiacritics(safeString(payload?.source).toLowerCase());
  if (rawSource && !RECIPE_SOURCES.has(rawSource)) {
    errors.source = "Niepoprawne źródło przepisu.";
  }

  return Object.keys(errors).length > 0 ? errors : null;
}

function normalizeRecipePayload(payload) {
  return {
    nazwa: safeLimitedString(payload?.nazwa, 255),
    skladniki: safeLimitedString(payload?.skladniki, RECIPE_TEXT_MAX_CHARS),
    opis: safeLimitedString(payload?.opis, RECIPE_TEXT_MAX_CHARS),
    czas: normalizePreparationTime(payload?.czas),
    kategoria: normalizeRecipeCategory(payload?.kategoria),
    tagi: safeLimitedString(payload?.tagi, 512),
    link_filmu: safeLink(payload?.link_filmu),
    link_strony: safeLink(payload?.link_strony),
    meal_type: normalizeMealType(payload?.meal_type),
    diet: normalizeDiet(payload?.diet),
    allergens: safeLimitedString(normalizeAllergens(payload?.allergens), 512),
    difficulty: normalizeDifficulty(payload?.difficulty),
    servings: normalizeServings(payload?.servings),
    budget_level: normalizeBudgetLevel(payload?.budget_level),
    status: normalizeRecipeStatus(payload?.status),
    source: normalizeRecipeSource(payload?.source),
    author_user_id: safeInt(payload?.author_user_id),
  };
}

async function addRecipe(payload) {
  const recipe = normalizeRecipePayload(payload);
  if (dbEnabled && dbPool) {
    const [result] = await dbPool.query(
      `INSERT INTO \`${DB_TABLE}\`
      (nazwa, czas, skladniki, opis, kategoria, tagi, link_filmu, link_strony,
       meal_type, diet, allergens, difficulty, servings, budget_level, status, source, author_user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        recipe.nazwa,
        recipe.czas,
        recipe.skladniki,
        recipe.opis,
        recipe.kategoria,
        recipe.tagi,
        recipe.link_filmu,
        recipe.link_strony,
        recipe.meal_type,
        recipe.diet,
        recipe.allergens,
        recipe.difficulty,
        recipe.servings,
        recipe.budget_level,
        recipe.status,
        recipe.source,
        recipe.author_user_id,
      ],
    );
    return getRecipeById(result.insertId);
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
       SET nazwa = ?, czas = ?, skladniki = ?, opis = ?, kategoria = ?, tagi = ?, link_filmu = ?, link_strony = ?,
           meal_type = ?, diet = ?, allergens = ?, difficulty = ?, servings = ?, budget_level = ?, status = ?, source = ?
       WHERE id = ?`,
      [
        next.nazwa,
        next.czas,
        next.skladniki,
        next.opis,
        next.kategoria,
        next.tagi,
        next.link_filmu,
        next.link_strony,
        next.meal_type,
        next.diet,
        next.allergens,
        next.difficulty,
        next.servings,
        next.budget_level,
        next.status,
        next.source,
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
  recipe.kategoria = next.kategoria;
  recipe.tagi = next.tagi;
  recipe.link_filmu = next.link_filmu;
  recipe.link_strony = next.link_strony;
  recipe.meal_type = next.meal_type;
  recipe.diet = next.diet;
  recipe.allergens = next.allergens;
  recipe.difficulty = next.difficulty;
  recipe.servings = next.servings;
  recipe.budget_level = next.budget_level;
  recipe.status = next.status;
  recipe.source = next.source;
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
  if (!ADMIN_SECURITY_READY) {
    throw new Error("Admin auth is not configured securely.");
  }

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
  if (!ADMIN_SECURITY_READY) return false;
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
  return verifyAdminToken(cookies[ADMIN_SESSION_COOKIE_NAME]);
}

function requireAdmin(req, res) {
  if (
    !enforceRateLimit(
      req,
      res,
      "admin-route",
      ADMIN_ROUTE_RATE_LIMIT_MAX,
      "Zbyt wiele zapytan administracyjnych. Sprobuj ponownie pozniej.",
    )
  ) {
    return false;
  }

  if (!ADMIN_SECURITY_READY) {
    logger.warn("admin", "Admin route blocked: admin auth disabled", {
      requestId: req?.context?.requestId,
    });
    sendJson(res, 503, {
      error: "Logowanie admina jest wylaczone: skonfiguruj ADMIN_PASSWORD i ADMIN_SESSION_SECRET.",
    });
    return false;
  }
  if (isAdminRequest(req)) return true;
  logger.warn("admin", "Admin route unauthorized", {
    requestId: req?.context?.requestId,
    ipHash: hashValue(getClientIp(req), ANON_SESSION_SECRET || SESSION_SECRET || "admin-ip"),
  });
  sendJson(res, 401, { error: "Wymagane logowanie admina." });
  return false;
}

function createUserToken(userId, rememberMe = false) {
  if (!USER_SECURITY_READY) {
    throw new Error("User auth is not configured securely.");
  }

  const ttlSeconds = rememberMe ? USER_SESSION_REMEMBER_TTL_SECONDS : USER_SESSION_TTL_SECONDS;
  const payload = {
    role: "user",
    uid: userId,
    remember: Boolean(rememberMe),
    exp: Date.now() + ttlSeconds * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = crypto
    .createHmac("sha256", USER_SESSION_SECRET)
    .update(encoded)
    .digest("base64url");

  return {
    token: `${encoded}.${signature}`,
    maxAgeSeconds: rememberMe ? ttlSeconds : null,
  };
}

function verifyUserToken(token) {
  if (!USER_SECURITY_READY) return null;
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [encoded, signature] = parts;
  const expected = crypto
    .createHmac("sha256", USER_SESSION_SECRET)
    .update(encoded)
    .digest("base64url");

  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return null;
  if (!crypto.timingSafeEqual(left, right)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (!payload || payload.role !== "user") return null;
    const userId = safeInt(payload.uid);
    if (userId === null) return null;
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    return {
      userId,
      remember: Boolean(payload.remember),
    };
  } catch {
    return null;
  }
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateUserRegistrationPayload(payload) {
  const username = safeLimitedString(payload?.username, 64);
  const email = normalizeEmail(payload?.email);
  const password = safeLimitedString(payload?.password, 256);

  if (!username || username.length < 3) {
    return { ok: false, status: 400, error: "Nazwa użytkownika musi mieć min. 3 znaki." };
  }
  if (!email || !isValidEmail(email)) {
    return { ok: false, status: 400, error: "Podaj poprawny adres e-mail." };
  }
  if (!password || password.length < 6) {
    return { ok: false, status: 400, error: "Hasło musi mieć min. 6 znaków." };
  }

  return {
    ok: true,
    value: { username, email, password },
  };
}

function validateUserLoginPayload(payload) {
  const email = normalizeEmail(payload?.email);
  const password = safeLimitedString(payload?.password, 256);
  const rememberMe = safeBool(payload?.rememberMe, false);

  if (!email || !isValidEmail(email)) {
    return { ok: false, status: 400, error: "Podaj poprawny adres e-mail." };
  }
  if (!password) {
    return { ok: false, status: 400, error: "Podaj hasło." };
  }
  return {
    ok: true,
    value: { email, password, rememberMe },
  };
}

function mapUserRow(row) {
  return {
    id: safeInt(row?.id),
    username: safeLimitedString(row?.username, 64),
    email: normalizeEmail(row?.email),
    password_hash: safeLimitedString(row?.password_hash, 255),
    status: normalizeUserStatus(row?.status),
    role: normalizeUserRole(row?.role),
    created_at: safeIsoDate(row?.created_at) || new Date().toISOString(),
    updated_at: safeIsoDate(row?.updated_at) || new Date().toISOString(),
    last_login_at: safeIsoDate(row?.last_login_at),
  };
}

function toUserSessionProfile(userRow) {
  return {
    id: safeInt(userRow?.id),
    username: safeString(userRow?.username),
    email: normalizeEmail(userRow?.email),
    status: normalizeUserStatus(userRow?.status),
  };
}

function toAdminUserSummary(userRow) {
  return {
    id: safeInt(userRow?.id),
    username: safeString(userRow?.username),
    email: normalizeEmail(userRow?.email),
    registeredAt: safeIsoDate(userRow?.created_at) || new Date().toISOString(),
    status: normalizeUserStatus(userRow?.status),
  };
}

async function getUserByEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;

  if (dbEnabled && dbPool) {
    const [rows] = await dbPool.query(
      `SELECT id, username, email, password_hash, status, role, created_at, updated_at, last_login_at
       FROM \`${USERS_TABLE}\`
       WHERE email = ?
       LIMIT 1`,
      [normalizedEmail],
    );
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return mapUserRow(rows[0]);
  }

  return (
    store.users.find((user) => normalizeEmail(user.email) === normalizedEmail) || null
  );
}

async function getUserById(userId) {
  const parsedId = safeInt(userId);
  if (parsedId === null) return null;

  if (dbEnabled && dbPool) {
    const [rows] = await dbPool.query(
      `SELECT id, username, email, password_hash, status, role, created_at, updated_at, last_login_at
       FROM \`${USERS_TABLE}\`
       WHERE id = ?
       LIMIT 1`,
      [parsedId],
    );
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return mapUserRow(rows[0]);
  }

  return store.users.find((user) => user.id === parsedId) || null;
}

async function createUserAccount({ username, email, password }) {
  const existing = await getUserByEmail(email);
  if (existing) {
    return {
      ok: false,
      status: 409,
      error: "Użytkownik z tym adresem e-mail już istnieje.",
    };
  }

  const passwordHash = hashUserPassword(password);
  if (dbEnabled && dbPool) {
    const [result] = await dbPool.query(
      `INSERT INTO \`${USERS_TABLE}\` (username, email, password_hash, status, role)
       VALUES (?, ?, ?, 'aktywny', 'user')`,
      [username, email, passwordHash],
    );
    const created = await getUserById(result.insertId);
    return { ok: true, user: created };
  }

  const now = new Date().toISOString();
  const user = {
    id: store.nextUserId,
    username,
    email,
    password_hash: passwordHash,
    status: "aktywny",
    role: "user",
    created_at: now,
    updated_at: now,
    last_login_at: "",
  };
  store.nextUserId += 1;
  store.users.push(user);
  persistStore();
  return { ok: true, user };
}

async function markUserLogin(userId) {
  const parsedId = safeInt(userId);
  if (parsedId === null) return;

  if (dbEnabled && dbPool) {
    await dbPool.query(`UPDATE \`${USERS_TABLE}\` SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?`, [
      parsedId,
    ]);
    return;
  }

  const user = store.users.find((row) => row.id === parsedId);
  if (!user) return;
  user.last_login_at = new Date().toISOString();
  user.updated_at = new Date().toISOString();
  persistStore();
}

async function listUsersForAdmin() {
  if (dbEnabled && dbPool) {
    const [rows] = await dbPool.query(
      `SELECT id, username, email, status, role, created_at, updated_at, last_login_at
       FROM \`${USERS_TABLE}\`
       ORDER BY id DESC`,
    );
    return rows.map(toAdminUserSummary);
  }

  return [...store.users].map(toAdminUserSummary).sort((left, right) => right.id - left.id);
}

async function updateUserSuspendedState(userId, suspended) {
  const parsedId = safeInt(userId);
  if (parsedId === null) return null;
  const status = suspended ? "zawieszony" : "aktywny";

  if (dbEnabled && dbPool) {
    const [result] = await dbPool.query(
      `UPDATE \`${USERS_TABLE}\` SET status = ? WHERE id = ?`,
      [status, parsedId],
    );
    if (!result || result.affectedRows === 0) return null;
    const next = await getUserById(parsedId);
    return next ? toAdminUserSummary(next) : null;
  }

  const user = store.users.find((row) => row.id === parsedId);
  if (!user) return null;
  user.status = status;
  user.updated_at = new Date().toISOString();
  persistStore();
  return toAdminUserSummary(user);
}

async function deleteUserByAdmin(userId) {
  const parsedId = safeInt(userId);
  if (parsedId === null) return false;

  if (dbEnabled && dbPool) {
    await dbPool.query(`DELETE FROM \`${USER_FAVORITES_TABLE}\` WHERE user_id = ?`, [parsedId]);
    await dbPool.query(`DELETE FROM \`${USER_SHOPPING_LISTS_TABLE}\` WHERE user_id = ?`, [parsedId]);
    await dbPool.query(`UPDATE \`${DB_TABLE}\` SET author_user_id = NULL WHERE author_user_id = ?`, [
      parsedId,
    ]);
    const [result] = await dbPool.query(`DELETE FROM \`${USERS_TABLE}\` WHERE id = ?`, [parsedId]);
    return Boolean(result && result.affectedRows > 0);
  }

  const before = store.users.length;
  store.users = store.users.filter((user) => user.id !== parsedId);
  if (store.users.length === before) return false;
  store.userFavorites = store.userFavorites.filter((favorite) => favorite.user_id !== parsedId);
  store.userShoppingLists = store.userShoppingLists.filter((list) => list.user_id !== parsedId);
  store.recipes = store.recipes.map((recipe) =>
    recipe.author_user_id === parsedId
      ? { ...recipe, author_user_id: null }
      : recipe,
  );
  persistStore();
  return true;
}

async function resetUserPasswordByAdmin(userId, nextPassword) {
  const parsedId = safeInt(userId);
  if (parsedId === null) return false;
  const nextHash = hashUserPassword(nextPassword);

  if (dbEnabled && dbPool) {
    const [result] = await dbPool.query(
      `UPDATE \`${USERS_TABLE}\` SET password_hash = ? WHERE id = ?`,
      [nextHash, parsedId],
    );
    return Boolean(result && result.affectedRows > 0);
  }

  const user = store.users.find((row) => row.id === parsedId);
  if (!user) return false;
  user.password_hash = nextHash;
  user.updated_at = new Date().toISOString();
  persistStore();
  return true;
}

function mapFavoriteRow(row) {
  const recipeId = safeInt(row?.recipe_id);
  return {
    favoriteId: safeInt(row?.id),
    id: recipeId,
    recipeId,
    title: safeLimitedString(row?.title, 255) || "Danie",
    shortDescription: safeLimitedString(row?.short_description, 600),
    prepTime: safeLimitedString(row?.prep_time, 80),
    category: normalizeRecipeCategory(row?.category),
    savedAt: safeIsoDate(row?.saved_at) || new Date().toISOString(),
  };
}

function normalizeFavoritePayload(payload) {
  return {
    recipeId: safeInt(payload?.recipeId ?? payload?.id ?? payload?.recipe_id),
    title: safeLimitedString(payload?.title, 255) || "Danie",
    shortDescription: safeLimitedString(
      payload?.shortDescription ?? payload?.short_description,
      600,
    ),
    prepTime: safeLimitedString(payload?.prepTime ?? payload?.prep_time, 80),
    category: normalizeRecipeCategory(payload?.category),
    savedAt: safeIsoDate(payload?.savedAt ?? payload?.saved_at) || new Date().toISOString(),
  };
}

function isSameFavorite(left, right) {
  if (!left || !right) return false;
  if (left.recipeId !== null && right.recipeId !== null) {
    return left.recipeId === right.recipeId;
  }
  return safeString(left.title).toLowerCase() === safeString(right.title).toLowerCase();
}

async function listUserFavorites(userId) {
  const parsedId = safeInt(userId);
  if (parsedId === null) return [];

  if (dbEnabled && dbPool) {
    const [rows] = await dbPool.query(
      `SELECT id, user_id, recipe_id, title, short_description, prep_time, category, saved_at
       FROM \`${USER_FAVORITES_TABLE}\`
       WHERE user_id = ?
       ORDER BY saved_at DESC, id DESC
       LIMIT 200`,
      [parsedId],
    );
    return rows.map(mapFavoriteRow);
  }

  return store.userFavorites
    .filter((favorite) => favorite.user_id === parsedId)
    .map(mapFavoriteRow)
    .sort((left, right) => {
      const leftTs = Date.parse(left.savedAt);
      const rightTs = Date.parse(right.savedAt);
      return (Number.isFinite(rightTs) ? rightTs : 0) - (Number.isFinite(leftTs) ? leftTs : 0);
    });
}

async function addFavoriteForUser(userId, payload) {
  const parsedId = safeInt(userId);
  if (parsedId === null) return [];
  const favorite = normalizeFavoritePayload(payload);

  if (dbEnabled && dbPool) {
    if (favorite.recipeId !== null) {
      await dbPool.query(
        `DELETE FROM \`${USER_FAVORITES_TABLE}\` WHERE user_id = ? AND recipe_id = ?`,
        [parsedId, favorite.recipeId],
      );
    } else {
      await dbPool.query(
        `DELETE FROM \`${USER_FAVORITES_TABLE}\` WHERE user_id = ? AND LOWER(title) = LOWER(?)`,
        [parsedId, favorite.title],
      );
    }

    await dbPool.query(
      `INSERT INTO \`${USER_FAVORITES_TABLE}\`
       (user_id, recipe_id, title, short_description, prep_time, category, saved_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        parsedId,
        favorite.recipeId,
        favorite.title,
        favorite.shortDescription,
        favorite.prepTime,
        favorite.category,
        favorite.savedAt,
      ],
    );
    return listUserFavorites(parsedId);
  }

  const entry = {
    id: store.nextFavoriteId,
    user_id: parsedId,
    recipe_id: favorite.recipeId,
    title: favorite.title,
    short_description: favorite.shortDescription,
    prep_time: favorite.prepTime,
    category: favorite.category,
    saved_at: favorite.savedAt,
  };
  store.nextFavoriteId += 1;
  store.userFavorites = [
    entry,
    ...store.userFavorites.filter(
      (existing) =>
        existing.user_id !== parsedId ||
        !isSameFavorite(
          mapFavoriteRow(existing),
          {
            recipeId: favorite.recipeId,
            title: favorite.title,
          },
        ),
    ),
  ].slice(0, 200);
  persistStore();
  return listUserFavorites(parsedId);
}

async function removeFavoriteForUser(userId, payload) {
  const parsedId = safeInt(userId);
  if (parsedId === null) return [];
  const favorite = normalizeFavoritePayload(payload);

  if (dbEnabled && dbPool) {
    if (favorite.recipeId !== null) {
      await dbPool.query(
        `DELETE FROM \`${USER_FAVORITES_TABLE}\` WHERE user_id = ? AND recipe_id = ?`,
        [parsedId, favorite.recipeId],
      );
    } else {
      await dbPool.query(
        `DELETE FROM \`${USER_FAVORITES_TABLE}\` WHERE user_id = ? AND LOWER(title) = LOWER(?)`,
        [parsedId, favorite.title],
      );
    }
    return listUserFavorites(parsedId);
  }

  store.userFavorites = store.userFavorites.filter(
    (existing) =>
      existing.user_id !== parsedId ||
      !isSameFavorite(
        mapFavoriteRow(existing),
        {
          recipeId: favorite.recipeId,
          title: favorite.title,
        },
      ),
  );
  persistStore();
  return listUserFavorites(parsedId);
}

function mapShoppingListRow(row) {
  const itemsRaw =
    typeof row?.items_json === "string"
      ? (() => {
          try {
            const parsed = JSON.parse(row.items_json);
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        })()
      : Array.isArray(row?.items_json)
        ? row.items_json
        : [];

  return {
    recipeTitle: safeLimitedString(row?.recipe_title, 255),
    items: normalizeUserListItems(itemsRaw, 200, 200),
    savedAt: safeIsoDate(row?.saved_at) || new Date().toISOString(),
  };
}

function normalizeShoppingListPayload(payload) {
  return {
    recipeTitle: safeLimitedString(payload?.recipeTitle ?? payload?.recipe_title, 255),
    items: normalizeUserListItems(payload?.items, 200, 200),
    savedAt: safeIsoDate(payload?.savedAt ?? payload?.saved_at) || new Date().toISOString(),
  };
}

async function getShoppingListForUser(userId) {
  const parsedId = safeInt(userId);
  if (parsedId === null) return { recipeTitle: "", items: [], savedAt: "" };

  if (dbEnabled && dbPool) {
    const [rows] = await dbPool.query(
      `SELECT user_id, recipe_title, items_json, saved_at
       FROM \`${USER_SHOPPING_LISTS_TABLE}\`
       WHERE user_id = ?
       LIMIT 1`,
      [parsedId],
    );
    if (!Array.isArray(rows) || rows.length === 0) {
      return { recipeTitle: "", items: [], savedAt: "" };
    }
    return mapShoppingListRow(rows[0]);
  }

  const row = store.userShoppingLists.find((list) => list.user_id === parsedId);
  if (!row) {
    return { recipeTitle: "", items: [], savedAt: "" };
  }
  return mapShoppingListRow(row);
}

async function saveShoppingListForUser(userId, payload) {
  const parsedId = safeInt(userId);
  if (parsedId === null) return { recipeTitle: "", items: [], savedAt: "" };
  const next = normalizeShoppingListPayload(payload);

  if (dbEnabled && dbPool) {
    await dbPool.query(
      `INSERT INTO \`${USER_SHOPPING_LISTS_TABLE}\` (user_id, recipe_title, items_json, saved_at)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE recipe_title = VALUES(recipe_title), items_json = VALUES(items_json), saved_at = VALUES(saved_at)`,
      [parsedId, next.recipeTitle, JSON.stringify(next.items), next.savedAt],
    );
    return getShoppingListForUser(parsedId);
  }

  const existingIndex = store.userShoppingLists.findIndex((list) => list.user_id === parsedId);
  const nextRow = {
    user_id: parsedId,
    recipe_title: next.recipeTitle,
    items_json: JSON.stringify(next.items),
    saved_at: next.savedAt,
    updated_at: new Date().toISOString(),
  };
  if (existingIndex >= 0) {
    store.userShoppingLists[existingIndex] = nextRow;
  } else {
    store.userShoppingLists.push(nextRow);
  }
  persistStore();
  return mapShoppingListRow(nextRow);
}

async function resolveUserFromRequest(req) {
  if (!USER_SECURITY_READY) return null;
  const cookies = parseCookies(req);
  const tokenPayload = verifyUserToken(cookies[USER_SESSION_COOKIE_NAME]);
  if (!tokenPayload) return null;
  const user = await getUserById(tokenPayload.userId);
  if (!user) return null;
  return user;
}

async function requireUser(req, res) {
  if (
    !enforceRateLimit(
      req,
      res,
      "user-route",
      USER_ROUTE_RATE_LIMIT_MAX,
      "Zbyt wiele zapytań użytkownika. Spróbuj ponownie za chwilę.",
    )
  ) {
    return null;
  }

  if (!USER_SECURITY_READY) {
    sendJson(res, 503, {
      error: "Logowanie użytkownika jest wyłączone: skonfiguruj USER_SESSION_SECRET (min. 32 znaki).",
    });
    return null;
  }

  const user = await resolveUserFromRequest(req);
  if (!user) {
    sendJson(res, 401, { error: "Wymagane logowanie użytkownika." }, { "Set-Cookie": clearUserCookieHeader() });
    return null;
  }
  if (normalizeUserStatus(user.status) !== "aktywny") {
    sendJson(res, 403, { error: "Twoje konto jest zawieszone." });
    return null;
  }
  return user;
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
  "danie",
  "dania",
  "potrawa",
  "potrawy",
  "przepis",
  "przepisy",
  "przepisu",
  "posilek",
  "posilki",
  "jedzenie",
  "obiad",
  "kolacja",
  "sniadanie",
]);

const POLISH_TOKEN_SUFFIXES = [
  "owego",
  "owych",
  "owym",
  "owej",
  "owie",
  "kami",
  "kach",
  "ami",
  "ach",
  "owi",
  "iem",
  "em",
  "om",
  "ie",
  "a",
  "u",
  "y",
  "i",
  "e",
  "Ä™",
  "Ä…",
];

function normalizePhrase(value) {
  return removeDiacritics(safeString(value).toLowerCase())
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeTokenForSearch(token) {
  let normalized = normalizePhrase(token).replace(/\s+/g, "");
  if (!normalized) return "";

  for (const suffix of POLISH_TOKEN_SUFFIXES) {
    if (normalized.length - suffix.length < 4) continue;
    if (!normalized.endsWith(suffix)) continue;
    normalized = normalized.slice(0, -suffix.length);
    break;
  }

  if (normalized.length > 5 && /[aeiouy]$/.test(normalized)) {
    normalized = normalized.slice(0, -1);
  }

  return normalized;
}

function tokenizePromptForSearch(value) {
  const normalized = normalizePhrase(value);
  if (!normalized) return [];

  return normalized
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token))
    .map((token) => normalizeTokenForSearch(token))
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function tokenizeRecipeForSearch(recipe) {
  const normalized = normalizePhrase(
    `${safeString(recipe?.nazwa)} ${safeString(recipe?.tagi)} ${safeString(recipe?.skladniki)}`,
  );
  if (!normalized) return [];

  return normalized
    .split(" ")
    .map((token) => normalizeTokenForSearch(token))
    .filter((token) => token.length > 2);
}

function tokensLooselyMatch(left, right) {
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.length >= 4 && right.startsWith(left)) return true;
  if (right.length >= 4 && left.startsWith(right)) return true;
  return false;
}

function scoreRecipeFieldSimilarity(prompt, recipe) {
  const promptTokens = tokenizePromptForSearch(prompt);
  if (promptTokens.length === 0) return 0;

  const recipeTokens = tokenizeRecipeForSearch(recipe);
  if (recipeTokens.length === 0) return 0;

  let matched = 0;
  for (const promptToken of promptTokens) {
    if (recipeTokens.some((recipeToken) => tokensLooselyMatch(promptToken, recipeToken))) {
      matched += 1;
    }
  }

  if (matched === 0) return 0;

  let score = matched * 40;
  if (matched === promptTokens.length) score += 20;
  else if (matched / promptTokens.length >= 0.6) score += 10;
  return score;
}

function scoreRecipeTagSimilarity(prompt, recipeTags) {
  const promptTokens = tokenizePromptForSearch(prompt);
  if (promptTokens.length === 0) return 0;

  const tagTokens = tokenizePromptForSearch(recipeTags);
  if (tagTokens.length === 0) return 0;

  let matched = 0;
  for (const promptToken of promptTokens) {
    if (tagTokens.some((tagToken) => tokensLooselyMatch(promptToken, tagToken))) {
      matched += 1;
    }
  }

  if (matched === 0) return 0;

  let score = matched * 40;
  if (matched === promptTokens.length) score += 20;
  else if (matched / promptTokens.length >= 0.6) score += 10;
  return score;
}

function scoreRecipeNameOrTagSimilarity(prompt, recipe) {
  const nameScore = scoreRecipeNameSimilarity(prompt, recipe?.nazwa || "");
  const tagScore = scoreRecipeTagSimilarity(prompt, recipe?.tagi || "");
  return Math.max(nameScore, tagScore);
}

function scoreRecipeSearchSimilarity(prompt, recipe) {
  const nameScore = scoreRecipeNameSimilarity(prompt, recipe?.nazwa || "");
  const fieldScore = scoreRecipeFieldSimilarity(prompt, recipe);
  return Math.max(nameScore, fieldScore);
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
    .map((recipe) => ({ recipe, score: scoreRecipeSearchSimilarity(prompt, recipe) }))
    .filter((item) => item.score >= minScore)
    .sort((left, right) => right.score - left.score || right.recipe.id - left.recipe.id)
    .slice(0, limit)
    .map((item) => item.recipe);
}

function findMatchingRecipesByNameOrTags(
  prompt,
  recipes,
  excludedSet,
  limit = 2,
  minScore = 1,
) {
  const normalizedPrompt = normalizePhrase(prompt);
  if (!normalizedPrompt) return [];

  return recipes
    .filter((recipe) => !excludedSet.has(recipe.id))
    .map((recipe) => ({ recipe, score: scoreRecipeNameOrTagSimilarity(prompt, recipe) }))
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

function buildPromptRecipeContextItems(recipes) {
  if (!Array.isArray(recipes) || recipes.length === 0) {
    return [];
  }

  return recipes.slice(0, 12).map((recipe) => ({
    recipe_id: safeInt(recipe?.id),
    title: safeString(recipe?.nazwa),
    category: normalizeRecipeCategory(recipe?.kategoria),
    time: normalizePreparationTime(recipe?.czas),
    tags: safeString(recipe?.tagi)
      .split(/[,\n;]+/)
      .map((tag) => safeString(tag))
      .filter(Boolean)
      .slice(0, 10),
    ingredients: safeString(recipe?.skladniki),
    instructions: safeString(recipe?.opis),
  }));
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
    .slice(-MAX_HISTORY_ITEMS)
    .map((item) => ({
      role: item.role,
      content: truncateForModel(item.content, MAX_HISTORY_ITEM_CHARS),
    }))
    .filter((item) => item.content.length > 0);
}

function containsForbiddenChatTerm(value) {
  const normalized = removeDiacritics(safeString(value).toLowerCase());
  if (!normalized) return false;

  return (
    /\bbaz\w*\b/.test(normalized) ||
    /\b(baza|bazy|bazie|bazach|bazami)\b/.test(normalized) ||
    /\bbaza danych\b/.test(normalized) ||
    /\bbaza dan\b/.test(normalized) ||
    /\bbaza przepisow\b/.test(normalized) ||
    /\b(baza|zbior|katalog|magazyn)\s+(danych|dan|przepisow)\b/.test(normalized) ||
    /\bdatabase\b/.test(normalized) ||
    /\bdataset\b/.test(normalized) ||
    /\binternet\w*\b/.test(normalized) ||
    /\b(db|sql|mysql|postgres|mongodb)\b/.test(normalized) ||
    /\brepozytor\w*\b/.test(normalized) ||
    /\bzbior\w* danych\b/.test(normalized)
  );
}

function sanitizeChatText(value, fallback) {
  const text = sanitizeModelOutputText(value, 2200);
  const fallbackText = safeString(fallback);

  if (!text) return fallbackText;
  if (containsForbiddenChatTerm(text)) return fallbackText;
  return text;
}

const ASSISTANT_TEXT_INTRO = "Oto cos pysznego dla Ciebie!";

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

const VEGAN_BLOCKED_TERMS = [
  "kurczak",
  "indyk",
  "wolow",
  "wieprz",
  "schab",
  "kaczk",
  "jagn",
  "mieso",
  "boczek",
  "szynk",
  "dorsz",
  "losos",
  "tuynczyk",
  "sledz",
  "krewet",
  "ryba",
  "jajko",
  "jajka",
  "maslo",
  "mleko",
  "smietan",
  "jogurt",
  "parmezan",
  "feta",
  "twarog",
  "mascarpone",
  "miod",
  "zelatyn",
];
const VEGETARIAN_BLOCKED_TERMS = [
  "kurczak",
  "indyk",
  "wolow",
  "wieprz",
  "schab",
  "kaczk",
  "jagn",
  "mieso",
  "boczek",
  "szynk",
  "dorsz",
  "losos",
  "tuynczyk",
  "sledz",
  "krewet",
  "ryba",
  "owoc morza",
];
const GLUTEN_TERMS = [
  "pszen",
  "orkisz",
  "zyt",
  "jeczm",
  "maka",
  "makaron",
  "bulka",
  "chleb",
  "tortilla",
  "panier",
];
const LACTOSE_TERMS = [
  "mleko",
  "smietan",
  "jogurt",
  "kefir",
  "maslo",
  "twarog",
  "mascarpone",
];
const ADDED_SUGAR_TERMS = [
  "cukier",
  "cukru",
  "syrop",
  "slodzone",
  "karmel",
  "miod",
  "slodzik",
];
const FRYING_TERMS = ["smaz", "pateln", "fryt", "podsmaz", "obsmaz", "stir fry"];
const BAKING_TERMS = ["piec", "piekarn", "zapiec", "zapiek"];
const BOILING_TERMS = ["gotuj", "ugotuj", "wrzatek", "blansz"];
const STEWING_TERMS = ["dus", "duzone"];
const PREMIUM_INGREDIENT_TERMS = [
  "krewet",
  "losos",
  "stek",
  "wolowina",
  "awokado",
  "orzechy",
  "mascarpone",
];
const GENERIC_PROMPT_TERMS = new Set([
  "cos",
  "cokolwiek",
  "obojetnie",
  "jakies",
  "jakis",
  "jakakolwiek",
  "pomysl",
  "propozycja",
  "przepis",
]);

function includesAnyTerm(value, terms) {
  const normalized = normalizePhrase(value);
  if (!normalized) return false;
  return terms.some((term) => normalized.includes(term));
}

function normalizeChatFilters(filters) {
  const safe = filters && typeof filters === "object" ? filters : {};
  const diet = safeString(safe.diet || "any");
  const maxTime = safeString(safe.maxTime || "any");
  const difficulty = safeString(safe.difficulty || "any");
  const budget = safeString(safe.budget || "any");

  return {
    diet: CHAT_FILTER_DIET_VALUES.has(diet) ? diet : "any",
    maxTime: CHAT_FILTER_TIME_VALUES.has(maxTime) ? maxTime : "any",
    difficulty: CHAT_FILTER_DIFFICULTY_VALUES.has(difficulty) ? difficulty : "any",
    budget: CHAT_FILTER_BUDGET_VALUES.has(budget) ? budget : "any",
    ingredientLimitFive: safe.ingredientLimitFive === true,
  };
}

function mergeUniqueByNormalized(...lists) {
  const result = [];
  const seen = new Set();
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      const text = safeString(item);
      if (!text) continue;
      const key = normalizePhrase(text);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      result.push(text);
    }
  }
  return result;
}

function extractPositiveIngredientsFromPrompt(prompt) {
  const tokens = tokenizePromptForSearch(prompt);
  const filtered = tokens.filter(
    (token) =>
      token.length > 2 &&
      !GENERIC_PROMPT_TERMS.has(token) &&
      !token.startsWith("bez") &&
      !token.startsWith("szybk") &&
      !token.startsWith("prost"),
  );
  return mergeUniqueByNormalized(filtered).slice(0, 12);
}

function extractExcludedIngredientsFromPrompt(prompt) {
  const text = normalizePhrase(prompt);
  if (!text) return [];
  const result = [];
  const regex = /\bbez\s+([a-z0-9]+)/g;
  let match = regex.exec(text);
  while (match) {
    const candidate = safeString(match[1]);
    if (
      candidate &&
      !["glutenu", "gluten", "laktozy", "laktoza", "cukru", "cukier", "smazenia", "smazen"].includes(candidate)
    ) {
      result.push(candidate);
    }
    match = regex.exec(text);
  }
  return mergeUniqueByNormalized(result).slice(0, 8);
}

function detectDietFromPrompt(prompt) {
  const normalized = normalizePhrase(prompt);
  if (!normalized) return "klasyczna";
  if (normalized.includes("wegansk")) return "weganska";
  if (normalized.includes("wegetari")) return "wegetarianska";
  return "klasyczna";
}

function detectAllergensFromPrompt(prompt) {
  const normalized = normalizePhrase(prompt);
  const allergens = [];
  if (!normalized) return allergens;
  if (normalized.includes("bez glutenu") || normalized.includes("bezgluten")) allergens.push("gluten");
  if (normalized.includes("bez laktozy") || normalized.includes("bezlaktoz")) allergens.push("laktoza");
  if (normalized.includes("bez cukru") || normalized.includes("bezcukru")) allergens.push("cukier");
  if (normalized.includes("bez orzech")) allergens.push("orzechy");
  return mergeUniqueByNormalized(allergens).slice(0, 6);
}

function detectMaxTimeFromPrompt(prompt) {
  const normalized = normalizePhrase(prompt);
  if (!normalized) return null;

  const toMinutesMatch = normalized.match(/\bdo\s*(\d{1,3})\s*(min|minut|m)\b/);
  if (toMinutesMatch) {
    return Math.max(5, Math.min(180, Number.parseInt(toMinutesMatch[1], 10)));
  }

  const plainMinutesMatch = normalized.match(/\b(\d{1,3})\s*(min|minut|m)\b/);
  if (plainMinutesMatch) {
    return Math.max(5, Math.min(180, Number.parseInt(plainMinutesMatch[1], 10)));
  }

  const toHoursMatch = normalized.match(/\bdo\s*(\d{1,2})\s*(h|godz|godzin)\b/);
  if (toHoursMatch) {
    return Math.max(10, Math.min(240, Number.parseInt(toHoursMatch[1], 10) * 60));
  }

  if (normalized.includes("szybkie") || normalized.includes("na szybko")) return 30;
  return null;
}

function detectCookingMethodFromPrompt(prompt) {
  const normalized = normalizePhrase(prompt);
  if (!normalized) return "dowolna";
  if (normalized.includes("bez smazenia") || normalized.includes("bez smażenia")) {
    return "bez_smazenia";
  }
  if (includesAnyTerm(normalized, BAKING_TERMS)) return "pieczenie";
  if (includesAnyTerm(normalized, BOILING_TERMS)) return "gotowanie";
  if (includesAnyTerm(normalized, STEWING_TERMS)) return "duszenie";
  return "dowolna";
}

function detectBudgetFromPrompt(prompt) {
  const normalized = normalizePhrase(prompt);
  if (!normalized) return "dowolny";
  if (normalized.includes("tanio") || normalized.includes("niski budzet") || normalized.includes("budzetowe")) {
    return "niski";
  }
  if (normalized.includes("sredni budzet")) return "sredni";
  return "dowolny";
}

function detectDifficultyFromPrompt(prompt) {
  const normalized = normalizePhrase(prompt);
  if (!normalized) return "dowolna";
  if (normalized.includes("latwe") || normalized.includes("proste") || normalized.includes("bez wysilku")) {
    return "latwe";
  }
  if (normalized.includes("srednie")) return "srednie";
  return "dowolna";
}

function timeFilterToMinutes(value) {
  if (value === "15") return 15;
  if (value === "30") return 30;
  if (value === "45") return 45;
  return null;
}

function mapFilterDietToIntentDiet(filterDiet) {
  if (filterDiet === "vegan") return "weganska";
  if (filterDiet === "vegetarian") return "wegetarianska";
  if (filterDiet === "gluten_free") return "bez_glutenu";
  if (filterDiet === "lactose_free") return "bez_laktozy";
  return "klasyczna";
}

function buildUserIntent(prompt, category, filters) {
  const normalizedFilters = normalizeChatFilters(filters);
  const promptDiet = detectDietFromPrompt(prompt);
  const filterDiet = mapFilterDietToIntentDiet(normalizedFilters.diet);
  const allergensFromPrompt = detectAllergensFromPrompt(prompt);
  const allergensFromFilter = [];
  if (normalizedFilters.diet === "gluten_free") allergensFromFilter.push("gluten");
  if (normalizedFilters.diet === "lactose_free") allergensFromFilter.push("laktoza");

  const filterTime = timeFilterToMinutes(normalizedFilters.maxTime);
  const promptTime = detectMaxTimeFromPrompt(prompt);
  const maxTime = filterTime || promptTime;

  const filterDifficulty =
    normalizedFilters.difficulty === "easy"
      ? "latwe"
      : normalizedFilters.difficulty === "medium"
        ? "srednie"
        : "dowolna";
  const filterBudget =
    normalizedFilters.budget === "low"
      ? "niski"
      : normalizedFilters.budget === "medium"
        ? "sredni"
        : "dowolny";

  const contradictionNotes = [];
  const effectiveDiet = filterDiet !== "klasyczna" ? filterDiet : promptDiet;
  if (filterDiet !== "klasyczna" && promptDiet !== "klasyczna" && filterDiet !== promptDiet) {
    contradictionNotes.push("Aktywne filtry diety maja priorytet nad trescia wiadomosci.");
  }

  const effectiveCookingMethod = detectCookingMethodFromPrompt(prompt);
  const effectiveBudget = filterBudget !== "dowolny" ? filterBudget : detectBudgetFromPrompt(prompt);
  const effectiveDifficulty =
    filterDifficulty !== "dowolna" ? filterDifficulty : detectDifficultyFromPrompt(prompt);

  const mealType = normalizeRecipeCategory(category);
  const normalizedPrompt = normalizePhrase(prompt);
  const sweetnessMode =
    mealType === "Deser" || normalizedPrompt.includes("slod") || normalizedPrompt.includes("deser");
  const savoryMode = !sweetnessMode;

  return {
    ingredients: extractPositiveIngredientsFromPrompt(prompt),
    excludedIngredients: extractExcludedIngredientsFromPrompt(prompt),
    diet: effectiveDiet,
    allergens: mergeUniqueByNormalized(allergensFromPrompt, allergensFromFilter),
    maxTime,
    cookingMethod: effectiveCookingMethod,
    budget: effectiveBudget,
    mealType,
    sweetnessMode,
    savoryMode,
    difficulty: effectiveDifficulty,
    ingredientLimit: normalizedFilters.ingredientLimitFive ? 5 : null,
    contradictionNotes,
    filters: normalizedFilters,
  };
}

function intentHasStrongConstraints(intent) {
  return Boolean(
    (intent?.diet && intent.diet !== "klasyczna") ||
      (Array.isArray(intent?.allergens) && intent.allergens.length > 0) ||
      intent?.maxTime ||
      intent?.cookingMethod === "bez_smazenia" ||
      intent?.ingredientLimit ||
      intent?.budget === "niski" ||
      intent?.difficulty === "latwe",
  );
}

function detectIntentConflict(intent, prompt) {
  const normalizedPrompt = normalizePhrase(prompt);
  const allText = `${normalizedPrompt} ${intent?.ingredients?.join(" ") || ""}`;

  if (intent?.diet === "weganska" && includesAnyTerm(allText, VEGAN_BLOCKED_TERMS)) {
    return {
      code: "VEGAN_ANIMAL_CONFLICT",
      message:
        "Nie da sie jednoczesnie utrzymac diety weganskiej i uzyc skladnikow odzwierzecych.",
      compromises: [
        "zamienic skladniki odzwierzece na tofu/straczki",
        "przejsc na wegetarianska wersje przepisu",
        "usunac ograniczenie diety weganskiej",
      ],
    };
  }

  if (
    intent?.cookingMethod === "bez_smazenia" &&
    (normalizedPrompt.includes("smaz") || normalizedPrompt.includes("patel"))
  ) {
    return {
      code: "NO_FRY_CONFLICT",
      message: "Zapytanie sugeruje smazenie, a jednoczesnie ustawiono tryb bez smazenia.",
      compromises: [
        "zmienic technike na pieczenie",
        "zmienic technike na gotowanie lub duszenie",
        "wylaczyc ograniczenie bez smazenia",
      ],
    };
  }

  if (
    intent?.sweetnessMode &&
    (normalizedPrompt.includes("bez kalorii") || normalizedPrompt.includes("zero kalor"))
  ) {
    return {
      code: "ZERO_CALORIES_CONFLICT",
      message: "Nie da sie przygotowac realnego deseru o zerowej kalorycznosci.",
      compromises: [
        "wybrac deser o obnizonej kalorycznosci",
        "zastapic cukier erytrytolem lub stewia",
        "zmienic cel z deseru na lekka przekaske",
      ],
    };
  }

  return null;
}

function shouldAskClarification(intent, prompt, candidateRecipesCount) {
  const normalizedPrompt = normalizePhrase(prompt);
  const tokenCount = tokenizePromptForSearch(prompt).length;
  const genericOnly =
    tokenCount <= 2 &&
    [...GENERIC_PROMPT_TERMS].some((term) => normalizedPrompt.includes(term));
  const missingDirection =
    intent.ingredients.length === 0 &&
    !intentHasStrongConstraints(intent) &&
    tokenCount <= 2;

  if (genericOnly || missingDirection) return true;
  if (candidateRecipesCount === 0 && tokenCount <= 4 && intentHasStrongConstraints(intent)) {
    return true;
  }
  return false;
}

function buildClarificationQuestion(intent, category) {
  const normalizedCategory = normalizeRecipeCategory(category);
  const baseQuestion =
    normalizedCategory === "Deser"
      ? "Doprecyzuj prosze deser: jaki smak preferujesz i ile czasu masz?"
      : "Doprecyzuj prosze danie: jakie 2-3 skladniki chcesz wykorzystac i ile czasu masz?";
  const timeHint = intent?.maxTime ? ` Limit czasu: do ${intent.maxTime} min.` : "";
  const dietHint =
    intent?.diet && intent.diet !== "klasyczna"
      ? ` Zachowam diete: ${intent.diet.replace(/_/g, " ")}.`
      : "";
  return `${baseQuestion}${timeHint}${dietHint}`.trim();
}

function splitTextList(value, maxItems = 16) {
  const text = safeString(value);
  if (!text) return [];
  return text
    .split(/[\n,;]+/)
    .map((item) => safeString(item))
    .filter(Boolean)
    .slice(0, maxItems);
}

function normalizeUserListItems(value, maxItems = 200, maxChars = 200) {
  let list = [];
  if (Array.isArray(value)) {
    list = value;
  } else if (typeof value === "string") {
    list = splitTextList(value, maxItems);
  }

  return list
    .map((item) => safeLimitedString(item, maxChars))
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, maxItems);
}

function normalizeStringArray(value, fallbackText, maxItems = 16, maxChars = 120) {
  let list = [];
  if (Array.isArray(value)) {
    list = value;
  } else if (typeof value === "string") {
    list = splitTextList(value, maxItems);
  }

  const normalized = list
    .map((item) => sanitizeChatText(item, ""))
    .map((item) => item.slice(0, maxChars))
    .filter(Boolean)
    .slice(0, maxItems);
  if (normalized.length > 0) return normalized;
  return fallbackText ? [fallbackText] : [];
}

function normalizeChatServings(value) {
  const servings = safeInt(value);
  if (servings === null) return null;
  if (servings < 1 || servings > 12) return null;
  return servings;
}

function normalizeNutritionObject(value) {
  const object = value && typeof value === "object" ? value : {};
  const normalizeField = (field) => {
    const text = sanitizeChatText(object?.[field], "");
    return text ? text.slice(0, 40) : null;
  };
  return {
    calories: normalizeField("calories"),
    protein: normalizeField("protein"),
    fat: normalizeField("fat"),
    carbs: normalizeField("carbs"),
  };
}

function parsePreparationTimeMinutes(value) {
  const normalized = removeDiacritics(normalizePreparationTime(value).toLowerCase());
  if (!normalized) return null;

  const range = normalized.match(/^(\d{1,3})\s*-\s*(\d{1,3})\s*minut$/);
  if (range) {
    const to = Number.parseInt(range[2], 10);
    return Number.isFinite(to) ? to : null;
  }

  const single = normalized.match(/^(\d{1,3})\s*minut$/);
  if (single) {
    const minutes = Number.parseInt(single[1], 10);
    return Number.isFinite(minutes) ? minutes : null;
  }

  return null;
}

function optionViolationReasons(option, intent) {
  if (!intent || typeof intent !== "object") return [];
  const violations = [];
  const textBlob = normalizePhrase(
    `${safeString(option?.title)} ${safeString(option?.short_description)} ${safeString(option?.ingredients)} ${safeString(option?.instructions)} ${Array.isArray(option?.ingredients_list) ? option.ingredients_list.join(" ") : ""} ${Array.isArray(option?.steps) ? option.steps.join(" ") : ""}`,
  );

  if (intent.diet === "weganska" && includesAnyTerm(textBlob, VEGAN_BLOCKED_TERMS)) {
    violations.push("Nie spelnia diety weganskiej.");
  }
  if (intent.diet === "wegetarianska" && includesAnyTerm(textBlob, VEGETARIAN_BLOCKED_TERMS)) {
    violations.push("Nie spelnia diety wegetarianskiej.");
  }
  if (intent.allergens.includes("gluten") && includesAnyTerm(textBlob, GLUTEN_TERMS)) {
    violations.push("Zawiera gluten.");
  }
  if (intent.allergens.includes("laktoza") && includesAnyTerm(textBlob, LACTOSE_TERMS)) {
    violations.push("Zawiera laktoze.");
  }
  if (intent.allergens.includes("cukier") && includesAnyTerm(textBlob, ADDED_SUGAR_TERMS)) {
    violations.push("Zawiera cukier dodany.");
  }
  if (intent.cookingMethod === "bez_smazenia" && includesAnyTerm(textBlob, FRYING_TERMS)) {
    violations.push("Wymaga smazenia.");
  }
  if (intent.maxTime) {
    const optionMinutes = parsePreparationTimeMinutes(option?.time);
    if (optionMinutes !== null && optionMinutes > intent.maxTime) {
      violations.push("Przekracza limit czasu.");
    }
  }
  if (intent.ingredientLimit) {
    const count = Array.isArray(option?.ingredients_list)
      ? option.ingredients_list.length
      : splitTextList(option?.ingredients).length;
    if (count > intent.ingredientLimit) {
      violations.push("Za duzo skladnikow.");
    }
  }
  if (intent.budget === "niski" && includesAnyTerm(textBlob, PREMIUM_INGREDIENT_TERMS)) {
    violations.push("Raczej wysoki koszt skladnikow.");
  }
  if (intent.difficulty === "latwe" && Array.isArray(option?.steps) && option.steps.length > 6) {
    violations.push("Za wysoka trudnosc.");
  }

  return violations;
}

function isOptionCompatibleWithIntent(option, intent) {
  return optionViolationReasons(option, intent).length === 0;
}

function filterOptionsByIntent(options, intent, limit = 2) {
  if (!Array.isArray(options)) return [];
  const filtered = [];
  for (const option of options) {
    if (filtered.length >= limit) break;
    if (!isOptionCompatibleWithIntent(option, intent)) continue;
    filtered.push(option);
  }
  return filtered;
}

function filterRecipesByIntent(recipes, intent) {
  if (!Array.isArray(recipes) || !intent) return Array.isArray(recipes) ? recipes : [];
  const result = [];
  for (const recipe of recipes) {
    const option = optionFromRecipe(recipe, "Filtr dopasowania.");
    if (!isOptionCompatibleWithIntent(option, intent)) continue;
    result.push(recipe);
  }
  return result;
}

function buildConflictResponsePayload(conflict, intent, category, appliedFilters) {
  const compromiseLines = Array.isArray(conflict?.compromises)
    ? conflict.compromises.slice(0, 3).map((item, index) => `${index + 1}. ${item}`)
    : [];
  const base = safeString(conflict?.message) || "Nie da sie spelnic wszystkich warunkow naraz.";
  const clarificationQuestion = compromiseLines.length
    ? `Co wybierasz?\n${compromiseLines.join("\n")}`
    : "Ktory warunek mam poluzowac jako pierwszy?";

  return {
    assistantText: `${base} ${clarificationQuestion}`.trim(),
    needsClarification: true,
    clarificationQuestion,
    options: [],
    category: normalizeRecipeCategory(category),
    intent,
    appliedFilters,
    constraintNote: base,
  };
}

function buildClarificationResponsePayload(intent, category, appliedFilters, customQuestion = "") {
  const clarificationQuestion =
    safeString(customQuestion) || buildClarificationQuestion(intent, category);
  return {
    assistantText: clarificationQuestion,
    needsClarification: true,
    clarificationQuestion,
    options: [],
    category: normalizeRecipeCategory(category),
    intent,
    appliedFilters,
    constraintNote: "",
  };
}

function shouldAssistantUseVerifiedRecipesFallback(options, hasDbMatch) {
  if (!Array.isArray(options) || options.length === 0) {
    return !hasDbMatch;
  }

  return options.every((option) => safeInt(option?.recipe_id) === null);
}

function finalizeAssistantText(value, fallback) {
  const text = sanitizeChatText(value, fallback);
  return text || fallback;
}

function assistantFallbackTextForPrompt(category = DEFAULT_RECIPE_CATEGORY) {
  const normalizedCategory = normalizeRecipeCategory(category);

  if (normalizedCategory === "Deser") {
    return `${ASSISTANT_TEXT_INTRO} Przygotowalem dla Ciebie 2 slodkie propozycje.`;
  }

  return `${ASSISTANT_TEXT_INTRO} Przygotowalem dla Ciebie 2 propozycje.`;
}

function sanitizeChatResponsePayload(payload, prompt, fallbackCategory = DEFAULT_RECIPE_CATEGORY) {
  const normalizedCategory = normalizeRecipeCategory(payload?.category || fallbackCategory);
  const rawOptions = Array.isArray(payload?.options) ? payload.options : [];
  const options = rawOptions.slice(0, 2).map((option) => normalizeOption(option));

  return {
    assistantText: sanitizeModelOutputText(
      sanitizeChatText(payload?.assistantText, assistantFallbackTextForPrompt(normalizedCategory)),
      1800,
    ),
    options,
    category: normalizedCategory,
    categoryAutoSwitched: Boolean(payload?.categoryAutoSwitched),
    blocked: Boolean(payload?.blocked),
    needsClarification: Boolean(payload?.needsClarification),
    clarificationQuestion: sanitizeChatText(payload?.clarificationQuestion, ""),
    intent: payload?.intent && typeof payload.intent === "object" ? payload.intent : null,
    appliedFilters:
      payload?.appliedFilters && typeof payload.appliedFilters === "object"
        ? payload.appliedFilters
        : null,
    constraintNote: sanitizeChatText(payload?.constraintNote, ""),
  };
}

function normalizeOption(option) {
  const recipeId = safeInt(option?.recipe_id);
  const defaultWhy = "To danie pasuje do Twojego zapytania.";
  const defaultShortDescription = "Praktyczna propozycja na teraz.";
  const defaultIngredients = "AI nie podalo dokladnych skladnikow.";
  const defaultInstructions = "AI nie podalo instrukcji. Sprobuj dopytac na czacie.";

  const ingredientsList = normalizeStringArray(option?.ingredients_list || option?.ingredients, "", 18, 80);
  const steps = normalizeStringArray(option?.steps || option?.instructions, "", 12, 220);
  const substitutions = normalizeStringArray(option?.substitutions, "", 8, 100);
  const tags = normalizeStringArray(option?.tags, "", 8, 32);
  const shoppingList = normalizeStringArray(
    option?.shopping_list || option?.shoppingList || ingredientsList,
    "",
    18,
    90,
  );

  return {
    recipe_id: recipeId,
    title: sanitizeChatText(option?.title, "Danie"),
    short_description: sanitizeChatText(option?.short_description, defaultShortDescription),
    why: sanitizeChatText(option?.why, defaultWhy),
    ingredients: sanitizeChatText(option?.ingredients, defaultIngredients),
    ingredients_list: ingredientsList,
    instructions: sanitizeChatText(option?.instructions, defaultInstructions),
    steps,
    time: normalizePreparationTime(option?.time) || "Brak danych",
    servings: normalizeChatServings(option?.servings),
    substitutions,
    tags,
    shopping_list: shoppingList,
    nutrition: normalizeNutritionObject(option?.nutrition),
    difficulty: sanitizeChatText(option?.difficulty, ""),
    budget: sanitizeChatText(option?.budget, ""),
    link_filmu: safeLink(option?.link_filmu),
    link_strony: safeLink(option?.link_strony),
  };
}

const DESSERT_KEYWORDS = [
  "deser",
  "slod",
  "ciast",
  "tart",
  "sernik",
  "brownie",
  "beza",
  "pudding",
  "mus",
  "kremow",
  "lody",
  "czekolad",
  "wanili",
  "owoc",
  "drozdz",
  "muffin",
  "babeczk",
  "szarlot",
  "tiramisu",
];

const CATEGORY_SWITCH_MIN_SCORE = 44;
const CATEGORY_SWITCH_SCORE_GAP = 12;
const DESSERT_MODE_HINTS = [
  "deser",
  "slod",
  "slodkie",
  "slodkiego",
  "slodycz",
  "ciasto",
  "sernik",
  "brownie",
  "beza",
  "tiramisu",
  "muffin",
  "babeczk",
  "szarlot",
  "pudding",
  "lody",
  "czekolad",
  "cukierni",
  "wypiek",
  "drozdzow",
  "biszkopt",
  "kakao",
  "wanili",
  "racuch",
];
const MEAL_MODE_HINTS = [
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
  "kurczak",
  "indyk",
  "wolow",
  "wieprz",
  "dorsz",
  "losos",
  "krewet",
  "gulasz",
  "curry",
  "leczo",
  "salatk",
  "kanapk",
  "burger",
  "pizza",
  "schab",
  "pulpet",
  "frittat",
  "jajeczn",
  "omlet",
  "ryz",
  "ziemniak",
  "przekask",
  "kasz",
  "dahl",
  "tofu",
  "stir fry",
  "taco",
  "burrito",
];

const INTERNET_RECIPE_CATALOG = [
  {
    title: "Shakshuka z pomidorami",
    tags: "sniadanie jajka wegetarianskie pomidory szybkie",
    why: "Popularny przepis sniadaniowy znany z kuchni bliskowschodniej i blogow kulinarnych.",
    ingredients: "Pomidory, papryka, cebula, czosnek, jajka, kmin rzymski, oliwa.",
    instructions:
      "Podsmaz cebule i papryke. Dodaj pomidory i przyprawy. Zrob gniazda i zetnij jajka pod przykryciem.",
    time: "20-25 min",
  },
  {
    title: "Owsianka proteinowa z bananem",
    tags: "sniadanie fit wysokobialkowe szybkie",
    why: "Czesto wybierane szybkie sniadanie z dobrym balansem bialka i weglowodanow.",
    ingredients:
      "Platki owsiane, mleko lub napoj roslinny, jogurt skyr, banan, maslo orzechowe, cynamon.",
    instructions:
      "Ugotuj platki na mleku, dodaj skyr i pokrojonego banana. Na koniec dodaj maslo orzechowe i cynamon.",
    time: "10-12 min",
  },
  {
    title: "Pasta aglio e olio",
    tags: "makaron wegetarianskie szybkie obiad",
    why: "Klasyczne danie wloskie, bardzo czesto polecane jako szybki i pewny przepis.",
    ingredients: "Spaghetti, czosnek, oliwa, chili, pietruszka, sol.",
    instructions:
      "Ugotuj makaron al dente. Czosnek podsmaz na oliwie z chili. Wymieszaj z makaronem i pietruszka.",
    time: "15-20 min",
  },
  {
    title: "Makaron pesto z suszonymi pomidorami",
    tags: "makaron wegetarianskie szybkie",
    why: "Popularna opcja obiadowa, latwa i powtarzalna w domowym gotowaniu.",
    ingredients:
      "Penne, pesto bazyliowe, suszone pomidory, czosnek, parmezan, rukola.",
    instructions:
      "Ugotuj makaron, na patelni podgrzej pesto z czosnkiem i suszonymi pomidorami, polacz z makaronem i rukola.",
    time: "18-22 min",
  },
  {
    title: "Dahl z czerwonej soczewicy",
    tags: "soczewica wegetarianskie weganskie curry bezmiesa",
    why: "Sprawdzona, sycaca propozycja oparta o popularne przepisy kuchni indyjskiej.",
    ingredients: "Czerwona soczewica, pomidory, cebula, czosnek, imbir, curry, mleko kokosowe.",
    instructions:
      "Podsmaz cebule z przyprawami, dodaj soczewice i pomidory, gotuj do miekkosci, na koniec dodaj mleko kokosowe.",
    time: "30-35 min",
  },
  {
    title: "Curry z ciecierzycy i szpinaku",
    tags: "weganskie wegetarianskie curry bezmiesa ciecierzyca",
    why: "Czesto polecane danie roslinne, sycace i bogate w blonnik.",
    ingredients:
      "Ciecierzyca, mleko kokosowe, pomidory, cebula, czosnek, szpinak, curry, kolendra.",
    instructions:
      "Podsmaz cebule z czosnkiem i curry. Dodaj pomidory, ciecierzyce i mleko kokosowe. Na koniec wmieszaj szpinak.",
    time: "25-30 min",
  },
  {
    title: "Tofu stir-fry z warzywami",
    tags: "weganskie wegetarianskie tofu azjatyckie szybkie fit",
    why: "Proste danie roslinne, dobrze sprawdza sie przy szybkich kolacjach.",
    ingredients:
      "Tofu naturalne, brokul, marchew, papryka, sos sojowy, imbir, czosnek, olej sezamowy.",
    instructions:
      "Obsmaz tofu, dodaj warzywa i krotko smaĹĽ. Dolej sos sojowy z imbirem i czosnkiem, podawaj od razu.",
    time: "20-25 min",
  },
  {
    title: "Kurczak teriyaki z ryzem",
    tags: "kurczak drob azjatyckie ryz obiad",
    why: "Znany przepis azjatycki, czesto odtwarzany na podstawie autentycznych receptur.",
    ingredients: "Filet z kurczaka, sos sojowy, miod, czosnek, imbir, ryz, szczypiorek.",
    instructions:
      "Obsmaz kurczaka, dodaj sos teriyaki i zredukuj. Podawaj z ugotowanym ryzem i szczypiorkiem.",
    time: "25-30 min",
  },
  {
    title: "Kurczak curry z mlekiem kokosowym",
    tags: "kurczak drob curry obiad",
    why: "Bardzo popularny klasyk domowy, latwy do odtworzenia krok po kroku.",
    ingredients:
      "Filet z kurczaka, cebula, czosnek, imbir, pasta curry, mleko kokosowe, ryz, limonka.",
    instructions:
      "Podsmaz kurczaka i cebule, dodaj paste curry, potem mleko kokosowe. Gotuj kilka minut i podawaj z ryzem.",
    time: "30-35 min",
  },
  {
    title: "Pulpeciki z indyka w sosie pomidorowym",
    tags: "indyk drob obiad fit",
    why: "Lekkie danie miesne, czesto wybierane jako alternatywa dla ciezszych sosow.",
    ingredients:
      "Mielony indyk, jajko, cebula, czosnek, passata pomidorowa, bazylia, oliwa.",
    instructions:
      "Uformuj pulpeciki, obsmaz je i duĹ› w passacie z czosnkiem i bazylia do miekkosci.",
    time: "30-35 min",
  },
  {
    title: "Chili con carne",
    tags: "wolowina mieso ostre meksykanskie obiad",
    why: "Sprawdzony przepis jednogarnkowy, ceniony za intensywny smak i prostote.",
    ingredients:
      "Mielona wolowina, fasola czerwona, pomidory, cebula, czosnek, chili, kumin.",
    instructions:
      "Podsmaz mieso z cebula, dodaj przyprawy, pomidory i fasole. Gotuj na wolnym ogniu do zageszczenia.",
    time: "35-45 min",
  },
  {
    title: "Gulasz wolowy z papryka",
    tags: "wolowina mieso klasyczne obiad",
    why: "Klasyczna propozycja obiadowa oparta o znane receptury domowe.",
    ingredients:
      "Wolowina gulaszowa, cebula, papryka, czosnek, koncentrat pomidorowy, bulion, majeranek.",
    instructions:
      "Obsmaz wolowine partiami, dodaj warzywa i bulion, duĹ› do miekkosci miesa.",
    time: "90-120 min",
  },
  {
    title: "Schab w sosie pieczarkowym",
    tags: "wieprzowina schab obiad klasyczne",
    why: "Tradycyjne danie obiadowe, latwe do podania z ziemniakami lub kasza.",
    ingredients:
      "Schab, pieczarki, cebula, czosnek, smietanka, bulion, natka pietruszki.",
    instructions:
      "Obsmaz plastry schabu, dodaj pieczarki z cebula, podlej bulionem i zakoncz smietanka.",
    time: "40-50 min",
  },
  {
    title: "Szarpana wieprzowina z piekarnika",
    tags: "wieprzowina pulled pork pieczone",
    why: "Popularny przepis na miekkie mieso, dobre do bulek lub ziemniakow.",
    ingredients:
      "Lopatka wieprzowa, cebula, czosnek, papryka wedzona, musztarda, bulion.",
    instructions:
      "Natrzyj mieso przyprawami, piecz pod przykryciem do pelnej miekkosci i rozdziel widelcami.",
    time: "3-4 h",
  },
  {
    title: "Dorsz pieczony z cytryna i koperkiem",
    tags: "ryba dorsz pieczone obiad",
    why: "Klasyczna propozycja rybna oparta o popularne przepisy domowe i restauracyjne.",
    ingredients: "Filet z dorsza, cytryna, maslo, koperek, czosnek, sol, pieprz.",
    instructions:
      "Skrop dorsza cytryna, dopraw, poloz platki masla i piecz 15-18 minut w 200C. Posyp koperkiem.",
    time: "25-30 min",
  },
  {
    title: "Losos z patelni z maslem czosnkowym",
    tags: "ryba losos szybkie obiad",
    why: "Bardzo czesto wybierana opcja na szybki obiad z ryba.",
    ingredients: "Filet z lososia, maslo, czosnek, cytryna, natka pietruszki, sol, pieprz.",
    instructions:
      "Obsmaz lososia od strony skory, dodaj maslo z czosnkiem, podlej sokiem z cytryny i podawaj z natka.",
    time: "15-20 min",
  },
  {
    title: "Krewetki z czosnkiem i chili",
    tags: "krewetki owoce morza szybkie",
    why: "Szybkie danie inspirowane kuchnia srodziemnomorska, czesto wybierane na kolacje.",
    ingredients:
      "Krewetki, czosnek, chili, oliwa, maslo, pietruszka, cytryna.",
    instructions:
      "Na rozgrzanej patelni podsmaz czosnek i chili, dodaj krewetki i smaĹĽ 2-3 minuty, skrop cytryna.",
    time: "12-15 min",
  },
  {
    title: "Komosa ryzowa z pieczonymi warzywami",
    tags: "weganskie wegetarianskie bezglutenowe quinoa fit",
    why: "Bardzo uniwersalna, lekka propozycja na obiad lub kolacje.",
    ingredients:
      "Komosa ryzowa, cukinia, papryka, ciecierzyca, oliwa, czosnek, sok z cytryny.",
    instructions:
      "Upiecz warzywa, ugotuj komose i polacz wszystko z ciecierzyca oraz dressingiem cytrynowym.",
    time: "30-35 min",
  },
  {
    title: "Leczo warzywne",
    tags: "wegetarianskie weganskie bezmiesa papryka szybkie",
    why: "Klasyk warzywny, prosty i latwy do przygotowania z podstawowych skladnikow.",
    ingredients:
      "Papryka, cukinia, cebula, pomidory, czosnek, oliwa, wedzona papryka.",
    instructions:
      "Podsmaz cebule, dodaj warzywa i duĹ› do miekkosci. Dopraw papryka i podawaj z pieczywem lub ryzem.",
    time: "25-30 min",
  },
  {
    title: "Zupa pomidorowa z ryzem",
    tags: "zupa klasyczne bezglutenowe ryz",
    why: "Sprawdzona, domowa propozycja na szybki i lekki obiad.",
    ingredients:
      "Passata pomidorowa, bulion, marchew, cebula, ryz, smietanka, bazylia.",
    instructions:
      "Ugotuj warzywa w bulionie, dodaj passate i ryz, gotuj do miekkosci i zakoncz smietanka.",
    time: "30-35 min",
  },
  {
    title: "Zupa krem z pieczonej dyni",
    tags: "zupa dynia wegetarianskie bezglutenowe",
    why: "Powszechnie znana i wielokrotnie testowana propozycja sezonowa.",
    ingredients: "Dynia, cebula, czosnek, bulion, smietanka lub mleko kokosowe, pestki dyni.",
    instructions:
      "Upiecz dynie z cebula i czosnkiem, zblenduj z bulionem, dopraw i podawaj z pestkami.",
    time: "35-45 min",
  },
  {
    title: "Frittata ze szpinakiem i feta",
    tags: "jajka sniadanie kolacja wegetarianskie",
    why: "Proste danie jajeczne, dobre na sniadanie, lunch lub kolacje.",
    ingredients:
      "Jajka, szpinak, feta, cebula, pomidorki koktajlowe, oliwa, pieprz.",
    instructions:
      "Podsmaz cebule i szpinak, zalej roztrzepanymi jajkami, dodaj fete i zapiecz lub zetnij na malej mocy.",
    time: "20-25 min",
  },
];

const INTERNET_DESSERT_CATALOG = [
  {
    title: "Tiramisu klasyczne",
    tags: "deser mascarpone biszkopty kawa szybkie",
    why: "Klasyczny deser warstwowy, bardzo popularny i latwy do przygotowania bez pieczenia.",
    ingredients: "Mascarpone, biszkopty, mocna kawa, jajka, cukier, kakao.",
    instructions:
      "Utrzyj zoltka z cukrem, dodaj mascarpone i ubita piane z bialek. Przekladaj warstwami biszkopty nasaczone kawa i krem. Schlodz minimum 3 godziny.",
    time: "25-30 min",
  },
  {
    title: "Brownie czekoladowe",
    tags: "deser ciasto czekolada pieczone",
    why: "Sprawdzony wypiek z intensywnym smakiem czekolady i wilgotnym srodkiem.",
    ingredients: "Gorzka czekolada, maslo, jajka, cukier, maka pszenna, kakao.",
    instructions:
      "Rozpusc czekolade z maslem, dodaj jajka i cukier, wmieszaj make z kakao. Piecz w 175C przez 25-30 minut.",
    time: "35-45 min",
  },
  {
    title: "Panna cotta waniliowa z owocami",
    tags: "deser kremowy wanilia owoce bez pieczenia",
    why: "Lekki deser o gladkiej konsystencji, czesto wybierany na szybkie przygotowanie.",
    ingredients: "Smietanka 30%, mleko, zelatyna, cukier, wanilia, owoce sezonowe.",
    instructions:
      "Podgrzej smietanke z mlekiem, cukrem i wanilia. Dodaj namoczona zelatyne, rozlej do foremek i schlodz. Podawaj z owocami.",
    time: "20-25 min",
  },
  {
    title: "Sernik na zimno z truskawkami",
    tags: "deser sernik bez pieczenia truskawki",
    why: "Popularny deser na cieplo dni, prosty i bardzo efektowny.",
    ingredients: "Twarog sernikowy, mascarpone, cukier puder, zelatyna, truskawki, biszkopty.",
    instructions:
      "Przygotuj krem z twarogu i mascarpone, dodaj zelatyne. Wylej na spod z biszkoptow, wyloz truskawki i schlodz.",
    time: "25-30 min",
  },
  {
    title: "Muffinki jagodowe",
    tags: "deser muffinki pieczone owoce",
    why: "Szybkie babeczki, ktore dobrze wychodza nawet przy podstawowych skladnikach.",
    ingredients: "Maka, proszek do pieczenia, cukier, jajka, mleko, maslo, jagody.",
    instructions:
      "Polacz suche i mokre skladniki, delikatnie dodaj jagody. Napelnij foremki do 3/4 i piecz 20-22 minuty w 180C.",
    time: "30-35 min",
  },
  {
    title: "Racuchy z jablkami",
    tags: "deser sniadanie jablka smazenie",
    why: "Domowy klasyk na slodko, szybki i sycacy.",
    ingredients: "Maka, drozdze lub proszek, mleko, jajko, jablka, cukier, cynamon.",
    instructions:
      "Wymieszaj ciasto, dodaj pokrojone jablka i smaz male placuszki na rumiano z obu stron.",
    time: "25-30 min",
  },
  {
    title: "Szarlotka krucha",
    tags: "deser ciasto jablka pieczone",
    why: "Tradycyjny wypiek z jablkami, sprawdzony w domowych przepisach.",
    ingredients: "Maka, maslo, cukier, jajka, jablka, cynamon, proszek do pieczenia.",
    instructions:
      "Zagniec kruche ciasto, podpiecz spod, dodaj duszone jablka z cynamonem i przykryj druga warstwa ciasta. Piecz do zarumienienia.",
    time: "60-75 min",
  },
  {
    title: "Krem czekoladowy z awokado",
    tags: "deser fit czekolada bez pieczenia",
    why: "Szybki deser o kremowej konsystencji, popularny w lzejszych wersjach slodyczy.",
    ingredients: "Dojrzale awokado, kakao, miod lub syrop klonowy, mleko, wanilia.",
    instructions:
      "Zblenduj wszystkie skladniki na gladki krem. Schlodz i podawaj z owocami lub orzechami.",
    time: "10-15 min",
  },
  {
    title: "Suflet czekoladowy",
    tags: "deser czekolada pieczone",
    why: "Efektowny deser z plynnym srodkiem, czesto wybierany na specjalne okazje.",
    ingredients: "Gorzka czekolada, maslo, jajka, cukier, maka, szczypta soli.",
    instructions:
      "Rozpusc czekolade z maslem, dodaj zoltka i make, potem delikatnie bialka ubite z cukrem. Piecz krotko w mocno nagrzanym piekarniku.",
    time: "20-25 min",
  },
  {
    title: "Nalesniki z serem waniliowym",
    tags: "deser nalesniki twarog wanilia",
    why: "Popularna opcja na slodki posilek lub deser, latwa do modyfikacji.",
    ingredients: "Maka, mleko, jajka, twarog, cukier puder, wanilia, maslo.",
    instructions:
      "Usmaz cienkie nalesniki. Przygotuj farsz z twarogu i wanilii, nadziej i podgrzej na patelni lub zapiecz.",
    time: "25-35 min",
  },
  {
    title: "Pudding chia mango",
    tags: "deser fit chia mango bez pieczenia",
    why: "Prosty deser przygotowywany na zimno, czesto wybierany w lzejszej wersji.",
    ingredients: "Nasiona chia, mleko kokosowe, mango, miod, limonka.",
    instructions:
      "Wymieszaj chia z mlekiem i odstaw na kilka godzin do napecznienia. Podawaj z musem z mango i sokiem z limonki.",
    time: "10-15 min",
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

function scoreInternetRecipeSimilarity(prompt, recipe) {
  return scoreRecipeSearchSimilarity(prompt, {
    nazwa: recipe?.title || "",
    skladniki: recipe?.ingredients || "",
    tagi: recipe?.tags || "",
  });
}

function internetCatalogForCategory(category) {
  return normalizeRecipeCategory(category) === "Deser"
    ? INTERNET_DESSERT_CATALOG
    : INTERNET_RECIPE_CATALOG;
}

function modeHintsForCategory(category) {
  return normalizeRecipeCategory(category) === "Deser"
    ? DESSERT_MODE_HINTS
    : MEAL_MODE_HINTS;
}

function scorePromptHintSignal(prompt, category) {
  const normalizedPrompt = normalizePhrase(prompt);
  if (!normalizedPrompt) return 0;

  const hints = modeHintsForCategory(category);
  let hits = 0;
  for (const hint of hints) {
    if (normalizedPrompt.includes(hint)) hits += 1;
  }
  if (hits === 0) return 0;

  return Math.min(90, 32 + hits * 14);
}

function scorePromptSimilarityToCatalog(prompt, catalog) {
  if (!Array.isArray(catalog) || catalog.length === 0) return 0;

  let maxScore = 0;
  for (const recipe of catalog) {
    const score = scoreInternetRecipeSimilarity(prompt, recipe);
    if (score > maxScore) maxScore = score;
  }
  return maxScore;
}

function scorePromptSimilarityToRecipes(prompt, recipes) {
  if (!Array.isArray(recipes) || recipes.length === 0) return 0;

  let maxScore = 0;
  for (const recipe of recipes) {
    const score = scoreRecipeSearchSimilarity(prompt, recipe);
    if (score > maxScore) maxScore = score;
  }
  return maxScore;
}

function categorySignalScore(prompt, allRecipes, category) {
  const normalizedCategory = normalizeRecipeCategory(category);
  const recipeScore = scorePromptSimilarityToRecipes(
    prompt,
    filterRecipesByCategory(allRecipes, normalizedCategory),
  );
  const internetScore = scorePromptSimilarityToCatalog(
    prompt,
    internetCatalogForCategory(normalizedCategory),
  );
  const hintScore = scorePromptHintSignal(prompt, normalizedCategory);
  return Math.max(recipeScore, internetScore, hintScore);
}

function oppositeRecipeCategory(category) {
  return normalizeRecipeCategory(category) === "Deser" ? "Posilek" : "Deser";
}

function resolveCategoryForPrompt(prompt, requestedCategory, allRecipes) {
  const selectedCategory = normalizeRecipeCategory(requestedCategory);
  const normalizedPrompt = normalizePhrase(prompt);
  if (!normalizedPrompt) return selectedCategory;

  const oppositeCategory = oppositeRecipeCategory(selectedCategory);
  const selectedScore = categorySignalScore(normalizedPrompt, allRecipes, selectedCategory);
  const oppositeScore = categorySignalScore(normalizedPrompt, allRecipes, oppositeCategory);

  if (
    oppositeScore >= CATEGORY_SWITCH_MIN_SCORE &&
    oppositeScore >= selectedScore + CATEGORY_SWITCH_SCORE_GAP
  ) {
    return oppositeCategory;
  }

  return selectedCategory;
}

function optionLooksLikeDessert(option) {
  const raw = `${safeString(option?.title)} ${safeString(option?.why)} ${safeString(
    option?.ingredients,
  )} ${safeString(option?.instructions)}`;
  const normalized = normalizePhrase(raw);
  if (!normalized) return false;
  return DESSERT_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function isOptionCompatibleWithCategory(option, category) {
  const normalizedCategory = normalizeRecipeCategory(category);
  if (normalizedCategory === "Deser") return optionLooksLikeDessert(option);
  return !optionLooksLikeDessert(option);
}

function internetFallbackOptions(
  prompt,
  limit = 2,
  existingOptions = [],
  category = DEFAULT_RECIPE_CATEGORY,
) {
  const catalog = internetCatalogForCategory(category);
  if (!Array.isArray(catalog) || catalog.length === 0) return [];

  const seed = hashPromptSeed(prompt);
  const usedTitles = new Set(
    existingOptions.map((option) => normalizePhrase(option?.title || "")).filter(Boolean),
  );
  const options = [];

  const rankedCatalog = catalog
    .map((recipe, index) => ({
      recipe,
      score: scoreInternetRecipeSimilarity(prompt, recipe),
      tieBreaker: (seed + index) % catalog.length,
    }))
    .sort((left, right) => right.score - left.score || left.tieBreaker - right.tieBreaker);

  for (const row of rankedCatalog) {
    if (options.length >= limit) break;
    const recipe = row.recipe;
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
  return recipes.some((recipe) => scoreRecipeSearchSimilarity(optionTitle, recipe) >= 36);
}

function optionFromRecipe(recipe, whyText) {
  const ingredientsList = splitTextList(recipe?.skladniki, 18);
  const steps = splitTextList(
    safeString(recipe?.opis).replace(/krok\s*\d+\s*[:.)-]?\s*/gi, "\n"),
    12,
  );
  const tags = splitTextList(recipe?.tagi, 10);

  return normalizeOption({
    recipe_id: recipe.id,
    title: recipe.nazwa,
    short_description:
      safeString(recipe?.opis).split(/[.!?]/)[0] || "Sprawdzony przepis z aktualnej bazy.",
    why: whyText || "To danie pasuje do Twojego zapytania.",
    ingredients: recipe.skladniki,
    ingredients_list: ingredientsList,
    instructions: recipe.opis,
    steps,
    tags,
    shopping_list: ingredientsList,
    time: normalizePreparationTime(recipe.czas) || "Brak danych",
    link_filmu: recipe.link_filmu || "",
    link_strony: recipe.link_strony || "",
  });
}

function topUpOptionsFromDatabase(
  prompt,
  recipes,
  excludedSet,
  usedRecipeIds,
  limit,
  whyText,
) {
  if (!Array.isArray(recipes) || limit <= 0) return [];

  const options = [];
  const pushRecipe = (recipe) => {
    if (!recipe || usedRecipeIds.has(recipe.id) || excludedSet.has(recipe.id)) {
      return;
    }

    usedRecipeIds.add(recipe.id);
    options.push(optionFromRecipe(recipe, whyText));
  };

  const rankedRecipes = findMatchingRecipesByNameOrTags(
    prompt,
    recipes,
    excludedSet,
    recipes.length,
    DB_MATCH_MIN_SCORE,
  );
  for (const recipe of rankedRecipes) {
    if (options.length >= limit) break;
    pushRecipe(recipe);
  }

  return options;
}

function recipePhrasesByCategory(category) {
  if (normalizeRecipeCategory(category) === "Deser") {
    return {
      label: "deser",
      matchByName: "Ten deser ma nazwe bardzo podobna do Twojego zapytania.",
      matchGeneral: "Ten deser pasuje do Twojego zapytania.",
      matchStrict: "Ten deser jest zgodny z Twoim zapytaniem.",
    };
  }
  return {
    label: "danie",
    matchByName: "To danie ma nazwe bardzo podobna do Twojego zapytania.",
    matchGeneral: "To danie pasuje do Twojego zapytania.",
    matchStrict: "To danie jest zgodne z Twoim zapytaniem.",
  };
}

function buildAssistantText(
  category = DEFAULT_RECIPE_CATEGORY,
  useVerifiedRecipesFallback = false,
) {
  const normalizedCategory = normalizeRecipeCategory(category);
  if (useVerifiedRecipesFallback) {
    return normalizedCategory === "Deser"
      ? `${ASSISTANT_TEXT_INTRO} To 2 slodkie propozycje oparte na sprawdzonych przepisach.`
      : `${ASSISTANT_TEXT_INTRO} To 2 propozycje oparte na sprawdzonych przepisach.`;
  }

  return normalizedCategory === "Deser"
    ? `${ASSISTANT_TEXT_INTRO} Przygotowalem dla Ciebie 2 slodkie propozycje.`
    : `${ASSISTANT_TEXT_INTRO} Przygotowalem dla Ciebie 2 propozycje.`;
}

function fallbackOptionsFromRecipes(
  prompt,
  recipes,
  excludedSet,
  category = DEFAULT_RECIPE_CATEGORY,
  intent = null,
) {
  const phrases = recipePhrasesByCategory(category);
  const nameSimilar = findNameSimilarRecipes(prompt, recipes, excludedSet, 1);
  const matched = findMatchingRecipesByNameOrTags(
    prompt,
    recipes,
    excludedSet,
    2,
    DB_MATCH_MIN_SCORE,
  );
  const hasDbMatch = nameSimilar.length > 0 || matched.length > 0;
  const options = [];
  const used = new Set();

  if (nameSimilar.length > 0) {
    options.push(
      optionFromRecipe(
        nameSimilar[0],
        phrases.matchByName,
      ),
    );
    used.add(nameSimilar[0].id);
  }

  for (const row of matched) {
    if (options.length >= 2) break;
    if (used.has(row.id)) continue;
    options.push(optionFromRecipe(row, phrases.matchGeneral));
    used.add(row.id);
  }

  if (options.length < 2 && hasDbMatch) {
    options.push(
      ...topUpOptionsFromDatabase(
        prompt,
        recipes,
        excludedSet,
        used,
        2 - options.length,
        phrases.matchGeneral,
      ),
    );
  }

  if (options.length < 2) {
    options.push(...internetFallbackOptions(prompt, 2 - options.length, options, category));
  }

  const intentFilteredOptions = intent ? filterOptionsByIntent(options, intent, 2) : options.slice(0, 2);
  const finalOptions = intentFilteredOptions.slice(0, 2);

  const useVerifiedRecipesFallback = shouldAssistantUseVerifiedRecipesFallback(
    finalOptions,
    hasDbMatch,
  );

  return {
    assistantText: finalizeAssistantText(
      buildAssistantText(category, useVerifiedRecipesFallback),
      category === "Deser"
        ? `${ASSISTANT_TEXT_INTRO} Przygotowalem dla Ciebie 2 slodkie propozycje.`
        : `${ASSISTANT_TEXT_INTRO} Przygotowalem dla Ciebie 2 propozycje.`,
    ),
    options: finalOptions,
  };
}

function readGroqApiKey() {
  return safeString(process.env.GROQ_API_KEY);
}

function readGeminiApiKey() {
  return safeString(process.env.GEMINI_API_KEY);
}

function normalizeGeminiModelName(value) {
  const model = safeString(value).replace(/^models\//i, "");
  if (!model) return "";

  if (model === "gemini-1.5-flash") {
    return "gemini-2.5-flash";
  }

  return model;
}

function geminiModelCandidates() {
  return Array.from(
    new Set(
      [
        normalizeGeminiModelName(GEMINI_VISION_MODEL),
        "gemini-2.5-flash",
        "gemini-2.0-flash",
        "gemini-flash-latest",
        "gemini-1.5-flash",
        "gemini-1.5-flash-002",
        "gemini-1.5-flash-001",
        "gemini-1.5-pro",
        "gemini-1.5-pro-002",
        "gemini-1.5-pro-001",
      ].filter(Boolean),
    ),
  );
}

async function listGeminiModels(apiKey) {
  const now = Date.now();
  if (geminiModelsCache && now - geminiModelsCache.ts < GEMINI_MODEL_DISCOVERY_TTL_MS) {
    return geminiModelsCache.models;
  }

  let response = null;
  let lastError = "";
  for (let attempt = 0; attempt <= AI_HTTP_MAX_RETRIES; attempt += 1) {
    try {
      response = await fetchWithTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(
          apiKey,
        )}`,
      );
    } catch (error) {
      lastError = safeString(error?.message) || "Blad sieci podczas pobierania modeli Gemini.";
      if (attempt >= AI_HTTP_MAX_RETRIES) {
        throw new Error(lastError);
      }
      await sleep((attempt + 1) * 300);
      continue;
    }
    if (response.ok) break;

    const raw = await response.text();
    lastError = `Blad Gemini HTTP ${response.status}: ${raw.slice(0, 300)}`;
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt >= AI_HTTP_MAX_RETRIES) {
      throw new Error(lastError);
    }
    await sleep((attempt + 1) * 300);
  }

  if (!response.ok) {
    throw new Error(lastError || "Blad Gemini: nieudane pobranie listy modeli.");
  }

  const data = await response.json();
  const models = Array.isArray(data?.models) ? data.models : [];

  geminiModelsCache = {
    ts: now,
    models,
  };

  return models;
}

async function resolveGeminiModelsForGenerateContent(apiKey) {
  const preferred = geminiModelCandidates();

  try {
    const models = await listGeminiModels(apiKey);
    const available = models
      .filter((model) =>
        Array.isArray(model?.supportedGenerationMethods) &&
        model.supportedGenerationMethods.includes("generateContent"),
      )
      .map((model) => normalizeGeminiModelName(model?.name || model?.baseModelId))
      .filter(Boolean);

    if (available.length > 0) {
      const availableSet = new Set(available);
      const resolved = preferred.filter((model) => availableSet.has(model));
      if (resolved.length > 0) {
        return resolved;
      }
      return available;
    }
  } catch {
    // Fallback to known aliases below if model discovery fails.
  }

  return preferred;
}

function parseJsonObjectFromText(value) {
  const raw = safeLimitedString(value, RECIPE_TEXT_MAX_CHARS * 2);
  if (!raw) return {};

  const direct = raw.trim();
  const candidates = [direct];
  const fencedMatch = direct.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch?.[1]) {
    candidates.push(fencedMatch[1].trim());
  }

  const firstBrace = direct.indexOf("{");
  const lastBrace = direct.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(direct.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Try next candidate.
    }
  }

  return {};
}

function hasUsableJsonObject(value) {
  return Boolean(value && typeof value === "object" && Object.keys(value).length > 0);
}

async function repairJsonObjectWithGroq(rawResponse) {
  if (!readGroqApiKey()) {
    return {};
  }

  const repairedRaw = await groqCompletion(
    [
      {
        role: "system",
        content:
          "Naprawiasz odpowiedzi modelu. Zwracasz wylacznie poprawny JSON bez markdown i bez wyjasnien.",
      },
      {
        role: "user",
        content: buildJsonRepairPrompt(rawResponse),
      },
    ],
    { jsonObject: true },
  );

  return parseJsonObjectFromText(repairedRaw);
}

async function repairJsonObjectWithGemini(rawResponse) {
  if (!readGeminiApiKey()) {
    return {};
  }

  const repairedRaw = await geminiGenerateContent(
    [{ text: buildJsonRepairPrompt(rawResponse) }],
    { jsonObject: true },
  );

  return parseJsonObjectFromText(repairedRaw);
}

async function parseOrRepairJsonObject(rawResponse, strategy = "none") {
  const parsed = parseJsonObjectFromText(rawResponse);
  if (hasUsableJsonObject(parsed)) {
    return parsed;
  }

  try {
    if (strategy === "groq") {
      const repaired = await repairJsonObjectWithGroq(rawResponse);
      if (hasUsableJsonObject(repaired)) {
        return repaired;
      }
    }

    if (strategy === "gemini") {
      const repaired = await repairJsonObjectWithGemini(rawResponse);
      if (hasUsableJsonObject(repaired)) {
        return repaired;
      }
    }
  } catch {
    // Keep empty object fallback if repair also fails.
  }

  return {};
}

async function geminiGenerateContent(parts, options = {}) {
  const apiKey = readGeminiApiKey();
  if (!apiKey) {
    throw new Error("Blad konfiguracji: ustaw GEMINI_API_KEY dla analizy zdjec.");
  }

  const models = await resolveGeminiModelsForGenerateContent(apiKey);
  let lastError = null;

  for (const modelName of models) {
    let response = null;
    for (let attempt = 0; attempt <= AI_HTTP_MAX_RETRIES; attempt += 1) {
      try {
        response = await fetchWithTimeout(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
            modelName,
          )}:generateContent?key=${encodeURIComponent(apiKey)}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              contents: [
                {
                  role: "user",
                  parts,
                },
              ],
              generationConfig: options.jsonObject
                ? {
                    responseMimeType: "application/json",
                  }
                : undefined,
            }),
          },
        );
      } catch (error) {
        lastError = safeString(error?.message) || "Blad sieci podczas wywolania Gemini.";
        if (attempt >= AI_HTTP_MAX_RETRIES) {
          break;
        }
        await sleep((attempt + 1) * 300);
        continue;
      }

      if (response.ok) break;

      const raw = await response.text();
      lastError = `Blad Gemini HTTP ${response.status}: ${raw.slice(0, 300)}`;
      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable || attempt >= AI_HTTP_MAX_RETRIES) {
        break;
      }
      await sleep((attempt + 1) * 300);
    }

    if (!response || !response.ok) {
      if (response && response.status === 404) {
        continue;
      }
      if (lastError) {
        throw new Error(lastError);
      }
      throw new Error("Blad Gemini: nieudane wywolanie generateContent.");
    }

    const data = await response.json();
    const partsList = data?.candidates?.[0]?.content?.parts;
    const text = Array.isArray(partsList)
      ? partsList
          .map((part) => (typeof part?.text === "string" ? part.text : ""))
          .join("\n")
          .trim()
      : "";

    if (!text) {
      throw new Error("Blad AI: pusta odpowiedz analizy zdjecia.");
    }

    return text;
  }

  throw new Error(lastError || "Blad konfiguracji: brak wspieranego modelu Gemini.");
}

function validateInlineImageDataUrl(value, imageName = "") {
  const guard = validateInlineImageDataUrlGuard(value, {
    maxBytes: MAX_CHAT_IMAGE_BYTES,
    allowedMimeTypes: ALLOWED_CHAT_IMAGE_MIME_TYPES,
    allowedExtensions: ALLOWED_CHAT_IMAGE_EXTENSIONS,
    imageName,
  });
  if (!guard.ok) {
    throw new Error(guard.error || "Niepoprawny format zdjecia.");
  }
  return {
    mimeType: guard.mimeType,
    base64Data: guard.base64Data,
  };
}

function uniqueNormalizedStrings(values) {
  const seen = new Set();
  const result = [];

  for (const value of values) {
    const text = safeString(value);
    const key = normalizePhrase(text);
    if (!text || !key || seen.has(key)) continue;
    seen.add(key);
    result.push(text);
  }

  return result;
}

function photoPromptFromProducts(products, category = DEFAULT_RECIPE_CATEGORY) {
  const normalizedCategory = normalizeRecipeCategory(category);
  const normalizedProducts = uniqueNormalizedStrings(Array.isArray(products) ? products : []);

  if (normalizedProducts.length === 0) {
    return normalizedCategory === "Deser"
      ? "Zaproponuj prosty deser na podstawie skĹ‚adnikĂłw ze zdjÄ™cia."
      : "Zaproponuj prosty posiĹ‚ek na podstawie produktĂłw ze zdjÄ™cia.";
  }

  const productList = normalizedProducts.join(", ");
  return normalizedCategory === "Deser"
    ? `Na zdjÄ™ciu mam: ${productList}. Zaproponuj deser na podstawie tych skĹ‚adnikĂłw.`
    : `Na zdjÄ™ciu mam: ${productList}. Zaproponuj posiĹ‚ek na podstawie tych produktĂłw.`;
}

function photoAssistantFallback(products, category = DEFAULT_RECIPE_CATEGORY) {
  const normalizedCategory = normalizeRecipeCategory(category);
  const normalizedProducts = uniqueNormalizedStrings(Array.isArray(products) ? products : []);

  if (normalizedProducts.length === 0) {
    return normalizedCategory === "Deser"
      ? "PrzeanalizowaĹ‚em zdjÄ™cie i przygotowaĹ‚em sĹ‚odkie propozycje."
      : "PrzeanalizowaĹ‚em zdjÄ™cie i przygotowaĹ‚em propozycje.";
  }

  return normalizedCategory === "Deser"
    ? `Na zdjÄ™ciu widzÄ™: ${normalizedProducts.join(", ")}. Na tej podstawie mam sĹ‚odkie propozycje.`
    : `Na zdjÄ™ciu widzÄ™: ${normalizedProducts.join(", ")}. Na tej podstawie mam propozycje.`;
}

function combineAssistantTexts(photoText, generatedText, category = DEFAULT_RECIPE_CATEGORY) {
  const photoPart = safeString(photoText).replace(/\s+/g, " ").trim();
  const generatedPart = safeString(generatedText).replace(/\s+/g, " ").trim();

  if (photoPart && generatedPart) {
    return sanitizeChatText(
      `${photoPart.replace(/[.!?\s]+$/g, "")}. ${generatedPart}`,
      photoAssistantFallback([], category),
    );
  }

  return sanitizeChatText(
    photoPart || generatedPart,
    photoAssistantFallback([], category),
  );
}

async function analyzePhotoIngredients(
  imageDataUrl,
  category = DEFAULT_RECIPE_CATEGORY,
  imageName = "",
) {
  const { mimeType, base64Data } = validateInlineImageDataUrl(imageDataUrl, imageName);
  const normalizedCategory = normalizeRecipeCategory(category);
  const analysisPrompt = buildPhotoAnalysisPrompt(normalizedCategory);

  const raw = await geminiGenerateContent(
    [
      { text: analysisPrompt },
      {
        inline_data: {
          mime_type: mimeType,
          data: base64Data,
        },
      },
    ],
    {
      jsonObject: true,
    },
  );

  const parsed = await parseOrRepairJsonObject(raw, "gemini");

  const detectedProducts = uniqueNormalizedStrings(
    Array.isArray(parsed?.detected_products) ? parsed.detected_products : [],
  ).slice(0, 8);

  if (detectedProducts.length === 0) {
    throw new Error(
      "Nie udalo sie rozpoznac produktow na zdjeciu. Zrob wyrazniejsze zdjecie z bliska.",
    );
  }

  return {
    detectedProducts,
    prompt: sanitizeChatText(
      parsed?.user_prompt,
      photoPromptFromProducts(detectedProducts, normalizedCategory),
    ),
    assistantText: sanitizeChatText(
      parsed?.assistant_text,
      photoAssistantFallback(detectedProducts, normalizedCategory),
    ),
  };
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

  const response = await postJsonWithRetry({
    url: "https://api.groq.com/openai/v1/chat/completions",
    payload,
    timeoutMs: AI_HTTP_TIMEOUT_MS,
    maxRetries: AI_HTTP_MAX_RETRIES,
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("Blad AI: pusta odpowiedz modelu.");
  }
  return content;
}

async function generateOptions(
  prompt,
  history,
  excludedRecipeIds,
  category = DEFAULT_RECIPE_CATEGORY,
  requestOptions = {},
) {
  const safePrompt = truncateForModel(prompt, CHAT_PROMPT_MAX_CHARS);
  const modelPrompt = redactSensitiveText(safePrompt);
  const promptInjectionDetected = isPromptInjectionLike(safePrompt);
  const forceLocalOnly = Boolean(requestOptions?.forceLocalOnly);
  const normalizedFilters = normalizeChatFilters(requestOptions?.filters);
  const requestedCategory = normalizeRecipeCategory(category);
  const allRecipes = await listRecipesDesc();
  const autoDetectedCategory = resolveCategoryForPrompt(safePrompt, requestedCategory, allRecipes);
  const intent = buildUserIntent(safePrompt, autoDetectedCategory, normalizedFilters);
  const selectedCategory = normalizeRecipeCategory(intent.mealType || autoDetectedCategory);
  intent.mealType = selectedCategory;
  const categoryAutoSwitched = selectedCategory !== requestedCategory;

  const conflict = detectIntentConflict(intent, safePrompt);
  if (conflict) {
    return {
      ...buildConflictResponsePayload(conflict, intent, selectedCategory, normalizedFilters),
      categoryAutoSwitched,
    };
  }

  const phrases = recipePhrasesByCategory(selectedCategory);
  const categoryRecipes = filterRecipesByCategory(allRecipes, selectedCategory);
  const excluded = Array.isArray(excludedRecipeIds)
    ? excludedRecipeIds
        .slice(0, 64)
        .map((value) => safeInt(value))
        .filter((value) => value !== null)
    : [];
  const excludedSet = new Set(excluded);
  const availableRecipes = categoryRecipes.filter((recipe) => !excludedSet.has(recipe.id));
  const intentMatchedRecipes = filterRecipesByIntent(availableRecipes, intent);
  const candidateRecipes = intentMatchedRecipes.length > 0 ? intentMatchedRecipes : availableRecipes;

  if (intentHasStrongConstraints(intent) && intentMatchedRecipes.length === 0) {
    return {
      ...buildClarificationResponsePayload(
        intent,
        selectedCategory,
        normalizedFilters,
        "Nie znalazlem propozycji spelniajacych wszystkie ograniczenia. Co moge poluzowac: czas, diete czy metode przygotowania?",
      ),
      categoryAutoSwitched,
      constraintNote: "Brak zgodnych wynikow dla ustawionych filtrow i ograniczen.",
    };
  }

  if (shouldAskClarification(intent, safePrompt, candidateRecipes.length)) {
    return {
      ...buildClarificationResponsePayload(intent, selectedCategory, normalizedFilters),
      categoryAutoSwitched,
    };
  }

  const nameSimilar = findNameSimilarRecipes(safePrompt, candidateRecipes, excludedSet, 1);
  const requiredRecipe = nameSimilar[0] || null;
  const strongMatched = findMatchingRecipesByNameOrTags(
    safePrompt,
    candidateRecipes,
    excludedSet,
    4,
    DB_MATCH_MIN_SCORE,
  );
  const allowedDbIds = new Set(strongMatched.map((recipe) => recipe.id));
  if (requiredRecipe) {
    allowedDbIds.add(requiredRecipe.id);
  }
  const hasDbMatch = allowedDbIds.size > 0;

  if (!readGroqApiKey() || promptInjectionDetected || forceLocalOnly) {
    const fallback = fallbackOptionsFromRecipes(
      safePrompt,
      candidateRecipes,
      excludedSet,
      selectedCategory,
      intent,
    );
    const fallbackOptions = filterOptionsByIntent(fallback.options, intent, 2);
    if (fallbackOptions.length === 0 && intentHasStrongConstraints(intent)) {
      return {
        ...buildClarificationResponsePayload(
          intent,
          selectedCategory,
          normalizedFilters,
          "Potrzebuje doprecyzowania, bo ograniczenia sa bardzo restrykcyjne. Co ma najwiekszy priorytet: dieta, czas czy koszt?",
        ),
        categoryAutoSwitched,
        constraintNote: "Fallback nie znalazl opcji zgodnych z ograniczeniami.",
      };
    }

    return {
      ...fallback,
      options: fallbackOptions.length > 0 ? fallbackOptions : fallback.options,
      assistantText: promptInjectionDetected || forceLocalOnly
        ? assistantFallbackTextForPrompt(selectedCategory)
        : fallback.assistantText,
      category: selectedCategory,
      categoryAutoSwitched,
      needsClarification: false,
      clarificationQuestion: "",
      intent,
      appliedFilters: normalizedFilters,
      constraintNote: intent.contradictionNotes[0] || "",
    };
  }

  const systemMsg = buildRecipeChatSystemPrompt(selectedCategory, intent);

  const messages = [{ role: "system", content: systemMsg }, ...normalizeHistory(history)];
  const requiredRecipeId = requiredRecipe?.id ?? null;
  const allowedRecipeIds = Array.from(allowedDbIds).sort((left, right) => left - right);
  const recipeContextItems = hasDbMatch
    ? buildPromptRecipeContextItems(
        candidateRecipes.filter((recipe) => allowedDbIds.has(recipe.id)),
      )
    : [];
  messages.push({
    role: "user",
    content: buildRecipeChatUserPrompt({
      prompt: modelPrompt,
      selectedCategory,
      requiredRecipeId,
      allowedRecipeIds,
      hasDbMatch,
      recipeContextItems,
      excludedRecipeIds: excluded,
      intent,
      filters: normalizedFilters,
    }),
  });

  const raw = await groqCompletion(messages, { jsonObject: true });
  const parsed = await parseOrRepairJsonObject(raw, "groq");

  const parsedNeedsClarification =
    parsed?.needs_clarification === true || parsed?.needsClarification === true;
  if (parsedNeedsClarification) {
    return {
      ...buildClarificationResponsePayload(
        intent,
        selectedCategory,
        normalizedFilters,
        sanitizeChatText(
          parsed?.clarification_question || parsed?.clarificationQuestion,
          buildClarificationQuestion(intent, selectedCategory),
        ),
      ),
      categoryAutoSwitched,
    };
  }

  const optionsRaw = Array.isArray(parsed?.options) ? parsed.options : [];
  const options = [];
  const usedRecipeIds = new Set();
  const recipeMap = new Map(candidateRecipes.map((recipe) => [recipe.id, recipe]));

  for (const item of optionsRaw) {
    const option = normalizeOption(item);
    if (!isOptionCompatibleWithIntent(option, intent)) {
      continue;
    }

    if (option.recipe_id !== null) {
      const recipe = recipeMap.get(option.recipe_id);
      if (recipe && allowedDbIds.has(recipe.id)) {
        const dbOption = optionFromRecipe(recipe, option.why || phrases.matchGeneral);
        if (!isOptionCompatibleWithIntent(dbOption, intent)) {
          if (options.length >= 2) break;
          continue;
        }
        options.push(dbOption);
        usedRecipeIds.add(recipe.id);
      }
      if (options.length >= 2) break;
      continue;
    }

    if (hasDbMatch) {
      continue;
    }

    if (!isOptionCompatibleWithCategory(option, selectedCategory)) {
      continue;
    }

    if (!hasDbMatch && isDbLikeOption(option, candidateRecipes)) {
      continue;
    }

    options.push(option);

    if (options.length >= 2) break;
  }

  if (requiredRecipe && !usedRecipeIds.has(requiredRecipe.id)) {
    const requiredOption = optionFromRecipe(
      requiredRecipe,
      phrases.matchByName,
    );
    if (!isOptionCompatibleWithIntent(requiredOption, intent)) {
      // Skip hard-required DB option if it violates explicit user constraints.
    } else if (options.length < 2) {
      options.unshift(requiredOption);
      usedRecipeIds.add(requiredRecipe.id);
    } else {
      const nonDbIndex = options.findIndex((item) => item.recipe_id === null);
      if (nonDbIndex >= 0) {
        options[nonDbIndex] = requiredOption;
      } else {
        options[1] = requiredOption;
      }
      usedRecipeIds.add(requiredRecipe.id);
    }
  }

  if (hasDbMatch && options.length < 2) {
    for (const recipe of strongMatched) {
      if (options.length >= 2) break;
      if (usedRecipeIds.has(recipe.id)) continue;
      const nextOption = optionFromRecipe(recipe, phrases.matchStrict);
      if (!isOptionCompatibleWithIntent(nextOption, intent)) continue;
      options.push(nextOption);
      usedRecipeIds.add(recipe.id);
    }
  }

  if (hasDbMatch && options.length < 2) {
    options.push(
      ...topUpOptionsFromDatabase(
        safePrompt,
        candidateRecipes,
        excludedSet,
        usedRecipeIds,
        2 - options.length,
        phrases.matchGeneral,
      ),
    );
  }

  if (options.length < 2) {
    const internetOptions = internetFallbackOptions(
      safePrompt,
      2 - options.length,
      options,
      selectedCategory,
    );
    options.push(...filterOptionsByIntent(internetOptions, intent, 2 - options.length));
  }

  while (options.length < 2) {
    const isDessertMode = selectedCategory === "Deser";
    const emergencyOption = normalizeOption({
      recipe_id: null,
      title: isDessertMode ? "Domowy deser awaryjny" : "Domowe danie awaryjne",
      short_description: "Szybka propozycja wymagajaca doprecyzowania.",
      why: "Awaryjna propozycja oparta o sprawdzone schematy.",
      ingredients: isDessertMode
        ? "Podaj slodkie skladniki bazowe, np. owoce, jogurt, kakao."
        : "Podaj 2-3 glowne skladniki, a doprecyzuje recepture.",
      ingredients_list: isDessertMode
        ? ["owoce", "jogurt", "kakao", "platki owsiane"]
        : ["produkt bazowy", "warzywo", "przyprawa"],
      instructions: "Odpisz, co masz pod reka, a od razu doprecyzuje kroki.",
      steps: [
        "Wybierz skladnik bazowy.",
        "Dobierz dodatki zgodne z ograniczeniami.",
        "Przygotuj wybrana technika.",
      ],
      substitutions: [],
      shopping_list: [],
      time: "20-30 min",
      servings: 2,
    });
    if (!isOptionCompatibleWithIntent(emergencyOption, intent)) {
      break;
    }
    options.push(emergencyOption);
  }

  const constrainedOptions = filterOptionsByIntent(options, intent, 2);
  if (constrainedOptions.length === 0 && intentHasStrongConstraints(intent)) {
    return {
      ...buildClarificationResponsePayload(
        intent,
        selectedCategory,
        normalizedFilters,
        "Nie udalo sie wygenerowac 2 propozycji zgodnych ze wszystkimi ograniczeniami. Ktory warunek mam poluzowac?",
      ),
      categoryAutoSwitched,
      constraintNote: "Model zwrocil propozycje niespelniajace ograniczen.",
    };
  }

  const useVerifiedRecipesFallback = shouldAssistantUseVerifiedRecipesFallback(
    constrainedOptions,
    hasDbMatch,
  );
  const assistantText = finalizeAssistantText(
    parsed?.assistant_text || parsed?.assistantText,
    buildAssistantText(selectedCategory, useVerifiedRecipesFallback),
  );
  return {
    assistantText,
    options: constrainedOptions
      .slice(0, 2)
      .map((option) => ({
        ...option,
        title: sanitizeChatText(option?.title, "Danie"),
        why: sanitizeChatText(option?.why, "To danie pasuje do Twojego zapytania."),
      })),
    category: selectedCategory,
    categoryAutoSwitched,
    needsClarification: false,
    clarificationQuestion: "",
    intent,
    appliedFilters: normalizedFilters,
    constraintNote: intent.contradictionNotes[0] || "",
  };
}

function logFeedback(payload) {
  cleanupFeedbackRetention();
  const option1 = payload?.option1 || {};
  const option2 = payload?.option2 || {};

  store.feedback.push({
    id: store.nextFeedbackId++,
    ts: new Date().toISOString(),
    user_text: redactSensitiveText(
      safeLimitedString(payload?.userText, CHAT_FEEDBACK_TEXT_MAX_CHARS),
    ),
    option1_title: sanitizeModelOutputText(safeLimitedString(option1?.title, 160), 160),
    option1_recipe_id: safeInt(option1?.recipe_id),
    option2_title: sanitizeModelOutputText(safeLimitedString(option2?.title, 160), 160),
    option2_recipe_id: safeInt(option2?.recipe_id),
    action: safeLimitedString(payload?.action, 40),
    chosen_index: safeInt(payload?.chosenIndex),
    follow_up_answer: redactSensitiveText(
      safeLimitedString(payload?.followUpAnswer, CHAT_FEEDBACK_TEXT_MAX_CHARS),
    ),
  });

  if (store.feedback.length > CHAT_FEEDBACK_MAX_ITEMS) {
    store.feedback = store.feedback.slice(-CHAT_FEEDBACK_MAX_ITEMS);
  }

  persistStore();
}

function cleanupFeedbackRetention(now = Date.now()) {
  if (!Array.isArray(store.feedback) || store.feedback.length === 0) {
    return;
  }
  const cutoff = now - FEEDBACK_RETENTION_MS;
  const beforeCount = store.feedback.length;
  store.feedback = store.feedback.filter((item) => {
    const ts = Date.parse(safeString(item?.ts));
    return Number.isFinite(ts) && ts >= cutoff;
  });
  if (store.feedback.length !== beforeCount) {
    persistStore();
  }
}

async function createGeneratedRecipe(skladniki, opis) {
  const payload = {
    nazwa: `Przepis z: ${skladniki.slice(0, 30)}...`,
    skladniki,
    opis,
    czas: "",
    kategoria: DEFAULT_RECIPE_CATEGORY,
    tagi: "",
    link_filmu: "",
    link_strony: "",
  };
  return addRecipe(payload);
}

function recordOpsEvent(eventType, meta = {}) {
  return opsTelemetry.record(eventType, meta);
}

function runtimeStateSnapshot() {
  return {
    adminLoginRateLimitMax: ADMIN_LOGIN_RATE_LIMIT_MAX,
    adminPassword: ADMIN_PASSWORD,
    adminRouteRateLimitMax: ADMIN_ROUTE_RATE_LIMIT_MAX,
    adminSecurityReady: ADMIN_SECURITY_READY,
    anonSessionSecret: ANON_SESSION_SECRET,
    dbEnabled,
    dbLastError,
    feedbackCount: store.feedback.length,
    requireAdmin,
    sessionManager,
    sessionSecret: SESSION_SECRET,
    sessionStore,
    sessionTtlSeconds: SESSION_TTL_SECONDS,
  };
}

const handleOpsRoutes = createOpsRoutesHandler({
  sendJson,
  countRecipes,
  hasDbConfig,
  safeLimitedString,
  getState: runtimeStateSnapshot,
  fs,
  path,
  distPath,
  recordOpsEvent,
});

const handleAdminRoutes = createAdminRoutesHandler({
  sendJson,
  ensureSameOrigin,
  enforceRateLimit,
  parseJsonBodyOrRespond,
  validateAdminLoginPayload,
  safeLimitedString,
  timingSafeStringEquals,
  adminCookieHeader,
  clearAdminCookieHeader,
  createAdminToken,
  isAdminRequest,
  getClientIp,
  hashValue,
  logger,
  getState: runtimeStateSnapshot,
  getMetricsSnapshot: () => opsTelemetry.snapshot(),
});

async function handleApi(req, res, pathname) {
  const method = req.method || "GET";

  if (await handleOpsRoutes(req, res, pathname, method)) {
    return true;
  }

  if (await handleAdminRoutes(req, res, pathname, method)) {
    return true;
  }

  if (method === "POST" && pathname === "/backend/user/register") {
    if (!ensureSameOrigin(req, res)) return true;
    if (
      !enforceRateLimit(
        req,
        res,
        "user-login",
        USER_LOGIN_RATE_LIMIT_MAX,
        "Zbyt wiele prób logowania/rejestracji. Spróbuj ponownie później.",
      )
    ) {
      return true;
    }
    if (!USER_SECURITY_READY) {
      sendJson(res, 503, {
        error: "Logowanie użytkownika jest wyłączone: skonfiguruj USER_SESSION_SECRET (min. 32 znaki).",
      });
      return true;
    }

    const payload = await parseJsonBodyOrRespond(req, res);
    if (payload === null) return true;
    const validation = validateUserRegistrationPayload(payload);
    if (!validation.ok) {
      sendJson(res, validation.status, { error: validation.error });
      return true;
    }

    const created = await createUserAccount(validation.value);
    if (!created.ok) {
      sendJson(res, created.status || 400, { error: created.error || "Nie udało się założyć konta." });
      return true;
    }

    await markUserLogin(created.user.id);
    const token = createUserToken(created.user.id, false);
    sendJson(
      res,
      201,
      {
        ok: true,
        user: toUserSessionProfile(created.user),
      },
      {
        "Set-Cookie": userCookieHeader(token.token, token.maxAgeSeconds),
      },
    );
    return true;
  }

  if (method === "POST" && pathname === "/backend/user/login") {
    if (!ensureSameOrigin(req, res)) return true;
    if (
      !enforceRateLimit(
        req,
        res,
        "user-login",
        USER_LOGIN_RATE_LIMIT_MAX,
        "Zbyt wiele prób logowania/rejestracji. Spróbuj ponownie później.",
      )
    ) {
      return true;
    }
    if (!USER_SECURITY_READY) {
      sendJson(res, 503, {
        error: "Logowanie użytkownika jest wyłączone: skonfiguruj USER_SESSION_SECRET (min. 32 znaki).",
      });
      return true;
    }

    const payload = await parseJsonBodyOrRespond(req, res);
    if (payload === null) return true;
    const validation = validateUserLoginPayload(payload);
    if (!validation.ok) {
      sendJson(res, validation.status, { error: validation.error });
      return true;
    }

    const user = await getUserByEmail(validation.value.email);
    if (!user || !verifyUserPassword(validation.value.password, user.password_hash)) {
      sendJson(res, 401, { error: "Niepoprawny e-mail lub hasło." });
      return true;
    }
    if (normalizeUserStatus(user.status) !== "aktywny") {
      sendJson(res, 403, { error: "Twoje konto jest zawieszone." });
      return true;
    }

    await markUserLogin(user.id);
    const token = createUserToken(user.id, validation.value.rememberMe);
    sendJson(
      res,
      200,
      {
        ok: true,
        user: toUserSessionProfile(user),
      },
      {
        "Set-Cookie": userCookieHeader(token.token, token.maxAgeSeconds),
      },
    );
    return true;
  }

  if (method === "POST" && pathname === "/backend/user/logout") {
    if (!ensureSameOrigin(req, res)) return true;
    sendJson(res, 200, { ok: true }, { "Set-Cookie": clearUserCookieHeader() });
    return true;
  }

  if (method === "GET" && pathname === "/backend/user/me") {
    if (!USER_SECURITY_READY) {
      sendJson(res, 200, { loggedIn: false, authEnabled: false });
      return true;
    }
    const user = await resolveUserFromRequest(req);
    if (!user) {
      sendJson(res, 200, { loggedIn: false, authEnabled: true });
      return true;
    }
    sendJson(res, 200, {
      loggedIn: true,
      authEnabled: true,
      user: toUserSessionProfile(user),
    });
    return true;
  }

  if (method === "POST" && pathname === "/backend/user/password-reset-request") {
    if (!ensureSameOrigin(req, res)) return true;
    const payload = await parseJsonBodyOrRespond(req, res);
    if (payload === null) return true;

    const email = normalizeEmail(payload?.email);
    if (email && isValidEmail(email)) {
      const user = await getUserByEmail(email);
      if (user) {
        logger.info("auth/user", "Password reset requested", {
          requestId: req?.context?.requestId,
          userId: user.id,
        });
      }
    }
    sendJson(res, 200, {
      ok: true,
      message:
        "Jeśli konto istnieje, wysłaliśmy instrukcję resetowania hasła na podany adres e-mail.",
    });
    return true;
  }

  if (method === "GET" && pathname === "/backend/user/favorites") {
    const user = await requireUser(req, res);
    if (!user) return true;
    const favorites = await listUserFavorites(user.id);
    sendJson(res, 200, { favorites });
    return true;
  }

  if (method === "POST" && pathname === "/backend/user/favorites") {
    if (!ensureSameOrigin(req, res)) return true;
    const user = await requireUser(req, res);
    if (!user) return true;
    const payload = await parseJsonBodyOrRespond(req, res);
    if (payload === null) return true;
    const favorites = await addFavoriteForUser(user.id, payload);
    sendJson(res, 200, { favorites });
    return true;
  }

  if (method === "DELETE" && pathname === "/backend/user/favorites") {
    if (!ensureSameOrigin(req, res)) return true;
    const user = await requireUser(req, res);
    if (!user) return true;
    const payload = await parseJsonBodyOrRespond(req, res);
    if (payload === null) return true;
    const favorites = await removeFavoriteForUser(user.id, payload);
    sendJson(res, 200, { favorites });
    return true;
  }

  if (method === "GET" && pathname === "/backend/user/shopping-list") {
    const user = await requireUser(req, res);
    if (!user) return true;
    const shoppingList = await getShoppingListForUser(user.id);
    sendJson(res, 200, { shoppingList });
    return true;
  }

  if (method === "POST" && pathname === "/backend/user/shopping-list") {
    if (!ensureSameOrigin(req, res)) return true;
    const user = await requireUser(req, res);
    if (!user) return true;
    const payload = await parseJsonBodyOrRespond(req, res);
    if (payload === null) return true;
    const shoppingList = await saveShoppingListForUser(user.id, payload);
    sendJson(res, 200, { shoppingList });
    return true;
  }

  if (method === "POST" && pathname === "/backend/user/recipes") {
    if (!ensureSameOrigin(req, res)) return true;
    const user = await requireUser(req, res);
    if (!user) return true;
    const payload = await parseJsonBodyOrRespond(req, res);
    if (payload === null) return true;

    const enrichedPayload = {
      ...payload,
      source: "uzytkownik",
      status: "weryfikacja",
      author_user_id: user.id,
    };
    const validationErrors = validateRecipePayload(enrichedPayload);
    if (validationErrors) {
      sendJson(res, 400, { error: "Błędy walidacji.", fields: validationErrors });
      return true;
    }

    const recipe = await addRecipe(enrichedPayload);
    sendJson(res, 201, { recipe });
    return true;
  }

  if (method === "GET" && pathname === "/backend/admin/users") {
    if (!requireAdmin(req, res)) return true;
    const users = await listUsersForAdmin();
    sendJson(res, 200, { users });
    return true;
  }

  const adminUserSuspendMatch = pathname.match(/^\/backend\/admin\/users\/(\d+)\/suspend\/?$/);
  if (method === "PUT" && adminUserSuspendMatch) {
    if (!ensureSameOrigin(req, res)) return true;
    if (!requireAdmin(req, res)) return true;
    const payload = await parseJsonBodyOrRespond(req, res);
    if (payload === null) return true;
    const userId = safeInt(adminUserSuspendMatch[1]);
    if (userId === null) {
      sendJson(res, 400, { error: "Niepoprawne ID użytkownika." });
      return true;
    }

    let suspended = safeBool(payload?.suspended, false);
    if (safeString(payload?.status)) {
      suspended = normalizeUserStatus(payload.status) === "zawieszony";
    }
    const user = await updateUserSuspendedState(userId, suspended);
    if (!user) {
      sendJson(res, 404, { error: "Nie znaleziono użytkownika." });
      return true;
    }
    sendJson(res, 200, { user });
    return true;
  }

  const adminUserDeleteMatch = pathname.match(/^\/backend\/admin\/users\/(\d+)\/?$/);
  if (method === "DELETE" && adminUserDeleteMatch) {
    if (!ensureSameOrigin(req, res)) return true;
    if (!requireAdmin(req, res)) return true;
    const userId = safeInt(adminUserDeleteMatch[1]);
    if (userId === null) {
      sendJson(res, 400, { error: "Niepoprawne ID użytkownika." });
      return true;
    }
    const deleted = await deleteUserByAdmin(userId);
    if (!deleted) {
      sendJson(res, 404, { error: "Nie znaleziono użytkownika." });
      return true;
    }
    sendJson(res, 200, { ok: true });
    return true;
  }

  const adminUserResetMatch = pathname.match(/^\/backend\/admin\/users\/(\d+)\/reset-password\/?$/);
  if (method === "POST" && adminUserResetMatch) {
    if (!ensureSameOrigin(req, res)) return true;
    if (!requireAdmin(req, res)) return true;
    const userId = safeInt(adminUserResetMatch[1]);
    if (userId === null) {
      sendJson(res, 400, { error: "Niepoprawne ID użytkownika." });
      return true;
    }
    const generatedPassword = randomPassword(16);
    const updated = await resetUserPasswordByAdmin(userId, generatedPassword);
    if (!updated) {
      sendJson(res, 404, { error: "Nie znaleziono użytkownika." });
      return true;
    }
    sendJson(res, 200, { ok: true, generatedPassword });
    return true;
  }

  if (method === "POST" && pathname === "/backend/chat/options") {
    if (!ensureSameOrigin(req, res)) return true;
    if (
      !enforceRateLimit(
        req,
        res,
        "chat-options",
        CHAT_OPTIONS_RATE_LIMIT_MAX,
        "Zbyt wiele zapytan czatu. Poczekaj chwile i sprobuj ponownie.",
      )
    ) {
      return true;
    }

    const payload = await parseJsonBodyOrRespond(req, res);
    if (payload === null) {
      return true;
    }

    const payloadValidation = validateChatPayload(
      payload,
      CHAT_PROMPT_MAX_CHARS,
      MAX_HISTORY_ITEMS,
      64,
    );
    if (!payloadValidation.ok) {
      sendJson(res, payloadValidation.status, { error: payloadValidation.error });
      return true;
    }

    const session = await resolveAnonymousSessionOrRespond(req, res);
    if (!session) {
      return true;
    }

    const activeSession = await enforceSessionQuotaOrRespond(req, res, session, "chat");
    if (!activeSession) {
      return true;
    }

    const prompt = safeLimitedString(payload?.prompt, CHAT_PROMPT_MAX_CHARS + 1);
    if (isPromptTooLong(prompt)) {
      sendJson(res, 400, {
        error: `Prompt jest zbyt dlugi. Maksymalna dlugosc: ${CHAT_PROMPT_MAX_CHARS} znakow.`,
      });
      return true;
    }
    const category = normalizeRecipeCategory(payload?.category);
    const policy = classifyPrompt(prompt);
    const sanitizedHistory = sanitizePolicyHistory(
      payload?.history,
      MAX_HISTORY_ITEMS,
      MAX_HISTORY_ITEM_CHARS,
    );
    const excludedRecipeIds = Array.isArray(payload?.excludedRecipeIds)
      ? payload.excludedRecipeIds
      : [];

    if (policy.action === "block") {
      await sessionManager.flagSuspiciousSessionActivity(req, activeSession, "chat-policy-block");
      logger.warn("security", "Blocked prompt injection attempt", {
        requestId: req?.context?.requestId,
        sessionIdHash: sessionIdHash(activeSession.sessionId),
        reasons: policy.reasons,
      });
      recordOpsEvent("blocked_prompt", {
        requestId: req?.context?.requestId,
      });

      const blockedPayload = sanitizeChatResponsePayload(
        {
          ...safeBlockedChatResponse(),
          category,
        },
        prompt,
        category,
      );
      sendJson(res, 200, blockedPayload);
      return true;
    }

    const forceLocalOnly = policy.action === "suspicious";
    if (forceLocalOnly) {
      await sessionManager.flagSuspiciousSessionActivity(
        req,
        activeSession,
        "chat-policy-suspicious",
      );
      logger.warn("security", "Suspicious prompt degraded to local-only", {
        requestId: req?.context?.requestId,
        sessionIdHash: sessionIdHash(activeSession.sessionId),
        reasons: policy.reasons,
      });
      recordOpsEvent("blocked_prompt", {
        requestId: req?.context?.requestId,
        degraded: true,
      });
    }

    try {
      const generated = await generateOptions(
        policy.redactedPrompt || prompt,
        sanitizedHistory,
        excludedRecipeIds,
        category,
        {
          forceLocalOnly,
          filters: payload?.filters,
        },
      );
      const result = sanitizeChatResponsePayload(generated, prompt, category);
      logger.info("ai", "chat/options handled", {
        requestId: req?.context?.requestId,
        sessionIdHash: sessionIdHash(activeSession.sessionId),
        policyAction: policy.action,
        localOnly: forceLocalOnly,
      });
      sendJson(res, 200, result);
    } catch (error) {
      logger.error("ai", "chat/options failed", {
        requestId: req?.context?.requestId,
        error: error instanceof Error ? error.message : String(error),
      });
      recordOpsEvent("ai_upstream_failure", {
        requestId: req?.context?.requestId,
        route: "chat-options",
      });
      sendJson(res, 502, {
        error: "Nie udalo sie przygotowac propozycji. Sprobuj ponownie za chwile.",
      });
    }
    return true;
  }

  if (method === "POST" && pathname === "/backend/chat/photo") {
    if (!ensureSameOrigin(req, res)) return true;
    if (
      !enforceRateLimit(
        req,
        res,
        "chat-photo",
        CHAT_PHOTO_RATE_LIMIT_MAX,
        "Zbyt wiele analiz zdjec. Poczekaj chwile i sprobuj ponownie.",
      )
    ) {
      return true;
    }

    const payload = await parseJsonBodyOrRespond(req, res);
    if (payload === null) {
      return true;
    }

    const payloadValidation = validatePhotoPayload(payload);
    if (!payloadValidation.ok) {
      sendJson(res, payloadValidation.status, { error: payloadValidation.error });
      return true;
    }

    const session = await resolveAnonymousSessionOrRespond(req, res);
    if (!session) {
      return true;
    }

    const activeSession = await enforceSessionQuotaOrRespond(req, res, session, "photo");
    if (!activeSession) {
      return true;
    }

    const category = normalizeRecipeCategory(payload?.category);
    const imageDataUrl = safeLimitedString(payload?.imageDataUrl, MAX_CHAT_IMAGE_BYTES * 2);
    const imageName = safeLimitedString(payload?.imageName || payload?.fileName, 120);
    const uploadValidation = validateInlineImageDataUrlGuard(imageDataUrl, {
      maxBytes: MAX_CHAT_IMAGE_BYTES,
      allowedMimeTypes: ALLOWED_CHAT_IMAGE_MIME_TYPES,
      allowedExtensions: ALLOWED_CHAT_IMAGE_EXTENSIONS,
      imageName,
    });
    if (!uploadValidation.ok) {
      await sessionManager.flagSuspiciousSessionActivity(req, activeSession, "invalid-photo-upload");
      logger.warn("security", "Rejected photo upload payload", {
        requestId: req?.context?.requestId,
        sessionIdHash: sessionIdHash(activeSession.sessionId),
        error: uploadValidation.error,
      });
      recordOpsEvent("suspicious_upload", {
        requestId: req?.context?.requestId,
      });
      sendJson(res, uploadValidation.status || 400, { error: uploadValidation.error });
      return true;
    }

    try {
      const photoAnalysis = await analyzePhotoIngredients(imageDataUrl, category, imageName);
      const photoPolicy = classifyPrompt(photoAnalysis.prompt);
      const forceLocalOnly = photoPolicy.action !== "allow";
      if (photoPolicy.action !== "allow") {
        await sessionManager.flagSuspiciousSessionActivity(
          req,
          activeSession,
          `photo-policy-${photoPolicy.action}`,
        );
        logger.warn("security", "Photo prompt policy escalation", {
          requestId: req?.context?.requestId,
          sessionIdHash: sessionIdHash(activeSession.sessionId),
          policyAction: photoPolicy.action,
          reasons: photoPolicy.reasons,
        });
      }

      const photoHistory = [
        ...sanitizePolicyHistory(payload?.history, MAX_HISTORY_ITEMS, MAX_HISTORY_ITEM_CHARS),
        { role: "user", content: photoPolicy.redactedPrompt || photoAnalysis.prompt },
      ].slice(-MAX_HISTORY_ITEMS);
      const generated = await generateOptions(
        photoPolicy.redactedPrompt || photoAnalysis.prompt,
        photoHistory,
        payload?.excludedRecipeIds || [],
        category,
        {
          forceLocalOnly,
          filters: payload?.filters,
        },
      );
      const responseCategory = normalizeRecipeCategory(generated?.category || category);
      const assistantText = combineAssistantTexts(
        photoAnalysis.assistantText,
        generated?.assistantText,
        responseCategory,
      );
      const result = sanitizeChatResponsePayload(
        {
          ...generated,
          assistantText,
          category: responseCategory,
        },
        photoAnalysis.prompt,
        responseCategory,
      );

      sendJson(res, 200, {
        ...result,
        detectedProducts: photoAnalysis.detectedProducts,
        analysisPrompt: sanitizeModelOutputText(photoAnalysis.prompt, 400),
      });
    } catch (error) {
      logger.error("ai", "chat/photo failed", {
        requestId: req?.context?.requestId,
        error: error instanceof Error ? error.message : String(error),
      });
      recordOpsEvent("ai_upstream_failure", {
        requestId: req?.context?.requestId,
        route: "chat-photo",
      });
      const mapped = mapModelError(
        error,
        "Nie udalo sie przetworzyc zdjecia. Sprobuj ponownie za chwile.",
      );
      sendJson(res, mapped.status, { error: mapped.message });
    }
    return true;
  }

  if (method === "POST" && pathname === "/backend/chat/feedback") {
    if (!ensureSameOrigin(req, res)) return true;
    if (
      !enforceRateLimit(
        req,
        res,
        "chat-feedback",
        CHAT_FEEDBACK_RATE_LIMIT_MAX,
        "Zbyt wiele zapytan feedback. Sprobuj ponownie za chwile.",
      )
    ) {
      return true;
    }

    const payload = await parseJsonBodyOrRespond(req, res);
    if (payload === null) {
      return true;
    }

    const payloadValidation = validateFeedbackPayload(payload);
    if (!payloadValidation.ok) {
      sendJson(res, payloadValidation.status, { error: payloadValidation.error });
      return true;
    }

    const session = await resolveAnonymousSessionOrRespond(req, res);
    if (!session) {
      return true;
    }

    const activeSession = await enforceSessionQuotaOrRespond(req, res, session, "feedback");
    if (!activeSession) {
      return true;
    }

    logFeedback(payload);
    logger.info("app", "Feedback accepted", {
      requestId: req?.context?.requestId,
      sessionIdHash: sessionIdHash(activeSession.sessionId),
      action: safeLimitedString(payload?.action, 40),
    });
    sendJson(res, 200, { ok: true });
    return true;
  }

  if (method === "POST" && pathname === "/backend/generuj") {
    if (!ensureSameOrigin(req, res)) return true;
    if (
      !enforceRateLimit(
        req,
        res,
        "chat-generuj",
        CHAT_OPTIONS_RATE_LIMIT_MAX,
        "Zbyt wiele zapytan. Sprobuj ponownie za chwile.",
      )
    ) {
      return true;
    }

    const payload = await parseJsonBodyOrRespond(req, res);
    if (payload === null) {
      return true;
    }

    const session = await resolveAnonymousSessionOrRespond(req, res);
    if (!session) {
      return true;
    }

    const activeSession = await enforceSessionQuotaOrRespond(req, res, session, "chat");
    if (!activeSession) {
      return true;
    }

    const skladniki = safeLimitedString(payload?.skladniki, CHAT_PROMPT_MAX_CHARS + 1);
    if (!skladniki) {
      sendJson(res, 400, { error: "Wpisz najpierw jakies skladniki." });
      return true;
    }
    if (isPromptTooLong(skladniki)) {
      sendJson(res, 400, {
        error: `Opis skladnikow jest zbyt dlugi. Maksymalna dlugosc: ${CHAT_PROMPT_MAX_CHARS} znakow.`,
      });
      return true;
    }

    const policy = classifyPrompt(skladniki);
    if (policy.action === "block") {
      await sessionManager.flagSuspiciousSessionActivity(req, activeSession, "generuj-policy-block");
      logger.warn("security", "Blocked /backend/generuj prompt", {
        requestId: req?.context?.requestId,
        sessionIdHash: sessionIdHash(activeSession.sessionId),
      });
      recordOpsEvent("blocked_prompt", {
        requestId: req?.context?.requestId,
        route: "chat-generuj",
      });
      sendJson(res, 200, { przepis: safeBlockedChatResponse().assistantText, blocked: true });
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
          content: `Mam te skladniki: ${redactSensitiveText(
            policy.redactedPrompt || skladniki,
          )}. Co moge z nich zrobic? Podaj tytul i opis wykonania.`,
        },
      ]);

      const recipe = await createGeneratedRecipe(skladniki, content);
      sendJson(res, 200, { przepis: content, recipe });
    } catch (error) {
      logger.error("ai", "chat/generuj failed", {
        requestId: req?.context?.requestId,
        error: error instanceof Error ? error.message : String(error),
      });
      recordOpsEvent("ai_upstream_failure", {
        requestId: req?.context?.requestId,
        route: "chat-generuj",
      });
      sendJson(res, 502, { error: "Serwis jest chwilowo niedostepny. Sprobuj ponownie za chwile." });
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
    if (!ensureSameOrigin(req, res)) return true;
    if (!requireAdmin(req, res)) return true;

    const payload = await parseJsonBodyOrRespond(req, res);
    if (payload === null) {
      return true;
    }

    const validationErrors = validateRecipePayload(payload);
    if (validationErrors) {
      sendJson(res, 400, { error: "Błędy walidacji.", fields: validationErrors });
      return true;
    }

    const recipe = await addRecipe(payload);
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
      if (!ensureSameOrigin(req, res)) return true;
      const payload = await parseJsonBodyOrRespond(req, res);
      if (payload === null) {
        return true;
      }

      const validationErrors = validateRecipePayload(payload);
      if (validationErrors) {
        sendJson(res, 400, { error: "Błędy walidacji.", fields: validationErrors });
        return true;
      }

      const recipe = await updateRecipe(recipeId, payload);
      if (!recipe) {
        sendJson(res, 404, { error: "Nie znaleziono przepisu." });
        return true;
      }

      sendJson(res, 200, { recipe });
      return true;
    }

    if (method === "DELETE") {
      if (!ensureSameOrigin(req, res)) return true;
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
  const context = createRequestContext(req, { trustProxy: TRUST_PROXY });
  attachRequestContext(req, res, context);

  const method = req.method || "GET";
  const urlObj = new URL(req.url || "/", "http://localhost");
  let pathname = "/";
  const ipHash = hashValue(context.ip, ANON_SESSION_SECRET || SESSION_SECRET || "request-ip");

  res.on("finish", () => {
    const durationMs = requestDurationMs(context);
    if (res.statusCode >= 500) {
      recordOpsEvent("http_5xx", {
        requestId: context.requestId,
        pathname,
        method,
        statusCode: res.statusCode,
      });
    } else if (res.statusCode === 429) {
      recordOpsEvent("http_429", {
        requestId: context.requestId,
        pathname,
        method,
      });
    }

    logger.info("app", "HTTP request completed", {
      requestId: context.requestId,
      method,
      pathname,
      statusCode: res.statusCode,
      durationMs,
      ipHash,
    });
  });

  try {
    pathname = decodeURIComponent(urlObj.pathname || "/");
  } catch {
    logger.warn("security", "Invalid URL encoding", {
      requestId: context.requestId,
      path: safeLimitedString(req.url || "", 240),
      ipHash,
    });
    sendJson(res, 400, { error: "Niepoprawny URL." });
    return;
  }

  if (isMaintenanceModeActive() && !isMaintenanceBypassPath(pathname)) {
    const retryAfter = Math.max(30, MAINTENANCE_RETRY_AFTER_SECONDS);
    res.setHeader("Retry-After", String(retryAfter));
    if (pathname.startsWith("/backend/")) {
      sendJson(res, 503, {
        error: "Aplikacja jest chwilowo w trybie serwisowym. Sprobuj ponownie za chwile.",
      });
    } else {
      sendText(res, 503, "Service temporarily unavailable (maintenance mode).");
    }
    return;
  }

  try {
    const handledApi = await handleApi(req, res, pathname);
    if (handledApi) return;
  } catch (error) {
    logger.error("app", "API unexpected error", {
      requestId: context.requestId,
      pathname,
      method,
      error: error instanceof Error ? error.message : String(error),
    });
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
  await initAnonymousSessionLayer();

  if (!ADMIN_SECURITY_READY) {
    logger.warn("security", "Admin auth disabled", {
      reason: "Missing ADMIN_PASSWORD or ADMIN_SESSION_SECRET (>=32 chars).",
    });
  }
  if (!USER_SECURITY_READY) {
    logger.warn("security", "User auth degraded", {
      reason: "Missing USER_SESSION_SECRET (>=32 chars). User login endpoints are disabled.",
    });
  }

  if (!sessionManager) {
    logger.error("auth/session", "Anonymous session layer failed to initialize");
  }

  if (server.listening) {
    return;
  }

  await new Promise((resolve) => {
    server.listen(port, () => {
      const storage = dbEnabled ? `mysql:${DB_NAME}.${DB_TABLE}` : "file";
      logger.info("app", "Server started", {
        port,
        storage,
        sessionStore: sessionStore?.adapterType || "unknown",
        adminAuthConfigured: ADMIN_SECURITY_READY,
      });
      resolve();
    });
  });
}

async function closeResources() {
  if (sessionCleanupInterval) {
    clearInterval(sessionCleanupInterval);
    sessionCleanupInterval = null;
  }
  if (dbPool) {
    try {
      await dbPool.end();
    } catch (error) {
      logger.warn("app", "DB pool close failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    dbPool = null;
  }
}

async function stopServer() {
  if (server.listening) {
    await new Promise((resolve) => {
      server.close(() => resolve());
    });
  }
  await closeResources();
}

async function startServerWithFallback() {
  try {
    await startServer();
  } catch (error) {
    logger.error("app", "Startup error", {
      error: error instanceof Error ? error.message : String(error),
    });
    if (!server.listening) {
      await new Promise((resolve) => {
        server.listen(port, () => {
          logger.warn("app", "Server started in degraded mode", {
            port,
            storage: "file",
          });
          resolve();
        });
      });
    }
  }
}

if (require.main === module) {
  startServerWithFallback();

  ["SIGINT", "SIGTERM"].forEach((signal) => {
    process.on(signal, () => {
      logger.info("app", "Shutdown signal received", { signal });
      stopServer()
        .catch((error) => {
          logger.error("app", "Resource cleanup failed", {
            error: error instanceof Error ? error.message : String(error),
          });
        })
        .finally(() => {
          process.exit(0);
        });
    });
  });
}

module.exports = {
  server,
  startServer,
  startServerWithFallback,
  stopServer,
};

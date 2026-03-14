const crypto = require("crypto");

const REDACTED = "[REDACTED]";
const MAX_STRING_LEN = 400;
const SENSITIVE_KEY_PATTERN =
  /(password|token|secret|authorization|cookie|set-cookie|api[_-]?key|session)/i;

function safeString(value) {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return "";
}

function truncate(value, maxLen = MAX_STRING_LEN) {
  const text = safeString(value);
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen)}...`;
}

function hashValue(value, secret = "") {
  const data = safeString(value);
  if (!data) return "";
  const key = safeString(secret) || "default-log-hash-key";
  return crypto.createHmac("sha256", key).update(data).digest("hex").slice(0, 16);
}

function sanitizeLogMeta(value, depth = 0) {
  if (depth > 4) return "[max-depth]";
  if (value === null || value === undefined) return value;

  if (typeof value === "string") return truncate(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return Number(value);
  if (value instanceof Error) {
    return {
      name: value.name,
      message: truncate(value.message),
    };
  }
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeLogMeta(item, depth + 1));
  }
  if (typeof value === "object") {
    const result = {};
    for (const [key, raw] of Object.entries(value)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        result[key] = REDACTED;
      } else {
        result[key] = sanitizeLogMeta(raw, depth + 1);
      }
    }
    return result;
  }

  return truncate(String(value));
}

function createRequestId() {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return crypto.randomBytes(16).toString("hex");
}

function createLogger(options = {}) {
  const service = safeString(options.service) || "co-moge-zjesc";
  const baseMeta = options.baseMeta && typeof options.baseMeta === "object" ? options.baseMeta : {};

  function emit(level, category, message, meta = {}) {
    const record = {
      ts: new Date().toISOString(),
      level,
      service,
      category: safeString(category) || "app",
      message: truncate(message),
      ...sanitizeLogMeta(baseMeta),
      ...sanitizeLogMeta(meta),
    };
    const line = JSON.stringify(record);
    if (level === "error" || level === "warn") {
      console.error(line);
      return;
    }
    console.log(line);
  }

  return {
    debug: (category, message, meta) => emit("debug", category, message, meta),
    info: (category, message, meta) => emit("info", category, message, meta),
    warn: (category, message, meta) => emit("warn", category, message, meta),
    error: (category, message, meta) => emit("error", category, message, meta),
    child(extraMeta = {}) {
      return createLogger({
        service,
        baseMeta: {
          ...baseMeta,
          ...(extraMeta && typeof extraMeta === "object" ? extraMeta : {}),
        },
      });
    },
  };
}

module.exports = {
  REDACTED,
  createLogger,
  createRequestId,
  hashValue,
  sanitizeLogMeta,
};

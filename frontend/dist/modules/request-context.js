const { createRequestId } = require("./logger");

function safeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeRequestId(value) {
  const candidate = safeString(value);
  if (!candidate) return "";
  if (candidate.length > 120) return "";
  if (!/^[A-Za-z0-9\-_.:]+$/.test(candidate)) return "";
  return candidate;
}

function resolveClientIp(req, trustProxy = false) {
  if (trustProxy) {
    const forwarded = safeString(req?.headers?.["x-forwarded-for"]);
    if (forwarded) {
      const ip = forwarded.split(",")[0]?.trim();
      if (ip) return ip;
    }
  }
  return safeString(req?.socket?.remoteAddress) || "unknown";
}

function createRequestContext(req, options = {}) {
  const trustProxy = Boolean(options.trustProxy);
  const requestId =
    normalizeRequestId(req?.headers?.["x-request-id"]) ||
    normalizeRequestId(req?.headers?.["x-correlation-id"]) ||
    createRequestId();

  return {
    requestId,
    method: safeString(req?.method) || "GET",
    ip: resolveClientIp(req, trustProxy),
    userAgent: safeString(req?.headers?.["user-agent"]),
    startedAt: Date.now(),
  };
}

function attachRequestContext(req, res, context) {
  req.context = context;
  res.setHeader("X-Request-Id", context.requestId);
}

function requestDurationMs(context) {
  return Math.max(0, Date.now() - Number(context?.startedAt || Date.now()));
}

module.exports = {
  attachRequestContext,
  createRequestContext,
  requestDurationMs,
  resolveClientIp,
};

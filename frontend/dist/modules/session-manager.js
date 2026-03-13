const crypto = require("crypto");
const { hashValue } = require("./logger");

function safeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function parseCookies(rawHeader) {
  const raw = safeString(rawHeader);
  if (!raw) return {};
  return raw.split(";").reduce((acc, item) => {
    const [name, ...rest] = item.trim().split("=");
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

function toBool(value) {
  return /^(1|true|yes|on)$/i.test(safeString(value));
}

function normalizeSameSite(value, secureCookie) {
  const candidate = safeString(value).toLowerCase();
  if (candidate === "strict") return "Strict";
  if (candidate === "none") return secureCookie ? "None" : "Lax";
  return "Lax";
}

function nowMs() {
  return Date.now();
}

function createSessionManager(options) {
  const store = options.store;
  const logger = options.logger;
  const cookieName = safeString(options.cookieName) || "anon_session";
  const cookieSecret = safeString(options.cookieSecret);
  const secureCookie = Boolean(options.secureCookie);
  const sameSite = normalizeSameSite(options.sameSite, secureCookie);
  const idleTtlMs = Number(options.idleTtlMs || 30 * 60 * 1000);
  const absoluteTtlMs = Number(options.absoluteTtlMs || 24 * 60 * 60 * 1000);
  const chatQuota = Number(options.chatQuota || 20);
  const photoQuota = Number(options.photoQuota || 6);
  const feedbackQuota = Number(options.feedbackQuota || 24);
  const cooldownMs = Number(options.cooldownMs || 5 * 60 * 1000);
  const maxSecurityFlags = Number(options.maxSecurityFlags || 40);
  const ipHashSecret = safeString(options.ipHashSecret || cookieSecret || "session-ip-secret");
  const enforceSignature = cookieSecret.length >= 32;
  const redisReady = toBool(options.redisReady);

  const ephemeralSecret = crypto.randomBytes(32).toString("hex");
  const signingKey = enforceSignature ? cookieSecret : ephemeralSecret;

  if (!enforceSignature) {
    logger?.warn("auth/session", "Anonymous session cookie uses ephemeral fallback secret", {
      reason: "ANON_SESSION_SECRET too short",
    });
  }

  function signSessionId(sessionId) {
    return crypto.createHmac("sha256", signingKey).update(sessionId).digest("base64url");
  }

  function encodeToken(sessionId) {
    const signature = signSessionId(sessionId);
    return `v1.${sessionId}.${signature}`;
  }

  function decodeToken(token) {
    const raw = safeString(token);
    const parts = raw.split(".");
    if (parts.length !== 3) return null;
    if (parts[0] !== "v1") return null;
    const sessionId = parts[1];
    const signature = parts[2];
    if (!sessionId || !signature) return null;

    const expected = signSessionId(sessionId);
    const left = Buffer.from(signature);
    const right = Buffer.from(expected);
    if (left.length !== right.length) return null;
    if (!crypto.timingSafeEqual(left, right)) return null;
    return sessionId;
  }

  function buildSetCookie(token, maxAgeMs) {
    const maxAgeSeconds = Math.max(0, Math.floor(Number(maxAgeMs || 0) / 1000));
    const parts = [
      `${cookieName}=${encodeURIComponent(token)}`,
      "Path=/",
      "HttpOnly",
      `SameSite=${sameSite}`,
      `Max-Age=${maxAgeSeconds}`,
    ];
    if (secureCookie) parts.push("Secure");
    return parts.join("; ");
  }

  function clearSetCookie() {
    return buildSetCookie("", 0);
  }

  function createSession(ipHash, now = nowMs()) {
    const sessionId = crypto.randomBytes(24).toString("base64url");
    return {
      sessionId,
      createdAt: now,
      lastActivityAt: now,
      idleExpiresAt: now + idleTtlMs,
      absoluteExpiresAt: now + absoluteTtlMs,
      requestCount: 0,
      photoRequestCount: 0,
      blockedUntil: 0,
      securityFlags: [],
      linkedUserId: null,
      metadata: {
        ipHash,
        redisReady,
      },
    };
  }

  function computeRetrySeconds(targetTs) {
    return Math.max(1, Math.ceil((Number(targetTs || 0) - nowMs()) / 1000));
  }

  function recordSecurityFlag(session, flag) {
    const next = Array.isArray(session.securityFlags) ? session.securityFlags.slice(0) : [];
    next.push({
      type: safeString(flag?.type) || "security-event",
      ts: nowMs(),
      reason: safeString(flag?.reason).slice(0, 180),
    });
    while (next.length > maxSecurityFlags) {
      next.shift();
    }
    session.securityFlags = next;
  }

  function metadataCounter(session, key) {
    if (!session.metadata || typeof session.metadata !== "object") {
      session.metadata = {};
    }
    const current = Number(session.metadata[key] || 0);
    return Number.isFinite(current) && current > 0 ? Math.floor(current) : 0;
  }

  function incrementMetadataCounter(session, key) {
    const next = metadataCounter(session, key) + 1;
    session.metadata[key] = next;
    return next;
  }

  function sessionExpired(session, now = nowMs()) {
    if (!session) return true;
    if (session.idleExpiresAt <= now) return true;
    if (session.absoluteExpiresAt <= now) return true;
    return false;
  }

  function getIpHash(req) {
    const ip = safeString(req?.context?.ip) || "unknown";
    return hashValue(ip, ipHashSecret);
  }

  async function resolveSession(req, res) {
    const now = nowMs();
    const cookies = parseCookies(req?.headers?.cookie || "");
    const token = cookies[cookieName];
    const decodedSessionId = decodeToken(token);
    const ipHash = getIpHash(req);

    let session = null;
    let isNew = false;
    let rotationReason = "";

    if (decodedSessionId) {
      session = await store.getSession(decodedSessionId);
      if (!session) {
        rotationReason = "missing-session";
      } else if (sessionExpired(session, now)) {
        rotationReason = "expired";
        await store.deleteSession(session.sessionId);
        session = null;
      }
    } else if (token) {
      rotationReason = "invalid-signature";
    }

    const ipCooldown = await store.getIpCooldown(ipHash);
    if (!session && ipCooldown > now) {
      res.setHeader("Retry-After", String(computeRetrySeconds(ipCooldown)));
      return {
        ok: false,
        status: 429,
        code: "SESSION_COOLDOWN",
        message: "Limit sesji zostal osiagniety. Sprobuj ponownie za chwile.",
      };
    }

    if (!session) {
      session = createSession(ipHash, now);
      await store.putSession(session);
      isNew = true;
      logger?.info("auth/session", "Anonymous session created", {
        requestId: req?.context?.requestId,
        sessionIdHash: hashValue(session.sessionId, signingKey),
        ipHash,
      });
      if (rotationReason) {
        logger?.warn("auth/session", "Anonymous session rotated", {
          requestId: req?.context?.requestId,
          reason: rotationReason,
          ipHash,
        });
      }
    } else {
      session.lastActivityAt = now;
      session.idleExpiresAt = Math.min(now + idleTtlMs, session.absoluteExpiresAt);
      await store.putSession(session);
    }

    res.setHeader("Set-Cookie", buildSetCookie(encodeToken(session.sessionId), absoluteTtlMs));

    return {
      ok: true,
      isNew,
      session,
    };
  }

  async function enforceQuota(req, session, quotaType) {
    const now = nowMs();
    if (!session) {
      return {
        ok: false,
        status: 401,
        code: "NO_SESSION",
        message: "Brak aktywnej sesji.",
      };
    }

    if (sessionExpired(session, now)) {
      await store.deleteSession(session.sessionId);
      return {
        ok: false,
        status: 401,
        code: "SESSION_EXPIRED",
        message: "Sesja wygasla. Odswiez strone i sprobuj ponownie.",
      };
    }

    if (session.blockedUntil > now) {
      return {
        ok: false,
        status: 429,
        code: "SESSION_BLOCKED",
        message: "Limit zapytan w tej sesji zostal osiagniety. Poczekaj chwile.",
        retryAfterSeconds: computeRetrySeconds(session.blockedUntil),
      };
    }

    if (quotaType === "chat") {
      if (session.requestCount >= chatQuota) {
        session.blockedUntil = now + cooldownMs;
        recordSecurityFlag(session, {
          type: "quota",
          reason: "chat-limit-exceeded",
        });
        await store.putSession(session);
        await store.setIpCooldown(getIpHash(req), session.blockedUntil);
        return {
          ok: false,
          status: 429,
          code: "CHAT_QUOTA_EXCEEDED",
          message: `Osiagnieto limit ${chatQuota} zapytan czatu w tej sesji. Sprobuj ponownie pozniej.`,
          retryAfterSeconds: computeRetrySeconds(session.blockedUntil),
        };
      }
      session.requestCount += 1;
    }

    if (quotaType === "photo") {
      if (session.photoRequestCount >= photoQuota) {
        session.blockedUntil = now + cooldownMs;
        recordSecurityFlag(session, {
          type: "quota",
          reason: "photo-limit-exceeded",
        });
        await store.putSession(session);
        await store.setIpCooldown(getIpHash(req), session.blockedUntil);
        return {
          ok: false,
          status: 429,
          code: "PHOTO_QUOTA_EXCEEDED",
          message: "Osiagnieto limit analiz zdjec w tej sesji. Sprobuj ponownie pozniej.",
          retryAfterSeconds: computeRetrySeconds(session.blockedUntil),
        };
      }
      session.photoRequestCount += 1;
    }

    if (quotaType === "feedback") {
      const feedbackCount = metadataCounter(session, "feedbackCount");
      if (feedbackCount >= feedbackQuota) {
        session.blockedUntil = now + cooldownMs;
        recordSecurityFlag(session, {
          type: "quota",
          reason: "feedback-limit-exceeded",
        });
        await store.putSession(session);
        await store.setIpCooldown(getIpHash(req), session.blockedUntil);
        return {
          ok: false,
          status: 429,
          code: "FEEDBACK_QUOTA_EXCEEDED",
          message: "Osiagnieto limit feedbacku w tej sesji. Sprobuj ponownie pozniej.",
          retryAfterSeconds: computeRetrySeconds(session.blockedUntil),
        };
      }
      incrementMetadataCounter(session, "feedbackCount");
    }

    session.lastActivityAt = now;
    session.idleExpiresAt = Math.min(now + idleTtlMs, session.absoluteExpiresAt);
    await store.putSession(session);

    return {
      ok: true,
      session,
    };
  }

  async function flagSuspiciousSessionActivity(req, session, reason) {
    if (!session) return;
    recordSecurityFlag(session, {
      type: "suspicious",
      reason: safeString(reason).slice(0, 160),
    });
    session.lastActivityAt = nowMs();
    session.idleExpiresAt = Math.min(session.lastActivityAt + idleTtlMs, session.absoluteExpiresAt);
    await store.putSession(session);
    logger?.warn("security", "Suspicious session activity", {
      requestId: req?.context?.requestId,
      sessionIdHash: hashValue(session.sessionId, signingKey),
      reason,
    });
  }

  function sessionHeaders(session) {
    if (!session) return {};
    const feedbackCount = metadataCounter(session, "feedbackCount");
    return {
      "X-Session-Id-Hash": hashValue(session.sessionId, signingKey),
      "X-Session-Chat-Remaining": String(Math.max(0, chatQuota - Number(session.requestCount || 0))),
      "X-Session-Photo-Remaining": String(
        Math.max(0, photoQuota - Number(session.photoRequestCount || 0)),
      ),
      "X-Session-Feedback-Remaining": String(Math.max(0, feedbackQuota - feedbackCount)),
      "X-Session-Expires-At": String(Number(session.idleExpiresAt || 0)),
    };
  }

  async function cleanupExpiredSessions() {
    await store.cleanupExpired(nowMs());
  }

  return {
    cookieName,
    clearSetCookie,
    cleanupExpiredSessions,
    enforceQuota,
    flagSuspiciousSessionActivity,
    resolveSession,
    sessionHeaders,
    settings: {
      idleTtlMs,
      absoluteTtlMs,
      chatQuota,
      photoQuota,
      feedbackQuota,
      cooldownMs,
      enforceSignature,
    },
  };
}

module.exports = {
  createSessionManager,
};

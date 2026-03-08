function createWindowRateLimiter(options = {}) {
  const state = new Map();
  const defaultWindowMs = Number(options.defaultWindowMs || 60_000);

  function normalizeInteger(value, fallback) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.floor(parsed);
  }

  function cleanup(now = Date.now()) {
    for (const [key, item] of state.entries()) {
      if (!item || item.expiresAt <= now) {
        state.delete(key);
      }
    }
  }

  function consume(scope, key, limit, windowMs = defaultWindowMs) {
    const safeLimit = normalizeInteger(limit, 1);
    const safeWindowMs = normalizeInteger(windowMs, defaultWindowMs);
    const now = Date.now();
    const bucketKey = `${scope}:${key}`;
    const existing = state.get(bucketKey);

    if (!existing || existing.expiresAt <= now) {
      state.set(bucketKey, {
        count: 1,
        expiresAt: now + safeWindowMs,
      });
      return {
        allowed: true,
        remaining: Math.max(0, safeLimit - 1),
        retryAfterSeconds: 0,
      };
    }

    existing.count += 1;
    if (existing.count > safeLimit) {
      const retryAfterSeconds = Math.max(1, Math.ceil((existing.expiresAt - now) / 1000));
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds,
      };
    }

    return {
      allowed: true,
      remaining: Math.max(0, safeLimit - existing.count),
      retryAfterSeconds: 0,
    };
  }

  return {
    consume,
    cleanup,
  };
}

module.exports = {
  createWindowRateLimiter,
};

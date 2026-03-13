function safeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function safeThreshold(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.floor(parsed);
}

function safeWindowMs(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1000) return fallback;
  return Math.floor(parsed);
}

function createOpsTelemetry(options = {}) {
  const logger = options.logger;
  const onAlert = typeof options.onAlert === "function" ? options.onAlert : null;
  const windowMs = safeWindowMs(options.windowMs, 60_000);
  const cooldownMs = safeWindowMs(options.cooldownMs, 30_000);

  const thresholdByType = {
    http_5xx: safeThreshold(options.http5xxThreshold, 8),
    http_429: safeThreshold(options.http429Threshold, 25),
    blocked_prompt: safeThreshold(options.blockedPromptThreshold, 12),
    suspicious_upload: safeThreshold(options.suspiciousUploadThreshold, 8),
    readiness_failure: safeThreshold(options.readinessFailureThreshold, 3),
    ai_upstream_failure: safeThreshold(options.aiUpstreamFailureThreshold, 8),
  };

  const timestampsByType = new Map();
  const totalsByType = new Map();
  const lastAlertByType = new Map();
  const lastSeenMetaByType = new Map();

  function cleanup(now = Date.now()) {
    const cutoff = now - windowMs;
    for (const [eventType, timestamps] of timestampsByType.entries()) {
      if (!Array.isArray(timestamps) || timestamps.length === 0) {
        timestampsByType.delete(eventType);
        continue;
      }
      while (timestamps.length > 0 && timestamps[0] < cutoff) {
        timestamps.shift();
      }
      if (timestamps.length === 0) {
        timestampsByType.delete(eventType);
      }
    }
  }

  function windowCount(eventType, now = Date.now()) {
    cleanup(now);
    const entries = timestampsByType.get(eventType);
    return Array.isArray(entries) ? entries.length : 0;
  }

  function totalCount(eventType) {
    return Number(totalsByType.get(eventType) || 0);
  }

  function record(eventType, meta = {}) {
    const type = safeString(eventType);
    if (!type) return null;
    const now = Date.now();
    cleanup(now);

    const current = timestampsByType.get(type) || [];
    current.push(now);
    timestampsByType.set(type, current);
    totalsByType.set(type, totalCount(type) + 1);
    lastSeenMetaByType.set(type, {
      ...meta,
      ts: new Date(now).toISOString(),
    });

    const threshold = safeThreshold(thresholdByType[type], 0);
    const countInWindow = current.length;
    const lastAlertTs = Number(lastAlertByType.get(type) || 0);
    const shouldAlert =
      threshold > 0 &&
      countInWindow >= threshold &&
      (lastAlertTs === 0 || now - lastAlertTs >= cooldownMs);

    if (shouldAlert) {
      lastAlertByType.set(type, now);
      const alertPayload = {
        eventType: type,
        threshold,
        countInWindow,
        windowMs,
        cooldownMs,
        ...meta,
      };
      logger?.warn("ops/alert", "Operational threshold exceeded", alertPayload);
      try {
        onAlert?.(alertPayload);
      } catch {
        // Best-effort hook only.
      }
    }

    return {
      eventType: type,
      countInWindow,
      total: totalCount(type),
      threshold,
      alerted: shouldAlert,
    };
  }

  function snapshot() {
    const now = Date.now();
    cleanup(now);
    const events = {};
    const allTypes = new Set([
      ...Object.keys(thresholdByType),
      ...timestampsByType.keys(),
      ...totalsByType.keys(),
    ]);
    for (const eventType of allTypes) {
      const threshold = safeThreshold(thresholdByType[eventType], 0);
      events[eventType] = {
        total: totalCount(eventType),
        windowCount: windowCount(eventType, now),
        threshold,
        windowMs,
        lastSeen: lastSeenMetaByType.get(eventType) || null,
      };
    }
    return {
      generatedAt: new Date(now).toISOString(),
      windowMs,
      cooldownMs,
      events,
    };
  }

  return {
    record,
    snapshot,
  };
}

module.exports = {
  createOpsTelemetry,
};

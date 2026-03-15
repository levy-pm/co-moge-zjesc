const fs = require("fs");
const path = require("path");

function parseJsonSafe(value, fallback) {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function serializeJsonSafe(value, fallback = "{}") {
  try {
    return JSON.stringify(value);
  } catch {
    return fallback;
  }
}

function normalizeSession(raw) {
  if (!raw || typeof raw !== "object") return null;
  const sessionId = typeof raw.sessionId === "string" ? raw.sessionId : "";
  if (!sessionId) return null;

  return {
    sessionId,
    createdAt: Number(raw.createdAt || 0),
    lastActivityAt: Number(raw.lastActivityAt || 0),
    idleExpiresAt: Number(raw.idleExpiresAt || 0),
    absoluteExpiresAt: Number(raw.absoluteExpiresAt || 0),
    requestCount: Number(raw.requestCount || 0),
    photoRequestCount: Number(raw.photoRequestCount || 0),
    blockedUntil: Number(raw.blockedUntil || 0),
    securityFlags: Array.isArray(raw.securityFlags) ? raw.securityFlags.slice(0, 40) : [],
    linkedUserId: typeof raw.linkedUserId === "string" ? raw.linkedUserId : null,
    metadata: raw.metadata && typeof raw.metadata === "object" ? raw.metadata : {},
  };
}

class InMemorySessionStore {
  constructor() {
    this.sessions = new Map();
    this.ipCooldowns = new Map();
    this.adapterType = "memory";
  }

  async init() {}

  async getSession(sessionId) {
    const value = this.sessions.get(sessionId);
    return value ? { ...value } : null;
  }

  async putSession(session) {
    const normalized = normalizeSession(session);
    if (!normalized) return;
    this.sessions.set(normalized.sessionId, normalized);
  }

  async deleteSession(sessionId) {
    this.sessions.delete(sessionId);
  }

  async getIpCooldown(ipKey) {
    const value = Number(this.ipCooldowns.get(ipKey) || 0);
    return Number.isFinite(value) ? value : 0;
  }

  async setIpCooldown(ipKey, blockedUntil) {
    this.ipCooldowns.set(ipKey, Number(blockedUntil || 0));
  }

  async cleanupExpired(now = Date.now()) {
    for (const [sessionId, session] of this.sessions.entries()) {
      if (!session || session.idleExpiresAt <= now || session.absoluteExpiresAt <= now) {
        this.sessions.delete(sessionId);
      }
    }
    for (const [ipKey, blockedUntil] of this.ipCooldowns.entries()) {
      if (!blockedUntil || Number(blockedUntil) <= now) {
        this.ipCooldowns.delete(ipKey);
      }
    }
  }
}

class FileSessionStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.adapterType = "file";
    this.state = {
      sessions: {},
      ipCooldowns: {},
    };
  }

  async init() {
    const dir = path.dirname(this.filePath);
    fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(this.filePath)) {
      this.persistState();
      return;
    }

    const raw = fs.readFileSync(this.filePath, "utf8");
    const parsed = parseJsonSafe(raw, this.state);
    const sessions = parsed.sessions && typeof parsed.sessions === "object" ? parsed.sessions : {};
    const ipCooldowns =
      parsed.ipCooldowns && typeof parsed.ipCooldowns === "object" ? parsed.ipCooldowns : {};

    const normalizedSessions = {};
    for (const [sessionId, value] of Object.entries(sessions)) {
      const normalized = normalizeSession({
        ...(value && typeof value === "object" ? value : {}),
        sessionId,
      });
      if (!normalized) continue;
      normalizedSessions[sessionId] = normalized;
    }

    const normalizedCooldowns = {};
    for (const [ipKey, value] of Object.entries(ipCooldowns)) {
      const blockedUntil = Number(value || 0);
      if (blockedUntil > 0) {
        normalizedCooldowns[ipKey] = blockedUntil;
      }
    }

    this.state = {
      sessions: normalizedSessions,
      ipCooldowns: normalizedCooldowns,
    };
  }

  persistState() {
    const tmpPath = `${this.filePath}.tmp`;
    const serialized = `${serializeJsonSafe(this.state, "{}")}\n`;
    fs.writeFileSync(tmpPath, serialized, "utf8");
    try {
      fs.renameSync(tmpPath, this.filePath);
      return;
    } catch {
      // Some environments (AV/indexers on Windows) can temporarily lock file rename.
      // Fall back to direct write to preserve availability of quota/session persistence.
      fs.writeFileSync(this.filePath, serialized, "utf8");
      try {
        fs.unlinkSync(tmpPath);
      } catch {
        // no-op
      }
    }
  }

  async getSession(sessionId) {
    const raw = this.state.sessions[sessionId];
    return raw ? { ...raw } : null;
  }

  async putSession(session) {
    const normalized = normalizeSession(session);
    if (!normalized) return;
    this.state.sessions[normalized.sessionId] = normalized;
    this.persistState();
  }

  async deleteSession(sessionId) {
    delete this.state.sessions[sessionId];
    this.persistState();
  }

  async getIpCooldown(ipKey) {
    const blockedUntil = Number(this.state.ipCooldowns[ipKey] || 0);
    return Number.isFinite(blockedUntil) ? blockedUntil : 0;
  }

  async setIpCooldown(ipKey, blockedUntil) {
    const next = Number(blockedUntil || 0);
    if (next > 0) {
      this.state.ipCooldowns[ipKey] = next;
    } else {
      delete this.state.ipCooldowns[ipKey];
    }
    this.persistState();
  }

  async cleanupExpired(now = Date.now()) {
    let touched = false;
    for (const [sessionId, session] of Object.entries(this.state.sessions)) {
      if (!session || session.idleExpiresAt <= now || session.absoluteExpiresAt <= now) {
        delete this.state.sessions[sessionId];
        touched = true;
      }
    }

    for (const [ipKey, blockedUntil] of Object.entries(this.state.ipCooldowns)) {
      if (!blockedUntil || Number(blockedUntil) <= now) {
        delete this.state.ipCooldowns[ipKey];
        touched = true;
      }
    }

    if (touched) {
      this.persistState();
    }
  }
}

class MysqlSessionStore {
  constructor(options) {
    this.pool = options.pool;
    this.sessionsTable = options.sessionsTable || "anonymous_sessions";
    this.cooldownsTable = options.cooldownsTable || "anonymous_session_cooldowns";
    this.adapterType = "mysql";
  }

  async init() {
    const createSessionsSql = `
      CREATE TABLE IF NOT EXISTS \`${this.sessionsTable}\` (
        session_id VARCHAR(96) NOT NULL,
        created_at BIGINT NOT NULL,
        last_activity_at BIGINT NOT NULL,
        idle_expires_at BIGINT NOT NULL,
        absolute_expires_at BIGINT NOT NULL,
        request_count INT NOT NULL DEFAULT 0,
        photo_request_count INT NOT NULL DEFAULT 0,
        blocked_until BIGINT NOT NULL DEFAULT 0,
        security_flags_json TEXT NOT NULL,
        linked_user_id VARCHAR(96) NULL,
        metadata_json TEXT NOT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (session_id),
        KEY idx_idle_expires_at (idle_expires_at),
        KEY idx_absolute_expires_at (absolute_expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `;

    const createCooldownsSql = `
      CREATE TABLE IF NOT EXISTS \`${this.cooldownsTable}\` (
        ip_key VARCHAR(128) NOT NULL,
        blocked_until BIGINT NOT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (ip_key),
        KEY idx_blocked_until (blocked_until)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `;

    await this.pool.query(createSessionsSql);
    await this.pool.query(createCooldownsSql);
  }

  async getSession(sessionId) {
    const [rows] = await this.pool.query(
      `SELECT
        session_id, created_at, last_activity_at, idle_expires_at, absolute_expires_at,
        request_count, photo_request_count, blocked_until, security_flags_json, linked_user_id, metadata_json
      FROM \`${this.sessionsTable}\`
      WHERE session_id = ?
      LIMIT 1`,
      [sessionId],
    );
    if (!Array.isArray(rows) || rows.length === 0) return null;
    const row = rows[0];

    return normalizeSession({
      sessionId: row.session_id,
      createdAt: Number(row.created_at || 0),
      lastActivityAt: Number(row.last_activity_at || 0),
      idleExpiresAt: Number(row.idle_expires_at || 0),
      absoluteExpiresAt: Number(row.absolute_expires_at || 0),
      requestCount: Number(row.request_count || 0),
      photoRequestCount: Number(row.photo_request_count || 0),
      blockedUntil: Number(row.blocked_until || 0),
      securityFlags: parseJsonSafe(row.security_flags_json, []),
      linkedUserId: row.linked_user_id ? String(row.linked_user_id) : null,
      metadata: parseJsonSafe(row.metadata_json, {}),
    });
  }

  async putSession(session) {
    const normalized = normalizeSession(session);
    if (!normalized) return;

    await this.pool.query(
      `INSERT INTO \`${this.sessionsTable}\`
      (session_id, created_at, last_activity_at, idle_expires_at, absolute_expires_at, request_count, photo_request_count, blocked_until, security_flags_json, linked_user_id, metadata_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        created_at = VALUES(created_at),
        last_activity_at = VALUES(last_activity_at),
        idle_expires_at = VALUES(idle_expires_at),
        absolute_expires_at = VALUES(absolute_expires_at),
        request_count = VALUES(request_count),
        photo_request_count = VALUES(photo_request_count),
        blocked_until = VALUES(blocked_until),
        security_flags_json = VALUES(security_flags_json),
        linked_user_id = VALUES(linked_user_id),
        metadata_json = VALUES(metadata_json)`,
      [
        normalized.sessionId,
        normalized.createdAt,
        normalized.lastActivityAt,
        normalized.idleExpiresAt,
        normalized.absoluteExpiresAt,
        normalized.requestCount,
        normalized.photoRequestCount,
        normalized.blockedUntil,
        serializeJsonSafe(normalized.securityFlags, "[]"),
        normalized.linkedUserId,
        serializeJsonSafe(normalized.metadata, "{}"),
      ],
    );
  }

  async deleteSession(sessionId) {
    await this.pool.query(`DELETE FROM \`${this.sessionsTable}\` WHERE session_id = ?`, [sessionId]);
  }

  async getIpCooldown(ipKey) {
    const [rows] = await this.pool.query(
      `SELECT blocked_until
      FROM \`${this.cooldownsTable}\`
      WHERE ip_key = ?
      LIMIT 1`,
      [ipKey],
    );
    if (!Array.isArray(rows) || rows.length === 0) return 0;
    return Number(rows[0].blocked_until || 0);
  }

  async setIpCooldown(ipKey, blockedUntil) {
    const next = Number(blockedUntil || 0);
    if (next > 0) {
      await this.pool.query(
        `INSERT INTO \`${this.cooldownsTable}\` (ip_key, blocked_until)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE blocked_until = VALUES(blocked_until)`,
        [ipKey, next],
      );
      return;
    }

    await this.pool.query(`DELETE FROM \`${this.cooldownsTable}\` WHERE ip_key = ?`, [ipKey]);
  }

  async cleanupExpired(now = Date.now()) {
    await this.pool.query(
      `DELETE FROM \`${this.sessionsTable}\`
      WHERE idle_expires_at <= ? OR absolute_expires_at <= ?`,
      [now, now],
    );
    await this.pool.query(`DELETE FROM \`${this.cooldownsTable}\` WHERE blocked_until <= ?`, [now]);
  }
}

async function createSessionStore(options) {
  const logger = options.logger;
  const mysqlPool = options.mysqlPool || null;
  const sessionsFilePath = options.sessionsFilePath;
  const sessionsTable = options.sessionsTable;
  const cooldownsTable = options.cooldownsTable;

  if (mysqlPool) {
    try {
      const mysqlStore = new MysqlSessionStore({
        pool: mysqlPool,
        sessionsTable,
        cooldownsTable,
      });
      await mysqlStore.init();
      logger?.info("auth/session", "Anonymous session store initialized", {
        adapter: mysqlStore.adapterType,
      });
      return mysqlStore;
    } catch (error) {
      logger?.warn("auth/session", "MySQL session store init failed, falling back", {
        adapter: "mysql",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (sessionsFilePath) {
    try {
      const fileStore = new FileSessionStore(sessionsFilePath);
      await fileStore.init();
      logger?.info("auth/session", "Anonymous session store initialized", {
        adapter: fileStore.adapterType,
      });
      return fileStore;
    } catch (error) {
      logger?.warn("auth/session", "File session store init failed, falling back", {
        adapter: "file",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const memoryStore = new InMemorySessionStore();
  await memoryStore.init();
  logger?.warn("auth/session", "Anonymous session store fallback", {
    adapter: memoryStore.adapterType,
  });
  return memoryStore;
}

module.exports = {
  createSessionStore,
};

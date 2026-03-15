function createAdminRoutesHandler(options = {}) {
  const sendJson = options.sendJson;
  const ensureSameOrigin = options.ensureSameOrigin;
  const enforceRateLimit = options.enforceRateLimit;
  const parseJsonBodyOrRespond = options.parseJsonBodyOrRespond;
  const validateAdminLoginPayload = options.validateAdminLoginPayload;
  const safeLimitedString = options.safeLimitedString;
  const timingSafeStringEquals = options.timingSafeStringEquals;
  const adminCookieHeader = options.adminCookieHeader;
  const clearAdminCookieHeader = options.clearAdminCookieHeader;
  const createAdminToken = options.createAdminToken;
  const isAdminRequest = options.isAdminRequest;
  const getClientIp = options.getClientIp;
  const hashValue = options.hashValue;
  const logger = options.logger;
  const getState = options.getState;
  const getMetricsSnapshot = options.getMetricsSnapshot;

  return async function handleAdminRoutes(req, res, pathname, method) {
    const state = getState();

    if (method === "GET" && pathname === "/backend/admin/me") {
      if (
        !enforceRateLimit(
          req,
          res,
          "admin-route",
          state.adminRouteRateLimitMax,
          "Zbyt wiele zapytan administracyjnych. Sprobuj ponownie pozniej.",
        )
      ) {
        return true;
      }

      sendJson(res, 200, {
        loggedIn: state.adminSecurityReady && isAdminRequest(req),
        adminEnabled: state.adminSecurityReady,
      });
      return true;
    }

    if (method === "POST" && pathname === "/backend/admin/login") {
      if (!ensureSameOrigin(req, res)) return true;

      if (
        !enforceRateLimit(
          req,
          res,
          "admin-login",
          state.adminLoginRateLimitMax,
          "Zbyt wiele prob logowania. Sprobuj ponownie pozniej.",
        )
      ) {
        return true;
      }

      if (!state.adminSecurityReady) {
        logger?.warn("admin", "Admin login attempted when disabled", {
          requestId: req?.context?.requestId,
        });
        sendJson(res, 503, {
          error:
            "Logowanie admina jest wylaczone: ustaw bezpieczne ADMIN_PASSWORD i ADMIN_SESSION_SECRET (min. 32 znaki).",
        });
        return true;
      }

      const payload = await parseJsonBodyOrRespond(req, res);
      if (payload === null) {
        return true;
      }

      const loginValidation = validateAdminLoginPayload(payload);
      if (!loginValidation.ok) {
        sendJson(res, loginValidation.status, { error: loginValidation.error });
        return true;
      }

      const password = safeLimitedString(payload?.password, 256);
      if (!timingSafeStringEquals(password, state.adminPassword)) {
        logger?.warn("admin", "Admin login failed", {
          requestId: req?.context?.requestId,
          ipHash: hashValue(
            getClientIp(req),
            state.anonSessionSecret || state.sessionSecret || "admin-ip",
          ),
        });
        sendJson(res, 401, { error: "Zle haslo!" });
        return true;
      }

      const token = createAdminToken();
      logger?.info("admin", "Admin login successful", {
        requestId: req?.context?.requestId,
      });
      sendJson(
        res,
        200,
        { ok: true },
        {
          "Set-Cookie": adminCookieHeader(token, state.sessionTtlSeconds),
        },
      );
      return true;
    }

    if (method === "POST" && pathname === "/backend/admin/logout") {
      if (!ensureSameOrigin(req, res)) return true;
      if (
        !enforceRateLimit(
          req,
          res,
          "admin-route",
          state.adminRouteRateLimitMax,
          "Zbyt wiele zapytan administracyjnych. Sprobuj ponownie pozniej.",
        )
      ) {
        return true;
      }
      logger?.info("admin", "Admin logout", {
        requestId: req?.context?.requestId,
      });
      sendJson(
        res,
        200,
        { ok: true },
        { "Set-Cookie": clearAdminCookieHeader() },
      );
      return true;
    }

    if (method === "GET" && pathname === "/backend/admin/ops-metrics") {
      if (!state.requireAdmin(req, res)) {
        return true;
      }
      sendJson(res, 200, {
        ok: true,
        metrics: getMetricsSnapshot ? getMetricsSnapshot() : {},
      });
      return true;
    }

    return false;
  };
}

module.exports = {
  createAdminRoutesHandler,
};

function createOpsRoutesHandler(options = {}) {
  const sendJson = options.sendJson;
  const countRecipes = options.countRecipes;
  const hasDbConfig = options.hasDbConfig;
  const safeLimitedString = options.safeLimitedString;
  const getState = options.getState;
  const fs = options.fs;
  const path = options.path;
  const distPath = options.distPath;
  const recordOpsEvent = options.recordOpsEvent;

  return async function handleOpsRoutes(req, res, pathname, method) {
    if (method === "GET" && pathname === "/backend/health") {
      const state = getState();
      const recipes = await countRecipes();
      sendJson(res, 200, {
        ok: true,
        storage: state.dbEnabled ? "mysql" : "file",
        dbReady: state.dbEnabled || !hasDbConfig(),
        dbError: state.dbEnabled ? "" : safeLimitedString(state.dbLastError, 180),
        adminAuthConfigured: Boolean(state.adminSecurityReady),
        sessionLayerReady: Boolean(state.sessionManager && state.sessionStore),
        recipes,
        feedback: Number(state.feedbackCount || 0),
      });
      return true;
    }

    if (method === "GET" && pathname === "/backend/readiness") {
      const state = getState();
      const sessionReady = Boolean(state.sessionManager && state.sessionStore);
      const dbReady = state.dbEnabled || !hasDbConfig();
      const staticReady = fs.existsSync(path.join(distPath, "index.html"));
      const ready = sessionReady && dbReady && staticReady;

      if (!ready) {
        recordOpsEvent?.("readiness_failure", {
          dbReady,
          sessionReady,
          staticReady,
        });
      }

      sendJson(res, ready ? 200 : 503, {
        ok: ready,
        checks: {
          db: dbReady,
          session: sessionReady,
          static: staticReady,
        },
        storage: state.dbEnabled ? "mysql" : "file",
        sessionStore: state.sessionStore?.adapterType || "none",
      });
      return true;
    }

    return false;
  };
}

module.exports = {
  createOpsRoutesHandler,
};

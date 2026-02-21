try {
  require('./bootstrap.cjs');
} catch (error) {
  console.error('[entrypoint server.cjs] bootstrap load failed:', error && error.message ? error.message : error);
  require('./frontend/dist/index.js');
}

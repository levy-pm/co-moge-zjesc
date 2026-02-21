try {
  require('./bootstrap.cjs');
} catch (error) {
  console.error('[entrypoint index.js] bootstrap load failed:', error && error.message ? error.message : error);
  require('./frontend/dist/index.js');
}

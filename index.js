try {
  require('./bootstrap.cjs');
} catch (error) {
  console.error('[entrypoint index.js] bootstrap load failed:', error && error.message ? error.message : error);
  try {
    require('./frontend/dist/index.js');
  } catch (innerError) {
    console.error('[entrypoint index.js] frontend/dist runtime not found, trying dist:', innerError && innerError.message ? innerError.message : innerError);
    require('./dist/index.js');
  }
}

const { createHandler } = require('../../lib/respond.cjs');

module.exports = createHandler((req, url) => {
  const fromQuery = req.query && req.query.id;
  const fromPath = url.pathname.split('/').filter(Boolean).pop();
  return '/api/leads/' + encodeURIComponent(String(fromQuery || fromPath || ''));
});

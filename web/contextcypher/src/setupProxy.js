const { createProxyMiddleware } = require('http-proxy-middleware');
const fs = require('fs');
const path = require('path');

function readPort() {
  try {
    const file = path.join(__dirname, '..', '.current-port');
    if (fs.existsSync(file)) {
      const json = JSON.parse(fs.readFileSync(file, 'utf-8'));
      if (json && json.port) return json.port.toString();
    }
  } catch (_) {}
  return '3001';
}

module.exports = function (app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:3001', // initial fallback
      changeOrigin: true,
      secure: false,
      logLevel: 'silent',
      router: () => `http://localhost:${readPort()}`,
      onError: (err, req, res) => {
        res.writeHead(502, { 'Content-Type': 'text/plain' });
        res.end('Backend unavailable');
      },
    })
  );
}; 
const fs = require('fs');
const http = require('http');
const path = require('path');

function startFallback(statusCode, message, details) {
  const port = Number(process.env.PORT || 3000);
  const body = JSON.stringify(
    {
      ok: false,
      message,
      details,
    },
    null,
    2
  );

  const server = http.createServer((req, res) => {
    const url = req.url || '/';
    if (url === '/backend/health') {
      res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=UTF-8',
        'Content-Length': Buffer.byteLength(body),
        'Cache-Control': 'no-store',
      });
      res.end(body);
      return;
    }

    res.writeHead(statusCode, {
      'Content-Type': 'text/plain; charset=UTF-8',
      'Cache-Control': 'no-store',
    });
    res.end(`${message}\n${details}`);
  });

  server.listen(port, () => {
    console.error(`[bootstrap] fallback server on port ${port}: ${message}`);
  });
}

const candidates = [
  path.resolve(__dirname, 'frontend', 'dist', 'index.js'),
  path.resolve(__dirname, 'dist', 'index.js'),
];

const runtimePath = candidates.find((candidate) => fs.existsSync(candidate));

if (!runtimePath) {
  const checked = candidates.join(' | ');
  const details = `Runtime file not found. Checked: ${checked}`;
  console.error(`[bootstrap] ${details}`);
  startFallback(500, 'Node runtime file missing', details);
} else {
  try {
    require(runtimePath);
  } catch (error) {
    const details = error && error.stack ? error.stack : String(error);
    console.error('[bootstrap] runtime crash:', details);
    startFallback(500, 'Node runtime crashed on startup', details);
  }
}

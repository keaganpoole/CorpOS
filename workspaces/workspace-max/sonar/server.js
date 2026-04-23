const { Controller } = require('./backend/controller');
const express = require('express');
const path = require('path');
const fs = require('fs');

const controller = new Controller();
const app = express();

// WYSL dist directory (contains HomePage, PricingPage, and Sonar dashboard)
const wyslDist = path.resolve(__dirname, '..', 'wysl', 'dist');
const spaIndexPath = path.join(wyslDist, 'index.html');
const spaIndexHtml = fs.readFileSync(spaIndexPath, 'utf8');

// Middleware: serve static files from WYSL dist
app.use((req, res, next) => {
  const filePath = path.join(wyslDist, req.path);
  const resolvedPath = path.resolve(filePath);

  // Security: prevent directory traversal
  if (!resolvedPath.startsWith(wyslDist)) {
    return res.status(403).send('Forbidden');
  }

  if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile()) {
    const ext = path.extname(resolvedPath);
    const mimeTypes = {
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.svg': 'image/svg+xml',
      '.json': 'application/json',
      '.ico': 'image/x-icon',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
    };
    res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
    fs.createReadStream(resolvedPath).pipe(res);
  } else {
    next();
  }
});

// SPA catch-all: serve WYSL's index.html for all unmatched routes
// React Router handles /, /pricing, /dashboard, etc.
app.use((req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(spaIndexHtml);
});

// Start the main backend controller
controller.start()
  .then((port) => {
    console.log(`[Sonar] Backend ready on http://127.0.0.1:${port}`);
  })
  .catch((err) => {
    console.error('[Sonar] Failed to start backend:', err.message);
    process.exit(1);
  });

// Start the combined server on port 5173
const combinedPort = 5173;
app.listen(combinedPort, '127.0.0.1', () => {
  console.log(`[Sonar] Frontend ready on http://127.0.0.1:${combinedPort}`);
});

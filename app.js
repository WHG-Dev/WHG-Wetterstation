const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const logger = require('morgan');
const cookieParser = require('cookie-parser');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const compr = require('compression');
const expressStaticGzip = require('express-static-gzip');
const createError = require('http-errors');

// Import routes
const weatherRoutes = require('./routes/weather');

const server = express();
const domain = '87.106.45.28';
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || 'localhost';

// ============================================================================
// Middleware Setup
// ============================================================================
server.use(compr());
server.use(cors());
server.use(bodyParser.json());
server.use(logger('dev'));
server.use(cookieParser());
server.use(express.urlencoded({ extended: false }));

// Static file serving with Brotli/Gzip compression
server.use(
  expressStaticGzip(path.join(__dirname, 'website/dist/'), {
    enableBrotli: true,
    orderPreference: ['br', 'gz'],
    setHeaders: (res) => {
      res.setHeader('Cache-Control', 'public, max-age=31536000');
    },
  })
);

server.use(express.static(path.join(__dirname, 'website/dist/')));

// ============================================================================
// Routes
// ============================================================================
server.use('/api/weather', weatherRoutes);
server.use('/names', weatherRoutes);

// ============================================================================
// Error Handling
// ============================================================================

// 404 handler
server.use((req, res, next) => {
  next(createError(404, 'Ressource nicht gefunden'));
});

// Global error handler
server.use((err, req, res, next) => {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  res.status(err.status || 500);
  
  if (isDevelopment) {
    res.send(`
      <h1>${err.message}</h1>
      <h2>Status: ${err.status || 500}</h2>
      <pre>${err.stack}</pre>
    `);
  } else {
    res.json({
      status: 'error',
      message: err.message,
      statusCode: err.status || 500
    });
  }
});

// ============================================================================
// Server Startup
// ============================================================================

// HTTP Server
http.createServer(server).listen(PORT, HOST, () => {
  console.log(`HTTP Server läuft auf http://${HOST}:${PORT}`);
});

// HTTPS Server (Production - auskommentiert, da Zertifikate fehlen könnten)
/*
try {
  const options = {
    key: fs.readFileSync('cert.key'),
    cert: fs.readFileSync('cert.crt'),
  };
  
  https.createServer(options, server).listen(443, () => {
    console.log(' HTTPS Server läuft auf Port 443');
  });
} catch (err) {
  console.error(' HTTPS Zertifikate nicht gefunden:', err.message);
  console.log('ℹ Server läuft nur im HTTP-Modus');
}
*/

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n Server wird heruntergefahren...');
  const db = require('./database/db');
  db.close((err) => {
    if (err) {
      console.error('Fehler beim Schließen der Datenbank:', err);
    } else {
      console.log('Datenbankverbindung geschlossen');
    }
    process.exit(0);
  });
});

module.exports = server;
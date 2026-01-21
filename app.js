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
const distPath = path.join(__dirname, 'website/dist/');
if (fs.existsSync(distPath)) {
  server.use(
    expressStaticGzip(distPath, {
      enableBrotli: true,
      orderPreference: ['br', 'gz'],
      setHeaders: (res) => {
        res.setHeader('Cache-Control', 'public, max-age=31536000');
      },
    })
  );
  server.use(express.static(distPath));
  console.log('✅ Static files configured');
} else {
  console.log('⚠️  Website directory not found:', distPath);
}

// ============================================================================
// API Routes
// ============================================================================
server.use('/api/weather', weatherRoutes);

// Backwards compatibility for /names endpoint
server.get('/names', async (req, res, next) => {
  try {
    const { getAllSenders } = require('./database/queries');
    const senders = await getAllSenders();
    
    const names = {};
    senders.forEach(sender => {
      names[`sender_${sender.sender_id}`] = sender.name;
    });
    
    res.status(200).json(names);
  } catch (err) {
    next(createError(500, err.message));
  }
});

// Health check endpoint
server.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API documentation endpoint
server.get('/api', (req, res) => {
  res.json({
    version: '2.0.0',
    endpoints: {
      weather_data: {
        'POST /api/weather': 'Submit single weather data entry',
        'POST /api/weather/batch': 'Submit batch weather data',
        'GET /api/weather/current/:senderId': 'Get latest data for sender',
        'GET /api/weather/:senderId': 'Get hourly samples (default: 5 hours)',
        'GET /api/weather/:senderId/range': 'Get all data in time range',
        'GET /api/weather/:senderId/averages': 'Get hourly averages',
        'GET /api/weather/:senderId/statistics': 'Get statistics'
      },
      senders: {
        'GET /api/weather/senders/list': 'Get all sender names (legacy format)',
        'GET /api/weather/senders/all': 'Get all senders with details',
        'PUT /api/weather/senders/:senderId': 'Update sender information'
      },
      alerts: {
        'POST /api/weather/alerts': 'Create new alert',
        'GET /api/weather/alerts/:senderId': 'Get alerts for sender'
      },
      legacy: {
        'GET /names': 'Legacy endpoint - redirects to senders/list'
      },
      system: {
        'GET /health': 'Health check',
        'GET /api': 'API documentation'
      }
    }
  });
});

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
      <!DOCTYPE html>
      <html>
      <head>
        <title>Error ${err.status || 500}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5; }
          .error { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          h1 { color: #e74c3c; }
          pre { background: #f8f9fa; padding: 15px; border-radius: 4px; overflow-x: auto; }
        </style>
      </head>
      <body>
        <div class="error">
          <h1>${err.message}</h1>
          <h2>Status: ${err.status || 500}</h2>
          <pre>${err.stack}</pre>
        </div>
      </body>
      </html>
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
const httpServer = http.createServer(server).listen(PORT, HOST, () => {
  console.log('\n🚀 Weather Station Server gestartet!');
  console.log(`   📡 HTTP Server: http://${HOST}:${PORT}`);
  console.log(`   📊 API Doku: http://${HOST}:${PORT}/api`);
  console.log(`   ❤️  Health Check: http://${HOST}:${PORT}/health`);
  console.log(`   🌍 Environment: ${process.env.NODE_ENV || 'development'}\n`);
});

// HTTPS Server (Production)
if (process.env.ENABLE_HTTPS === 'true') {
  try {
    const options = {
      key: fs.readFileSync('cert.key'),
      cert: fs.readFileSync('cert.crt'),
    };
    
    https.createServer(options, server).listen(443, () => {
      console.log('🔒 HTTPS Server läuft auf Port 443');
    });
  } catch (err) {
    console.log('⚠️  HTTPS Zertifikate nicht gefunden');
    console.log('   Tipp: Setze ENABLE_HTTPS=true in .env für HTTPS\n');
  }
}

// ============================================================================
// Graceful Shutdown
// ============================================================================

function shutdown() {
  console.log('\n👋 Server wird heruntergefahren...');
  
  httpServer.close(() => {
    console.log('✅ HTTP Server geschlossen');
    
    const db = require('./database/db');
    db.close((err) => {
      if (err) {
        console.error('❌ Fehler beim Schließen der Datenbank:', err);
        process.exit(1);
      } else {
        console.log('✅ Datenbankverbindung geschlossen');
        process.exit(0);
      }
    });
  });
  
  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('⏰ Erzwungenes Herunterfahren nach Timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

module.exports = server;
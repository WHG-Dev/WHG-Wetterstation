const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// ============================================================================
// Database Connection
// ============================================================================

const dbPath = path.join(__dirname, '..', 'weather.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Database connection error:', err);
    process.exit(1);
  } else {
    console.log('✅ Connected to the SQLite database.');
  }
});

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON');

module.exports = db;
const db = require('./db');

// ============================================================================
// Database Helper Functions
// ============================================================================

/**
 * Ensures a sender table exists in the database
 * @param {string|number} senderId - The sender identifier
 * @returns {Promise<void>}
 */
function ensureSenderTable(senderId) {
  return new Promise((resolve, reject) => {
    const query = `
      CREATE TABLE IF NOT EXISTS sender_${senderId} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        temperature REAL,
        humidity REAL,
        gasval INTEGER,
        unix BIGINT,
        hour INTEGER,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        name TEXT,
        data_json TEXT
      )
    `;
    
    db.run(query, (err) => {
      if (err) {
        console.error(`❌ Error creating table for sender ${senderId}:`, err);
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Executes a database query with parameters
 * @param {string} query - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<any>}
 */
function runQuery(query, params = []) {
  return new Promise((resolve, reject) => {
    db.run(query, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

/**
 * Gets the name of a sender from their table
 * @param {string} table - Table name
 * @returns {Promise<string>}
 */
function getSenderName(table) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT name FROM ${table} ORDER BY id DESC LIMIT 1`,
      [],
      (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row?.name || 'Unknown');
        }
      }
    );
  });
}

/**
 * Checks if a table exists in the database
 * @param {string} tableName - Name of the table
 * @returns {Promise<boolean>}
 */
function tableExists(tableName) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`,
      [tableName],
      (err, row) => {
        if (err) return reject(err);
        resolve(!!row);
      }
    );
  });
}

/**
 * Gets all rows from a table
 * @param {string} query - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Array>}
 */
function getAll(query, params = []) {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

/**
 * Gets a single row from a table
 * @param {string} query - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Object|null>}
 */
function getOne(query, params = []) {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) reject(err);
      else resolve(row || null);
    });
  });
}

module.exports = {
  ensureSenderTable,
  runQuery,
  getSenderName,
  tableExists,
  getAll,
  getOne
};
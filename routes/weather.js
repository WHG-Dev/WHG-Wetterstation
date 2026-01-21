const express = require('express');
const router = express.Router();
const createError = require('http-errors');
const db = require('../database/db');
const {
  ensureSenderTable,
  getSenderName,
  tableExists,
  runQuery
} = require('../database/queries');

// ============================================================================
// POST Routes
// ============================================================================

/**
 * POST / - Single weather data entry
 * Body: { id, temperature, humidity, gasval, time, hour, name }
 */
router.post('/', async (req, res, next) => {
  const { id, temperature, humidity, gasval, time, hour, name } = req.body;
  const senderId = id;

  // Validation
  if (!senderId) {
    return res.status(400).json({ 
      status: 'error', 
      error: 'Sender ID is required' 
    });
  }

  try {
    await ensureSenderTable(senderId);
    const dataJson = JSON.stringify(req.body);

    db.run(
      `INSERT INTO sender_${senderId} (temperature, humidity, gasval, unix, hour, data_json, name)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [temperature, humidity, gasval, time, hour, dataJson, name],
      function (err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ 
            status: 'error', 
            error: err.message 
          });
        }
        
        res.json({
          status: 'success',
          sender: senderId,
          id: this.lastID
        });
      }
    );
  } catch (err) {
    console.error('Error processing data:', err);
    res.status(500).json({ 
      status: 'error', 
      error: err.message 
    });
  }
});

/**
 * POST /batch - Batch weather data entry
 * Body: [{ id, temperature, humidity, gasval, unix, hour, name }, ...]
 */
router.post('/batch', async (req, res) => {
  try {
    // Validation
    if (!Array.isArray(req.body)) {
      return res.status(400).json({ 
        status: 'error',
        error: 'Request body must be an array' 
      });
    }

    if (req.body.length === 0) {
      return res.status(400).json({ 
        status: 'error',
        error: 'Empty array provided' 
      });
    }

    let processedCount = 0;
    const errors = [];

    for (const entry of req.body) {
      const { id, temperature, humidity, gasval, unix, hour, name } = entry;
      
      // Skip invalid entries
      if (!id || id === -1) continue;

      try {
        await ensureSenderTable(id);
        const dataJson = JSON.stringify(entry);

        await new Promise((resolve, reject) => {
          db.run(
            `INSERT INTO sender_${id} (temperature, humidity, gasval, unix, hour, name, data_json)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [temperature, humidity, gasval, unix, hour, name, dataJson],
            function (err) {
              if (err) reject(err);
              else resolve();
            }
          );
        });
        
        processedCount++;
      } catch (err) {
        console.error(`Error processing entry for sender ${id}:`, err);
        errors.push({ senderId: id, error: err.message });
      }
    }

    res.status(200).json({
      status: 'success',
      processed: processedCount,
      total: req.body.length,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (err) {
    console.error('Error processing batch data:', err);
    res.status(500).json({ 
      status: 'error',
      error: err.message 
    });
  }
});

// ============================================================================
// GET Routes
// ============================================================================

/**
 * GET /current/:name - Get latest weather data for a sender
 */
router.get('/current/:name', async (req, res, next) => {
  const senderId = req.params.name;

  try {
    const exists = await tableExists(senderId);

    if (!exists) {
      return next(createError(404, `Keine Daten gefunden für Sender ID: ${senderId}`));
    }

    db.get(
      `SELECT * FROM ${senderId} ORDER BY id DESC LIMIT 1`,
      (err, row) => {
        if (err) {
          return next(createError(500, 'Fehler beim Abrufen der Daten'));
        }
        if (!row) {
          return next(createError(404, 'Keine aktuellen Daten gefunden'));
        }
        res.status(200).json(row);
      }
    );
  } catch (error) {
    console.error('Error:', error);
    next(createError(500, 'Interner Serverfehler'));
  }
});

/**
 * GET /:name - Get hourly weather data (last 5 hours)
 */
router.get('/:name', async (req, res, next) => {
  const senderId = req.params.name;

  try {
    const exists = await tableExists(senderId);

    if (!exists) {
      return next(createError(404, `Keine Daten gefunden für Sender ID: ${senderId}`));
    }

    const query = `
      SELECT t.*
      FROM ${senderId} t
      JOIN (
        SELECT strftime('%Y-%m-%d %H', unix, 'unixepoch') AS stunde,
               MIN(unix) AS min_unix
        FROM ${senderId}
        WHERE unix >= strftime('%s', 'now') - 5*3600
        GROUP BY stunde
      ) s ON strftime('%Y-%m-%d %H', t.unix, 'unixepoch') = s.stunde
           AND t.unix = s.min_unix
      ORDER BY t.unix ASC
    `;

    db.all(query, [], (err, rows) => {
      if (err) {
        console.error('❌ Database error:', err);
        return next(createError(500, err.message));
      }
      
      console.log(`Gefundene Einträge für ${senderId}:`, rows.length);
      res.status(200).json({ data: rows });
    });
  } catch (error) {
    console.error('Error:', error);
    next(createError(500, error.message));
  }
});

/**
 * GET /names - Get all sender names (mounted on /names in app.js)
 */
router.get('/', async (req, res, next) => {
  const query = `
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
      AND name NOT LIKE 'sqlite_%';
  `;

  try {
    const rows = await new Promise((resolve, reject) => {
      db.all(query, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    const names = {};
    const tableNames = rows.map(row => row.name);
    
    for (const table of tableNames) {
      try {
        names[table] = await getSenderName(table);
      } catch (err) {
        console.error(`Error getting name for table ${table}:`, err);
        names[table] = 'Unknown';
      }
    }
    
    res.status(200).json(names);
  } catch (err) {
    console.error('Database query error:', err.message);
    next(createError(500, err.message));
  }
});

module.exports = router;
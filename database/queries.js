const db = require('./db');

// ============================================================================
// Database Helper Functions
// ============================================================================

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
 * Gets all rows from a query
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
 * Gets a single row from a query
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

// ============================================================================
// Sender Functions
// ============================================================================

/**
 * Ensures a sender exists in the database
 * @param {string} senderId - Sender ID
 * @param {string} name - Sender name (optional)
 * @returns {Promise<void>}
 */
async function ensureSender(senderId, name = null) {
  const senderName = name || `Sender ${senderId}`;
  
  await runQuery(
    `INSERT OR IGNORE INTO senders (sender_id, name, is_active) 
     VALUES (?, ?, 1)`,
    [senderId, senderName]
  );
}

/**
 * Gets a sender by ID
 * @param {string} senderId - Sender ID
 * @returns {Promise<Object|null>}
 */
function getSender(senderId) {
  return getOne(
    'SELECT * FROM senders WHERE sender_id = ?',
    [senderId]
  );
}

/**
 * Gets all active senders
 * @returns {Promise<Array>}
 */
function getAllSenders() {
  return getAll(
    'SELECT * FROM senders WHERE is_active = 1 ORDER BY name'
  );
}

/**
 * Updates sender information
 * @param {string} senderId - Sender ID
 * @param {Object} data - Data to update
 * @returns {Promise<any>}
 */
async function updateSender(senderId, data) {
  const fields = [];
  const values = [];
  
  if (data.name !== undefined) {
    fields.push('name = ?');
    values.push(data.name);
  }
  if (data.location !== undefined) {
    fields.push('location = ?');
    values.push(data.location);
  }
  if (data.description !== undefined) {
    fields.push('description = ?');
    values.push(data.description);
  }
  if (data.is_active !== undefined) {
    fields.push('is_active = ?');
    values.push(data.is_active);
  }
  
  if (fields.length === 0) return;
  
  values.push(senderId);
  
  return runQuery(
    `UPDATE senders SET ${fields.join(', ')} WHERE sender_id = ?`,
    values
  );
}

// ============================================================================
// Weather Data Functions
// ============================================================================

/**
 * Inserts weather data
 * @param {string} senderId - Sender ID
 * @param {Object} data - Weather data
 * @returns {Promise<any>}
 */
async function insertWeatherData(senderId, data) {
  await ensureSender(senderId, data.name);
  
  // Handle all possible timestamp field names
  const timestamp = data.unix_timestamp || data.unix || data.time || Math.floor(Date.now() / 1000);
  
  // Handle all possible pressure field names (for backward compatibility)
  const pressure = data.pressure || data.bar || data.gasval || data.gas_value;
  
  return runQuery(
    `INSERT INTO weather_data 
     (sender_id, temperature, humidity, pressure,
      light_level, battery_level, signal_strength, 
      unix_timestamp, unix, raw_data_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      senderId,
      data.temperature,
      data.humidity,
      pressure,
      data.light_level,
      data.battery_level,
      data.signal_strength,
      timestamp,
      timestamp, // unix (duplicate for compatibility)
      JSON.stringify(data)
    ]
  );
}

/**
 * Gets latest weather data for a sender
 * @param {string} senderId - Sender ID
 * @returns {Promise<Object|null>}
 */
function getLatestWeatherData(senderId) {
  return getOne(
    `SELECT wd.*, s.name, s.location
     FROM weather_data wd
     JOIN senders s ON wd.sender_id = s.sender_id
     WHERE wd.sender_id = ?
     ORDER BY wd.unix_timestamp DESC
     LIMIT 1`,
    [senderId]
  );
}

/**
 * Gets weather data for a time range
 * @param {string} senderId - Sender ID
 * @param {number} hoursAgo - How many hours to look back
 * @returns {Promise<Array>}
 */
function getWeatherDataRange(senderId, hoursAgo = 24) {
  const unixTimestamp = Math.floor(Date.now() / 1000) - (hoursAgo * 3600);
  
  return getAll(
    `SELECT * FROM weather_data
     WHERE sender_id = ? AND unix_timestamp >= ?
     ORDER BY unix_timestamp ASC`,
    [senderId, unixTimestamp]
  );
}

/**
 * Gets hourly averages for the last N hours
 * @param {string} senderId - Sender ID
 * @param {number} hours - Number of hours
 * @returns {Promise<Array>}
 */
function getHourlyAverages(senderId, hours = 24) {
  return getAll(
    `SELECT 
       strftime('%Y-%m-%d %H:00:00', datetime(unix_timestamp, 'unixepoch')) as hour,
       ROUND(AVG(temperature), 2) as avg_temp,
       ROUND(MIN(temperature), 2) as min_temp,
       ROUND(MAX(temperature), 2) as max_temp,
       ROUND(AVG(humidity), 2) as avg_humidity,
       ROUND(AVG(pressure), 0) as avg_pressure,
       COUNT(*) as measurements
     FROM weather_data
     WHERE sender_id = ? 
       AND unix_timestamp >= strftime('%s', 'now', '-${hours} hours')
     GROUP BY hour
     ORDER BY hour ASC`,
    [senderId]
  );
}

/**
 * Gets one data point per hour (for charts)
 * @param {string} senderId - Sender ID
 * @param {number} hours - Number of hours
 * @returns {Promise<Array>}
 */
function getHourlySamples(senderId, hours = 5) {
  // Validate hours parameter to prevent SQL injection
  const parsedHours = parseInt(hours);
  const safeHours = Number.isInteger(parsedHours) && parsedHours > 0 ? parsedHours : 5;
  
  return getAll(
    `SELECT t.*
     FROM weather_data t
     JOIN (
       SELECT strftime('%Y-%m-%d %H', unix_timestamp, 'unixepoch') AS hour,
              MIN(unix_timestamp) AS min_unix
       FROM weather_data
       WHERE sender_id = ? 
         AND unix_timestamp >= strftime('%s', 'now', '-${safeHours} hours')
       GROUP BY hour
       ORDER BY hour DESC
       LIMIT ?
     ) s ON strftime('%Y-%m-%d %H', t.unix_timestamp, 'unixepoch') = s.hour
          AND t.unix_timestamp = s.min_unix
     WHERE t.sender_id = ?
     ORDER BY t.unix_timestamp ASC`,
    [senderId, safeHours, senderId]
  );
}

// ============================================================================
// Alert Functions
// ============================================================================

/**
 * Creates an alert
 * @param {Object} alertData - Alert configuration
 * @returns {Promise<any>}
 */
function createAlert(alertData) {
  return runQuery(
    `INSERT INTO alerts 
     (sender_id, alert_type, condition, threshold_value, is_active)
     VALUES (?, ?, ?, ?, 1)`,
    [
      alertData.sender_id,
      alertData.alert_type,
      alertData.condition,
      alertData.threshold_value
    ]
  );
}

/**
 * Gets all alerts for a sender
 * @param {string} senderId - Sender ID
 * @returns {Promise<Array>}
 */
function getAlerts(senderId) {
  return getAll(
    'SELECT * FROM alerts WHERE sender_id = ? AND is_active = 1',
    [senderId]
  );
}

/**
 * Checks if any alerts should be triggered
 * @param {string} senderId - Sender ID
 * @param {Object} data - Current weather data
 * @returns {Promise<Array>}
 */
async function checkAlerts(senderId, data) {
  const alerts = await getAlerts(senderId);
  const triggered = [];
  
  for (const alert of alerts) {
    let value;
    
    switch (alert.alert_type) {
      case 'temperature':
        value = data.temperature;
        break;
      case 'humidity':
        value = data.humidity;
        break;
      case 'pressure':
        value = data.pressure;
        break;
      case 'battery':
        value = data.battery_level;
        break;
      default:
        continue;
    }
    
    if (value === undefined || value === null) continue;
    
    let shouldTrigger = false;
    
    switch (alert.condition) {
      case 'above':
        shouldTrigger = value > alert.threshold_value;
        break;
      case 'below':
        shouldTrigger = value < alert.threshold_value;
        break;
      case 'equals':
        shouldTrigger = Math.abs(value - alert.threshold_value) < 0.1;
        break;
    }
    
    if (shouldTrigger) {
      triggered.push(alert);
      
      // Update last triggered time
      await runQuery(
        'UPDATE alerts SET last_triggered = CURRENT_TIMESTAMP WHERE id = ?',
        [alert.id]
      );
    }
  }
  
  return triggered;
}

// ============================================================================
// Statistics Functions
// ============================================================================

/**
 * Calculates and stores hourly statistics
 * @param {string} senderId - Sender ID
 * @param {Date} startTime - Start time
 * @returns {Promise<any>}
 */
async function calculateHourlyStats(senderId, startTime = null) {
  const periodStart = startTime || new Date(Date.now() - 3600000); // 1 hour ago
  
  return runQuery(
    `INSERT INTO weather_statistics 
     (sender_id, stat_type, period_start, period_end,
      avg_temperature, min_temperature, max_temperature,
      avg_humidity, min_humidity, max_humidity, avg_pressure, data_points)
     SELECT 
       ?,
       'hourly',
       datetime(?, 'unixepoch'),
       datetime(?, 'unixepoch', '+1 hour'),
       ROUND(AVG(temperature), 2),
       ROUND(MIN(temperature), 2),
       ROUND(MAX(temperature), 2),
       ROUND(AVG(humidity), 2),
       ROUND(MIN(humidity), 2),
       ROUND(MAX(humidity), 2),
       ROUND(AVG(pressure), 0),
       COUNT(*)
     FROM weather_data
     WHERE sender_id = ? 
       AND unix_timestamp BETWEEN ? AND ?`,
    [
      senderId,
      Math.floor(periodStart.getTime() / 1000),
      Math.floor(periodStart.getTime() / 1000) + 3600,
      senderId,
      Math.floor(periodStart.getTime() / 1000),
      Math.floor(periodStart.getTime() / 1000) + 3600
    ]
  );
}

/**
 * Gets statistics for a sender
 * @param {string} senderId - Sender ID
 * @param {string} statType - 'hourly', 'daily', 'weekly', 'monthly'
 * @param {number} limit - Number of results
 * @returns {Promise<Array>}
 */
function getStatistics(senderId, statType = 'hourly', limit = 24) {
  return getAll(
    `SELECT * FROM weather_statistics
     WHERE sender_id = ? AND stat_type = ?
     ORDER BY period_start DESC
     LIMIT ?`,
    [senderId, statType, limit]
  );
}

// ============================================================================
// Logging Functions
// ============================================================================

/**
 * Logs a system event
 * @param {string} level - Log level: 'info', 'warning', 'error', 'critical'
 * @param {string} eventType - Type of event
 * @param {string} message - Log message
 * @param {string} senderId - Optional sender ID
 * @param {Object} metadata - Optional metadata
 * @returns {Promise<any>}
 */
function logEvent(level, eventType, message, senderId = null, metadata = null) {
  return runQuery(
    `INSERT INTO system_logs 
     (sender_id, log_level, event_type, message, metadata_json)
     VALUES (?, ?, ?, ?, ?)`,
    [
      senderId,
      level,
      eventType,
      message,
      metadata ? JSON.stringify(metadata) : null
    ]
  );
}

/**
 * Gets recent logs
 * @param {number} limit - Number of logs to retrieve
 * @param {string} level - Optional log level filter
 * @returns {Promise<Array>}
 */
function getLogs(limit = 100, level = null) {
  if (level) {
    return getAll(
      `SELECT * FROM system_logs 
       WHERE log_level = ?
       ORDER BY created_at DESC 
       LIMIT ?`,
      [level, limit]
    );
  }
  
  return getAll(
    'SELECT * FROM system_logs ORDER BY created_at DESC LIMIT ?',
    [limit]
  );
}

module.exports = {
  runQuery,
  getAll,
  getOne,
  
  // Sender functions
  ensureSender,
  getSender,
  getAllSenders,
  updateSender,
  
  // Weather data functions
  insertWeatherData,
  getLatestWeatherData,
  getWeatherDataRange,
  getHourlyAverages,
  getHourlySamples,
  
  // Alert functions
  createAlert,
  getAlerts,
  checkAlerts,
  
  // Statistics functions
  calculateHourlyStats,
  getStatistics,
  
  // Logging functions
  logEvent,
  getLogs
};
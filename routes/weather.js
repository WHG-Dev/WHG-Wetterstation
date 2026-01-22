const express = require('express');
const router = express.Router();
const createError = require('http-errors');
const {
  ensureSender,
  getSender,
  getAllSenders,
  updateSender,
  insertWeatherData,
  getLatestWeatherData,
  getWeatherDataRange,
  getHourlyAverages,
  getHourlySamples,
  createAlert,
  getAlerts,
  checkAlerts,
  getStatistics,
  logEvent
} = require('../database/queries');

// ============================================================================
// POST Routes - Data Ingestion
// ============================================================================

/**
 * POST / - Single weather data entry
 * Body: { id, temperature, humidity, gasval/pressure, time/unix, hour, name }
 */
router.post('/', async (req, res, next) => {
  const { id, temperature, humidity, gasval, time, hour, name } = req.body;
  const senderId = String(id);

  // Validation
  if (!senderId) {
    return res.status(400).json({ 
      status: 'error', 
      error: 'Sender ID is required' 
    });
  }

  try {
    // Insert weather data
    const result = await insertWeatherData(senderId, req.body);
    
    // Check alerts
    const triggeredAlerts = await checkAlerts(senderId, req.body);
    
    if (triggeredAlerts.length > 0) {
      console.log(`⚠️  ${triggeredAlerts.length} alert(s) triggered for sender ${senderId}`);
      await logEvent('warning', 'alert_triggered', 
        `${triggeredAlerts.length} alert(s) triggered`, 
        senderId, 
        { alerts: triggeredAlerts }
      );
    }
    
    res.json({
      status: 'success',
      sender: senderId,
      id: result.lastID,
      alerts: triggeredAlerts.length > 0 ? triggeredAlerts : undefined
    });
    
  } catch (err) {
    console.error('❌ Error processing data:', err);
    await logEvent('error', 'data_insert_failed', err.message, senderId);
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
    const allTriggeredAlerts = [];

    for (const entry of req.body) {
      const { id } = entry;
      
      // Skip invalid entries
      if (typeof id == "undefined" || id === -1) continue;
      
      const senderId = String(id);

      try {
        await insertWeatherData(senderId, entry);
        
        // Check alerts
        const triggeredAlerts = await checkAlerts(senderId, entry);
        if (triggeredAlerts.length > 0) {
          allTriggeredAlerts.push({ senderId, alerts: triggeredAlerts });
        }
        
        processedCount++;
      } catch (err) {
        console.error(`❌ Error processing entry for sender ${senderId}:`, err);
        errors.push({ senderId, error: err.message });
        await logEvent('error', 'batch_entry_failed', err.message, senderId);
      }
    }

    if (allTriggeredAlerts.length > 0) {
      await logEvent('warning', 'batch_alerts_triggered', 
        `Alerts triggered during batch import`, 
        null, 
        { alerts: allTriggeredAlerts }
      );
    }
    console.log(req.body);
    res.status(200).json({
      status: 'success',
      processed: processedCount,
      total: req.body.length,
      errors: errors.length > 0 ? errors : undefined,
      alerts: allTriggeredAlerts.length > 0 ? allTriggeredAlerts : undefined
    });

  } catch (err) {
    console.error('❌ Error processing batch data:', err);
    await logEvent('error', 'batch_failed', err.message);
    res.status(500).json({ 
      status: 'error',
      error: err.message 
    });
  }
});

// ============================================================================
// GET Routes - Data Retrieval
// ============================================================================

/**
 * GET /current/:senderId - Get latest weather data for a sender
 */
router.get('/current/:senderId', async (req, res, next) => {
  const senderId = req.params.senderId;

  try {
    const sender = await getSender(senderId);
    
    if (!sender) {
      return next(createError(404, `Keine Daten gefunden für Sender ID: ${senderId}`));
    }

    const data = await getLatestWeatherData(senderId);
    
    if (!data) {
      return next(createError(404, 'Keine aktuellen Daten gefunden'));
    }
    
    res.status(200).json(data);
    
  } catch (error) {
    console.error('❌ Error:', error);
    await logEvent('error', 'get_current_failed', error.message, senderId);
    next(createError(500, 'Interner Serverfehler'));
  }
});

/**
 * GET /:senderId - Get hourly weather data samples
 * Query params: hours (default: 5)
 */
router.get('/:senderId', async (req, res, next) => {
  const senderId = req.params.senderId;
  const hours = parseInt(req.query.hours) || 5;

  try {
    const sender = await getSender(senderId);
    
    if (!sender) {
      return next(createError(404, `Keine Daten gefunden für Sender ID: ${senderId}`));
    }

    const data = await getHourlySamples(senderId, hours);
    
    console.log(`✅ Gefundene Einträge für ${senderId} (${hours}h):`, data.length);
    console.log('📊 Sample data:', data.length > 0 ? data[0] : 'KEINE DATEN');
    
    res.status(200).json({ 
      data: data
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
    await logEvent('error', 'get_data_failed', error.message, senderId);
    next(createError(500, error.message));
  }
});

/**
 * GET /:senderId/range - Get all data in a time range
 * Query params: hours (default: 24)
 */
router.get('/:senderId/range', async (req, res, next) => {
  const senderId = req.params.senderId;
  const hours = parseInt(req.query.hours) || 24;

  try {
    const sender = await getSender(senderId);
    
    if (!sender) {
      return next(createError(404, `Sender nicht gefunden: ${senderId}`));
    }

    const data = await getWeatherDataRange(senderId, hours);
    
    res.status(200).json({ 
      sender: sender,
      data: data,
      hours: hours,
      count: data.length
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
    await logEvent('error', 'get_range_failed', error.message, senderId);
    next(createError(500, error.message));
  }
});

/**
 * GET /:senderId/averages - Get hourly averages
 * Query params: hours (default: 24)
 */
router.get('/:senderId/averages', async (req, res, next) => {
  const senderId = req.params.senderId;
  const hours = parseInt(req.query.hours) || 24;

  try {
    const sender = await getSender(senderId);
    
    if (!sender) {
      return next(createError(404, `Sender nicht gefunden: ${senderId}`));
    }

    const data = await getHourlyAverages(senderId, hours);
    
    res.status(200).json({ 
      sender: sender,
      data: data,
      hours: hours
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
    await logEvent('error', 'get_averages_failed', error.message, senderId);
    next(createError(500, error.message));
  }
});

/**
 * GET /:senderId/statistics - Get statistics
 * Query params: type (hourly/daily/weekly/monthly), limit (default: 24)
 */
router.get('/:senderId/statistics', async (req, res, next) => {
  const senderId = req.params.senderId;
  const statType = req.query.type || 'hourly';
  const limit = parseInt(req.query.limit) || 24;

  try {
    const sender = await getSender(senderId);
    
    if (!sender) {
      return next(createError(404, `Sender nicht gefunden: ${senderId}`));
    }

    const stats = await getStatistics(senderId, statType, limit);
    
    res.status(200).json({ 
      sender: sender,
      statistics: stats,
      type: statType
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
    await logEvent('error', 'get_stats_failed', error.message, senderId);
    next(createError(500, error.message));
  }
});

// ============================================================================
// Sender Management Routes
// ============================================================================

/**
 * GET /senders/list - Get all senders (moved from /names)
 */
router.get('/senders/list', async (req, res, next) => {
  try {
    const senders = await getAllSenders();
    
    // Format as before for backwards compatibility
    const names = {};
    senders.forEach(sender => {
      names[`sender_${sender.sender_id}`] = sender.name;
    });
    
    res.status(200).json(names);
    
  } catch (err) {
    console.error('❌ Error getting senders:', err.message);
    await logEvent('error', 'get_senders_failed', err.message);
    next(createError(500, err.message));
  }
});

/**
 * GET /senders/all - Get all senders with details
 */
router.get('/senders/all', async (req, res, next) => {
  try {
    const senders = await getAllSenders();
    
    res.status(200).json({ 
      senders: senders,
      count: senders.length
    });
    
  } catch (err) {
    console.error('❌ Error getting senders:', err.message);
    await logEvent('error', 'get_senders_failed', err.message);
    next(createError(500, err.message));
  }
});

/**
 * PUT /senders/:senderId - Update sender information
 */
router.put('/senders/:senderId', async (req, res, next) => {
  const senderId = req.params.senderId;
  const { name, location, description, is_active } = req.body;

  try {
    await updateSender(senderId, { name, location, description, is_active });
    
    const updated = await getSender(senderId);
    
    await logEvent('info', 'sender_updated', `Sender ${senderId} aktualisiert`, senderId);
    
    res.status(200).json({
      status: 'success',
      sender: updated
    });
    
  } catch (err) {
    console.error('❌ Error updating sender:', err);
    await logEvent('error', 'update_sender_failed', err.message, senderId);
    next(createError(500, err.message));
  }
});

// ============================================================================
// Alert Management Routes
// ============================================================================

/**
 * POST /alerts - Create a new alert
 */
router.post('/alerts', async (req, res, next) => {
  const { sender_id, alert_type, condition, threshold_value } = req.body;

  try {
    const result = await createAlert({ sender_id, alert_type, condition, threshold_value });
    
    await logEvent('info', 'alert_created', 
      `Alert erstellt: ${alert_type} ${condition} ${threshold_value}`, 
      sender_id
    );
    
    res.status(201).json({
      status: 'success',
      alert_id: result.lastID
    });
    
  } catch (err) {
    console.error('❌ Error creating alert:', err);
    await logEvent('error', 'create_alert_failed', err.message, sender_id);
    next(createError(500, err.message));
  }
});

/**
 * GET /alerts/:senderId - Get alerts for a sender
 */
router.get('/alerts/:senderId', async (req, res, next) => {
  const senderId = req.params.senderId;

  try {
    const alerts = await getAlerts(senderId);
    
    res.status(200).json({
      sender_id: senderId,
      alerts: alerts,
      count: alerts.length
    });
    
  } catch (err) {
    console.error('❌ Error getting alerts:', err);
    await logEvent('error', 'get_alerts_failed', err.message, senderId);
    next(createError(500, err.message));
  }
});

module.exports = router;
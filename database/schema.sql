-- ============================================================================
-- WETTERSTATION DATENBANK SCHEMA
-- ============================================================================

-- ============================================================================
-- 1. SENDERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS senders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    location TEXT,
    description TEXT,
    latitude REAL,
    longitude REAL,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 2. WEATHER_DATA TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS weather_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id TEXT NOT NULL,
    temperature REAL,
    humidity REAL,
    pressure INTEGER,
    light_level REAL,
    battery_level REAL,
    signal_strength INTEGER,
    unix_timestamp BIGINT NOT NULL,
    unix BIGINT,
    received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    raw_data_json TEXT,
    FOREIGN KEY (sender_id) REFERENCES senders(sender_id) ON DELETE CASCADE
);

-- ============================================================================
-- 3. SENSOR_TYPES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS sensor_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    manufacturer TEXT,
    measures TEXT,
    accuracy_temp REAL,
    accuracy_humidity REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 4. SENDER_SENSORS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS sender_sensors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id TEXT NOT NULL,
    sensor_type_id INTEGER NOT NULL,
    installed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    removed_at DATETIME,
    notes TEXT,
    FOREIGN KEY (sender_id) REFERENCES senders(sender_id) ON DELETE CASCADE,
    FOREIGN KEY (sensor_type_id) REFERENCES sensor_types(id)
);

-- ============================================================================
-- 5. ALERTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id TEXT NOT NULL,
    alert_type TEXT NOT NULL,
    condition TEXT NOT NULL,
    threshold_value REAL NOT NULL,
    is_active BOOLEAN DEFAULT 1,
    last_triggered DATETIME,
    notification_sent BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES senders(sender_id) ON DELETE CASCADE
);

-- ============================================================================
-- 6. WEATHER_STATISTICS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS weather_statistics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id TEXT NOT NULL,
    stat_type TEXT NOT NULL,
    period_start DATETIME NOT NULL,
    period_end DATETIME NOT NULL,
    avg_temperature REAL,
    min_temperature REAL,
    max_temperature REAL,
    avg_humidity REAL,
    min_humidity REAL,
    max_humidity REAL,
    avg_pressure REAL,
    data_points INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES senders(sender_id) ON DELETE CASCADE
);

-- ============================================================================
-- 7. SYSTEM_LOGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS system_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id TEXT,
    log_level TEXT NOT NULL,
    event_type TEXT NOT NULL,
    message TEXT NOT NULL,
    metadata_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES senders(sender_id) ON DELETE SET NULL
);

-- ============================================================================
-- VIEWS
-- ============================================================================

CREATE VIEW IF NOT EXISTS v_latest_weather AS
SELECT 
    s.sender_id,
    s.name,
    s.location,
    s.is_active,
    wd.temperature,
    wd.humidity,
    wd.pressure,
    wd.battery_level,
    wd.unix_timestamp,
    wd.received_at
FROM senders s
LEFT JOIN (
    SELECT w.*
    FROM weather_data w
    INNER JOIN (
        SELECT sender_id, MAX(unix_timestamp) as max_time
        FROM weather_data
        GROUP BY sender_id
    ) latest ON w.sender_id = latest.sender_id 
           AND w.unix_timestamp = latest.max_time
) wd ON s.sender_id = wd.sender_id
WHERE s.is_active = 1;

CREATE VIEW IF NOT EXISTS v_hourly_averages AS
SELECT 
    sender_id,
    strftime('%Y-%m-%d %H:00:00', datetime(unix_timestamp, 'unixepoch')) as hour,
    ROUND(AVG(temperature), 2) as avg_temp,
    ROUND(AVG(humidity), 2) as avg_humidity,
    ROUND(AVG(pressure), 0) as avg_pressure,
    COUNT(*) as measurements
FROM weather_data
WHERE unix_timestamp >= strftime('%s', 'now', '-24 hours')
GROUP BY sender_id, hour
ORDER BY hour DESC;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE TRIGGER IF NOT EXISTS update_sender_timestamp 
AFTER UPDATE ON senders
BEGIN
    UPDATE senders SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS log_new_sender
AFTER INSERT ON senders
BEGIN
    INSERT INTO system_logs (sender_id, log_level, event_type, message)
    VALUES (NEW.sender_id, 'info', 'sender_created', 'Neuer Sender erstellt: ' || NEW.name);
END;
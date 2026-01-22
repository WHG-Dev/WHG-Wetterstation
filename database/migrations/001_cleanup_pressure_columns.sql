-- Migration: Cleanup redundant pressure columns
-- Migrate gasval data to pressure if pressure is NULL
UPDATE weather_data 
SET pressure = gasval 
WHERE pressure IS NULL AND gasval IS NOT NULL;

-- Migrate gas_value to pressure if still NULL
UPDATE weather_data 
SET pressure = gas_value 
WHERE pressure IS NULL AND gas_value IS NOT NULL;

-- Migrate bar to pressure if still NULL
UPDATE weather_data 
SET pressure = bar 
WHERE pressure IS NULL AND bar IS NOT NULL;

-- Now we can safely drop the redundant columns
-- Note: SQLite doesn't support DROP COLUMN directly, so we need to recreate the table

-- Create new table with clean schema
CREATE TABLE weather_data_new (
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

-- Copy data from old table
INSERT INTO weather_data_new 
SELECT 
    id, sender_id, temperature, humidity, pressure,
    light_level, battery_level, signal_strength,
    unix_timestamp, unix, received_at, raw_data_json
FROM weather_data;

-- Drop old table
DROP TABLE weather_data;

-- Rename new table
ALTER TABLE weather_data_new RENAME TO weather_data;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_weather_data_sender ON weather_data(sender_id);
CREATE INDEX IF NOT EXISTS idx_weather_data_timestamp ON weather_data(unix_timestamp);
CREATE INDEX IF NOT EXISTS idx_weather_data_sender_timestamp ON weather_data(sender_id, unix_timestamp);

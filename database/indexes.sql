-- ============================================================================
-- DATABASE INDEXES
-- This file is executed AFTER schema.sql to ensure tables exist first
-- ============================================================================

-- Senders indexes
CREATE INDEX IF NOT EXISTS idx_senders_sender_id ON senders(sender_id);

-- Weather data indexes
CREATE INDEX IF NOT EXISTS idx_weather_sender_id ON weather_data(sender_id);
CREATE INDEX IF NOT EXISTS idx_weather_unix_timestamp ON weather_data(unix_timestamp);
CREATE INDEX IF NOT EXISTS idx_weather_sender_time ON weather_data(sender_id, unix_timestamp);

-- Statistics indexes
CREATE INDEX IF NOT EXISTS idx_stats_sender_period ON weather_statistics(sender_id, period_start);

-- System logs indexes
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON system_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_logs_level ON system_logs(log_level);
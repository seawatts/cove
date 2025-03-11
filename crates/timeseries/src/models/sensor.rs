use chrono::{DateTime, Utc};
use questdb::ingress::Buffer;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::error::{TsError, TsResult};
use crate::model::TimeSeriesModel;
use crate::types::ColumnType;

/// A simple sensor reading model for single-value sensors
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SensorReading {
    /// Timestamp of the reading
    pub ts: DateTime<Utc>,
    /// Device ID
    pub device_id: String,
    /// Sensor name
    pub sensor_id: String,
    /// Sensor value
    pub value: f64,
    /// Value unit
    pub unit: Option<String>,
    /// Room where the sensor is located
    pub room: Option<String>,
}

/// A device state reading model for complex multi-value states
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceStateReading {
    /// Timestamp of the reading
    pub ts: DateTime<Utc>,
    /// Device ID
    pub device_id: String,
    /// Device type (e.g., "light", "fan", etc.)
    pub device_type: String,
    /// State values as key-value pairs
    pub values: HashMap<String, f64>,
    /// State flags as key-value pairs (for boolean states)
    pub flags: HashMap<String, bool>,
    /// State strings as key-value pairs (for string states like effects)
    pub strings: HashMap<String, String>,
    /// Room where the device is located
    pub room: Option<String>,
}

impl TimeSeriesModel for SensorReading {
    fn table_name() -> &'static str {
        "sensor_readings"
    }

    fn timestamp(&self) -> DateTime<Utc> {
        self.ts
    }

    fn add_to_buffer(&self, buffer: &mut Buffer) -> TsResult<()> {
        // Clear the buffer
        buffer.clear();

        // Build the buffer using the fluent API pattern from the latest QuestDB documentation
        // Each method returns a reference to the buffer, allowing method chaining
        // We handle errors at each step
        buffer
            .table(Self::table_name())?
            .symbol("device_id", &self.device_id)?
            .symbol("sensor", &self.sensor_id)?;

        // Optionally add unit if present
        if let Some(unit) = &self.unit {
            buffer.symbol("unit", unit)?;
        }

        // Optionally add room if present
        if let Some(room) = &self.room {
            buffer.symbol("room", room)?;
        }

        // Add the value column
        buffer.column_f64("value", self.value)?;

        // Add the timestamp - convert from DateTime<Utc> to TimestampNanos
        use questdb::ingress::TimestampNanos;
        let ts_nanos = TimestampNanos::from_datetime(self.ts)
            .map_err(|e| TsError::ConnectionFailed(format!("Timestamp conversion error: {}", e)))?;
        buffer.at(ts_nanos)?;

        Ok(())
    }

    fn from_row(row: HashMap<String, serde_json::Value>) -> TsResult<Self> {
        // Extract values from the row with proper error handling
        let ts = match row.get("ts") {
            Some(serde_json::Value::String(s)) => DateTime::parse_from_rfc3339(s)
                .map_err(|e| TsError::InvalidDataType(format!("Invalid timestamp: {}", e)))?
                .with_timezone(&Utc),
            _ => return Err(TsError::FieldNotFound("ts".to_string())),
        };

        let device_id = match row.get("device_id") {
            Some(serde_json::Value::String(s)) => s.clone(),
            _ => return Err(TsError::FieldNotFound("device_id".to_string())),
        };

        let sensor_id = match row.get("sensor_id") {
            Some(serde_json::Value::String(s)) => s.clone(),
            _ => return Err(TsError::FieldNotFound("sensor".to_string())),
        };

        let value = match row.get("value") {
            Some(serde_json::Value::Number(n)) => n.as_f64().unwrap_or(0.0),
            _ => return Err(TsError::FieldNotFound("value".to_string())),
        };

        let unit = match row.get("unit") {
            Some(serde_json::Value::String(s)) => Some(s.clone()),
            Some(serde_json::Value::Null) => None,
            None => None,
            _ => {
                return Err(TsError::InvalidDataType(
                    "unit must be a string".to_string(),
                ))
            }
        };

        let room = match row.get("room") {
            Some(serde_json::Value::String(s)) => Some(s.clone()),
            Some(serde_json::Value::Null) => None,
            None => None,
            _ => {
                return Err(TsError::InvalidDataType(
                    "room must be a string".to_string(),
                ))
            }
        };

        Ok(Self {
            ts,
            device_id,
            sensor_id,
            value,
            unit,
            room,
        })
    }

    fn schema() -> Vec<(&'static str, ColumnType)> {
        vec![
            ("ts", ColumnType::Timestamp),
            ("device_id", ColumnType::Symbol),
            ("sensor_id", ColumnType::Symbol),
            ("value", ColumnType::Double),
            ("unit", ColumnType::Symbol),
            ("room", ColumnType::Symbol),
        ]
    }
}

impl TimeSeriesModel for DeviceStateReading {
    fn table_name() -> &'static str {
        "device_states"
    }

    fn timestamp(&self) -> DateTime<Utc> {
        self.ts
    }

    fn add_to_buffer(&self, buffer: &mut Buffer) -> TsResult<()> {
        buffer.clear();

        buffer
            .table(Self::table_name())?
            .symbol("device_id", &self.device_id)?
            .symbol("device_type", &self.device_type)?;

        // Add room if present
        if let Some(room) = &self.room {
            buffer.symbol("room", room)?;
        }

        // Add numeric values
        for (key, value) in &self.values {
            buffer.column_f64(key.as_str(), *value)?;
        }

        // Add boolean flags
        for (key, value) in &self.flags {
            buffer.column_bool(key.as_str(), *value)?;
        }

        // Add string values
        for (key, value) in &self.strings {
            buffer.symbol(key.as_str(), value)?;
        }

        // Add the timestamp
        use questdb::ingress::TimestampNanos;
        let ts_nanos = TimestampNanos::from_datetime(self.ts)
            .map_err(|e| TsError::ConnectionFailed(format!("Timestamp conversion error: {}", e)))?;
        buffer.at(ts_nanos)?;

        Ok(())
    }

    fn from_row(row: HashMap<String, serde_json::Value>) -> TsResult<Self> {
        let ts = match row.get("ts") {
            Some(serde_json::Value::String(s)) => DateTime::parse_from_rfc3339(s)
                .map_err(|e| TsError::InvalidDataType(format!("Invalid timestamp: {}", e)))?
                .with_timezone(&Utc),
            _ => return Err(TsError::FieldNotFound("ts".to_string())),
        };

        let device_id = match row.get("device_id") {
            Some(serde_json::Value::String(s)) => s.clone(),
            _ => return Err(TsError::FieldNotFound("device_id".to_string())),
        };

        let device_type = match row.get("device_type") {
            Some(serde_json::Value::String(s)) => s.clone(),
            _ => return Err(TsError::FieldNotFound("device_type".to_string())),
        };

        let room = match row.get("room") {
            Some(serde_json::Value::String(s)) => Some(s.clone()),
            Some(serde_json::Value::Null) | None => None,
            _ => {
                return Err(TsError::InvalidDataType(
                    "room must be a string".to_string(),
                ))
            }
        };

        let mut values = HashMap::new();
        let mut flags = HashMap::new();
        let mut strings = HashMap::new();

        // Process all other fields based on their type
        for (key, value) in row {
            if key == "ts" || key == "device_id" || key == "device_type" || key == "room" {
                continue;
            }

            match value {
                serde_json::Value::Number(n) => {
                    if let Some(f) = n.as_f64() {
                        values.insert(key, f);
                    }
                }
                serde_json::Value::Bool(b) => {
                    flags.insert(key, b);
                }
                serde_json::Value::String(s) => {
                    strings.insert(key, s);
                }
                _ => continue,
            }
        }

        Ok(Self {
            ts,
            device_id,
            device_type,
            values,
            flags,
            strings,
            room,
        })
    }

    fn schema() -> Vec<(&'static str, ColumnType)> {
        vec![
            ("ts", ColumnType::Timestamp),
            ("device_id", ColumnType::Symbol),
            ("device_type", ColumnType::Symbol),
            ("room", ColumnType::Symbol),
            // Note: Dynamic columns will be added at runtime based on the device type
        ]
    }
}

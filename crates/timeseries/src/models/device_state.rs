use chrono::{DateTime, Utc};
use questdb::ingress::Buffer;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::error::TsError;
use crate::model::TimeSeriesModel;
use crate::types::ColumnType;
use miette::Result;

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

impl TimeSeriesModel for DeviceStateReading {
    fn table_name() -> &'static str {
        "device_states"
    }

    fn timestamp(&self) -> DateTime<Utc> {
        self.ts
    }

    fn add_to_buffer(&self, buffer: &mut Buffer) -> Result<()> {
        buffer.clear();

        buffer
            .table(Self::table_name())
            .map_err(|e| TsError::ConnectionFailed(e.to_string()))?
            .symbol("device_id", &self.device_id)
            .map_err(|e| TsError::ConnectionFailed(e.to_string()))?
            .symbol("device_type", &self.device_type);

        // Add room if present
        if let Some(room) = &self.room {
            buffer.symbol("room", room);
        }

        // Add numeric values
        for (key, value) in &self.values {
            buffer.column_f64(key.as_str(), *value);
        }

        // Add boolean flags
        for (key, value) in &self.flags {
            buffer.column_bool(key.as_str(), *value);
        }

        // Add string values
        for (key, value) in &self.strings {
            buffer.symbol(key.as_str(), value);
        }

        // Add the timestamp
        use questdb::ingress::TimestampNanos;
        let ts_nanos = TimestampNanos::from_datetime(self.ts)
            .map_err(|e| TsError::ConnectionFailed(format!("Timestamp conversion error: {}", e)))?;
        buffer.at(ts_nanos);

        Ok(())
    }

    fn from_row(row: HashMap<String, serde_json::Value>) -> Result<Self> {
        let ts = match row.get("ts") {
            Some(serde_json::Value::String(s)) => DateTime::parse_from_rfc3339(s)
                .map_err(|e| TsError::InvalidDataType(format!("Invalid timestamp: {}", e)))?
                .with_timezone(&Utc),
            _ => return Err(TsError::FieldNotFound("ts".to_string()).into()),
        };

        let device_id = match row.get("device_id") {
            Some(serde_json::Value::String(s)) => s.clone(),
            _ => return Err(TsError::FieldNotFound("device_id".to_string()).into()),
        };

        let device_type = match row.get("device_type") {
            Some(serde_json::Value::String(s)) => s.clone(),
            _ => return Err(TsError::FieldNotFound("device_type".to_string()).into()),
        };

        let room = match row.get("room") {
            Some(serde_json::Value::String(s)) => Some(s.clone()),
            Some(serde_json::Value::Null) | None => None,
            _ => return Err(TsError::InvalidDataType("room must be a string".to_string()).into()),
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

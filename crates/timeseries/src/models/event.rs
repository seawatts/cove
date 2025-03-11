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
pub struct EventReading {
    /// Timestamp of the reading
    pub ts: DateTime<Utc>,
    /// Device ID
    pub device_id: String,
    pub event_id: String,
    pub event_type: String,
    /// Event values as key-value pairs
    pub value: serde_json::Value,
    /// Room where the device is located
    pub room: Option<String>,
}

impl TimeSeriesModel for EventReading {
    fn table_name() -> &'static str {
        "events"
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
            .symbol("event_id", &self.event_id)
            .map_err(|e| TsError::ConnectionFailed(e.to_string()))?
            .symbol("event_type", &self.event_type)
            .map_err(|e| TsError::ConnectionFailed(e.to_string()))?;

        // Add room if present
        if let Some(room) = &self.room {
            buffer
                .symbol("room", room)
                .map_err(|e| TsError::ConnectionFailed(e.to_string()))?;
        }

        // // Add numeric values
        // for (key, value) in &self.value {
        //     buffer.symbol(key.as_str(), *value)?;
        // }

        // Add the timestamp
        use questdb::ingress::TimestampNanos;
        let ts_nanos = TimestampNanos::from_datetime(self.ts)
            .map_err(|e| TsError::ConnectionFailed(format!("Timestamp conversion error: {}", e)))?;
        buffer
            .at(ts_nanos)
            .map_err(|e| TsError::ConnectionFailed(e.to_string()))?;

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

        let event_id = match row.get("event_id") {
            Some(serde_json::Value::String(s)) => s.clone(),
            _ => return Err(TsError::FieldNotFound("event_id".to_string()).into()),
        };

        let event_type = match row.get("event_type") {
            Some(serde_json::Value::String(s)) => s.clone(),
            _ => return Err(TsError::FieldNotFound("event_type".to_string()).into()),
        };

        let value = match row.get("value") {
            Some(serde_json::Value::String(s)) => serde_json::from_str(&s).unwrap(),
            _ => return Err(TsError::FieldNotFound("value".to_string()).into()),
        };

        let room = match row.get("room") {
            Some(serde_json::Value::String(s)) => Some(s.clone()),
            Some(serde_json::Value::Null) | None => None,
            _ => return Err(TsError::InvalidDataType("room must be a string".to_string()).into()),
        };

        Ok(Self {
            ts,
            device_id,
            event_id,
            event_type,
            value,
            room,
        })
    }

    fn schema() -> Vec<(&'static str, ColumnType)> {
        vec![
            ("ts", ColumnType::Timestamp),
            ("device_id", ColumnType::Symbol),
            ("event_id", ColumnType::Symbol),
            ("event_type", ColumnType::Symbol),
            ("value", ColumnType::Symbol),
            ("room", ColumnType::Symbol),
            // Note: Dynamic columns will be added at runtime based on the device type
        ]
    }
}

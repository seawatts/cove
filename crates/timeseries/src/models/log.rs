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
pub struct LogReading {
    /// Timestamp of the reading
    pub ts: DateTime<Utc>,
    /// Device ID
    pub device_id: String,
    /// State values as key-value pairs
    pub level: String,
    /// State flags as key-value pairs (for boolean states)
    pub message: String,
    /// Room where the device is located
    pub room: Option<String>,
}

impl TimeSeriesModel for LogReading {
    fn table_name() -> &'static str {
        "logs"
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
            .symbol("level", &self.level)
            .map_err(|e| TsError::ConnectionFailed(e.to_string()))?;

        // Add room if present
        if let Some(room) = &self.room {
            buffer
                .symbol("room", room)
                .map_err(|e| TsError::ConnectionFailed(e.to_string()))?;
        }

        buffer
            .symbol("message", &self.message)
            .map_err(|e| TsError::ConnectionFailed(e.to_string()))?;

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

        let level = match row.get("level") {
            Some(serde_json::Value::String(s)) => s.clone(),
            _ => return Err(TsError::FieldNotFound("level".to_string()).into()),
        };

        let message = match row.get("message") {
            Some(serde_json::Value::String(s)) => s.clone(),
            _ => return Err(TsError::FieldNotFound("message".to_string()).into()),
        };

        let room = match row.get("room") {
            Some(serde_json::Value::String(s)) => s.clone(),
            _ => return Err(TsError::FieldNotFound("room".to_string()).into()),
        };

        Ok(Self {
            ts,
            device_id,
            level,
            message,
            room: Some(room),
        })
    }

    fn schema() -> Vec<(&'static str, ColumnType)> {
        vec![
            ("ts", ColumnType::Timestamp),
            ("device_id", ColumnType::Symbol),
            ("level", ColumnType::Symbol),
            ("message", ColumnType::Symbol),
            ("room", ColumnType::Symbol),
        ]
    }
}

use chrono::{DateTime, Utc};
use questdb::ingress::Buffer;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::error::TsError;
use crate::model::TimeSeriesModel;
use crate::types::ColumnType;
use miette::Result;

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

impl TimeSeriesModel for SensorReading {
    fn table_name() -> &'static str {
        "sensor_readings"
    }

    fn timestamp(&self) -> DateTime<Utc> {
        self.ts
    }

    fn add_to_buffer(&self, buffer: &mut Buffer) -> Result<()> {
        // Clear the buffer
        buffer.clear();

        // Build the buffer using the fluent API pattern from the latest QuestDB documentation
        // Each method returns a reference to the buffer, allowing method chaining
        // We handle errors at each step
        buffer
            .table(Self::table_name())
            .map_err(|e| TsError::ConnectionFailed(e.to_string()))?
            .symbol("device_id", &self.device_id)
            .map_err(|e| TsError::ConnectionFailed(e.to_string()))?
            .symbol("sensor", &self.sensor_id)
            .map_err(|e| TsError::ConnectionFailed(e.to_string()))?;

        // Optionally add unit if present
        if let Some(unit) = &self.unit {
            buffer
                .symbol("unit", unit)
                .map_err(|e| TsError::ConnectionFailed(e.to_string()))?;
        }

        // Optionally add room if present
        if let Some(room) = &self.room {
            buffer
                .symbol("room", room)
                .map_err(|e| TsError::ConnectionFailed(e.to_string()))?;
        }

        // Add the value column
        buffer
            .column_f64("value", self.value)
            .map_err(|e| TsError::ConnectionFailed(e.to_string()))?;

        // Add the timestamp - convert from DateTime<Utc> to TimestampNanos
        use questdb::ingress::TimestampNanos;
        let ts_nanos = TimestampNanos::from_datetime(self.ts)
            .map_err(|e| TsError::ConnectionFailed(format!("Timestamp conversion error: {}", e)))?;
        buffer
            .at(ts_nanos)
            .map_err(|e| TsError::ConnectionFailed(e.to_string()))?;

        Ok(())
    }

    fn from_row(row: HashMap<String, serde_json::Value>) -> Result<Self> {
        // Extract values from the row with proper error handling
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

        let sensor_id = match row.get("sensor_id") {
            Some(serde_json::Value::String(s)) => s.clone(),
            _ => return Err(TsError::FieldNotFound("sensor".to_string()).into()),
        };

        let value = match row.get("value") {
            Some(serde_json::Value::Number(n)) => n.as_f64().unwrap_or(0.0),
            _ => return Err(TsError::FieldNotFound("value".to_string()).into()),
        };

        let unit = match row.get("unit") {
            Some(serde_json::Value::String(s)) => Some(s.clone()),
            Some(serde_json::Value::Null) => None,
            None => None,
            _ => return Err(TsError::InvalidDataType("unit must be a string".to_string()).into()),
        };

        let room = match row.get("room") {
            Some(serde_json::Value::String(s)) => Some(s.clone()),
            Some(serde_json::Value::Null) => None,
            None => None,
            _ => return Err(TsError::InvalidDataType("room must be a string".to_string()).into()),
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

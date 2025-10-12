use std::collections::HashMap;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum BusEvent {
    DeviceDiscovered {
        id: String,
        device_type: String,
        metadata: HashMap<String, String>,
    },
    DeviceUpdated {
        id: String,
        metadata: HashMap<String, String>,
    },
    DeviceRemoved {
        id: String,
    },
    SensorReading {
        ts: chrono::DateTime<chrono::Utc>,
        device_id: String,
        sensor_id: String,
        value: f64,
        unit: Option<String>,
    },
}

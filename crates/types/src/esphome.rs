use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Entity {
    BinarySensor {
        key: String,
        name: String,
        unique_id: String,
        device_class: Option<String>,
    },
    Sensor {
        key: String,
        name: String,
        unique_id: String,
        unit: Option<String>,
        device_class: Option<String>,
    },
    // Add other entity types as needed
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum StateResponse {
    BinarySensor { state: bool },
    Sensor { state: f32 },
    // Add other state types as needed
}

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
    // Add more event types as needed
}

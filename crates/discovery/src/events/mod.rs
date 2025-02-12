mod processor;

pub use processor::EventProcessor;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tokio::sync::broadcast;
use tracing::error;

use crate::types::{DeviceCategory, Protocol};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EventPriority {
    High,   // Security and safety events
    Normal, // Regular device events
    Low,    // Logging and diagnostics
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EventType {
    // State changes (e.g., light on/off, temperature reading)
    StateChange {
        device_id: String,
        state: Value,
    },

    // Commands sent to devices
    Command {
        device_id: String,
        command: String,
        params: Value,
    },

    // Alerts and notifications
    Alert {
        device_id: String,
        level: AlertLevel,
        message: String,
    },

    // Device lifecycle events
    DeviceOnline {
        device_id: String,
    },
    DeviceOffline {
        device_id: String,
    },

    // Sensor readings and measurements
    SensorReading {
        device_id: String,
        sensor_type: SensorType,
        value: Value,
        unit: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AlertLevel {
    Critical, // Immediate attention required (fire, security breach)
    Warning,  // Important but not critical (low battery)
    Info,     // Informational alerts
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SensorType {
    Temperature,
    Humidity,
    Motion,
    Light,
    Power,
    Voltage,
    Current,
    Energy,
    Battery,
    Custom(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceEvent {
    pub timestamp: DateTime<Utc>,
    pub device_id: String,
    pub protocol: Protocol,
    pub category: DeviceCategory,
    pub priority: EventPriority,
    pub event_type: EventType,
    pub raw_data: Option<Value>,
}

pub struct EventManager {
    high_priority_tx: broadcast::Sender<DeviceEvent>,
    normal_priority_tx: broadcast::Sender<DeviceEvent>,
    low_priority_tx: broadcast::Sender<DeviceEvent>,
}

impl EventManager {
    pub fn new() -> Self {
        // Create channels with reasonable buffer sizes
        let (high_priority_tx, _) = broadcast::channel(100); // Smaller buffer for high-priority
        let (normal_priority_tx, _) = broadcast::channel(1000); // Medium buffer for normal events
        let (low_priority_tx, _) = broadcast::channel(5000); // Larger buffer for low-priority

        Self {
            high_priority_tx,
            normal_priority_tx,
            low_priority_tx,
        }
    }

    pub fn subscribe_high_priority(&self) -> broadcast::Receiver<DeviceEvent> {
        self.high_priority_tx.subscribe()
    }

    pub fn subscribe_normal_priority(&self) -> broadcast::Receiver<DeviceEvent> {
        self.normal_priority_tx.subscribe()
    }

    pub fn subscribe_low_priority(&self) -> broadcast::Receiver<DeviceEvent> {
        self.low_priority_tx.subscribe()
    }

    pub fn publish_event(
        &self,
        event: DeviceEvent,
    ) -> Result<(), broadcast::error::SendError<DeviceEvent>> {
        let sender = match event.priority {
            EventPriority::High => &self.high_priority_tx,
            EventPriority::Normal => &self.normal_priority_tx,
            EventPriority::Low => &self.low_priority_tx,
        };

        match sender.send(event.clone()) {
            Ok(_) => Ok(()),
            Err(e) => {
                error!("Failed to publish event: {:?}", e);
                Err(e)
            }
        }
    }
}

// Implement Default for EventManager
impl Default for EventManager {
    fn default() -> Self {
        Self::new()
    }
}

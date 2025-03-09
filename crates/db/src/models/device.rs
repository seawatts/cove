use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::model::Model;

/// Types of devices supported by the Cove platform
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DeviceType {
    Light,
    Switch,
    Sensor,
    Thermostat,
    Lock,
    Camera,
    Speaker,
    Fan,
    Outlet,
    Other(String),
}

/// Capabilities that a device can support
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DeviceCapability {
    OnOff,
    Brightness,
    ColorTemperature,
    ColorRgb,
    Temperature,
    Humidity,
    Motion,
    Occupancy,
    ContactSensor,
    Battery,
    Lock,
    Unlock,
    AudioVolume,
    AudioPlayback,
    VideoStream,
    FanSpeed,
    Heating,
    Cooling,
    Custom(String),
}

/// Model for a device in the Cove home automation platform
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Device {
    /// Unique identifier for the device
    pub id: String,

    /// Name of the device (user-friendly)
    pub name: String,

    /// The type of device
    pub device_type: DeviceType,

    /// Optional room ID that this device belongs to
    pub room_id: Option<String>,

    /// List of capabilities this device supports
    pub capabilities: Vec<DeviceCapability>,

    /// IP address of the device, if applicable
    pub ip_address: Option<String>,

    /// MAC address of the device, if applicable
    pub mac_address: Option<String>,

    /// Protocol used to communicate with this device (e.g., "zigbee", "zwave", "wifi")
    pub protocol: Option<String>,

    /// Current state of the device as key-value pairs
    pub state: HashMap<String, serde_json::Value>,

    /// Configuration settings for the device
    pub config: HashMap<String, serde_json::Value>,

    /// Whether the device is currently online
    pub online: bool,

    /// When the device was discovered/added
    pub created_at: chrono::DateTime<chrono::Utc>,

    /// When the device was last updated
    pub updated_at: chrono::DateTime<chrono::Utc>,

    /// When the device was last seen/communicated with
    pub last_seen: Option<chrono::DateTime<chrono::Utc>>,
}

impl Model for Device {
    fn table_name() -> &'static str {
        "devices"
    }

    fn id(&self) -> String {
        self.id.clone()
    }

    fn set_id(&mut self, id: String) {
        self.id = id;
    }
}

impl Device {
    /// Create a new device with minimal information
    pub fn new(name: &str, device_type: DeviceType) -> Self {
        let now = chrono::Utc::now();
        Device {
            id: String::new(), // Will be set by Db::create
            name: name.to_string(),
            device_type,
            room_id: None,
            capabilities: Vec::new(),
            ip_address: None,
            mac_address: None,
            protocol: None,
            state: HashMap::new(),
            config: HashMap::new(),
            online: false,
            created_at: now,
            updated_at: now,
            last_seen: None,
        }
    }

    /// Add a capability to this device
    pub fn with_capability(mut self, capability: DeviceCapability) -> Self {
        self.capabilities.push(capability);
        self
    }

    /// Set the room for this device
    pub fn in_room(mut self, room_id: &str) -> Self {
        self.room_id = Some(room_id.to_string());
        self
    }

    /// Mark the device as online
    pub fn set_online(&mut self, online: bool) {
        self.online = online;
        if online {
            self.last_seen = Some(chrono::Utc::now());
        }
        self.updated_at = chrono::Utc::now();
    }

    /// Update a device state property
    pub fn update_state(&mut self, key: &str, value: serde_json::Value) {
        self.state.insert(key.to_string(), value);
        self.updated_at = chrono::Utc::now();
        self.last_seen = Some(self.updated_at);
    }
}

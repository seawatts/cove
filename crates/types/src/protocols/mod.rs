pub mod traits;

pub use traits::*;

use serde::{Deserialize, Serialize};
use strum_macros::{Display, EnumString};

/// Represents the communication protocol used by an accessory
#[derive(Debug, Clone, Copy, Serialize, Deserialize, Display, EnumString, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum Protocol {
    /// Bluetooth Low Energy
    Bluetooth,

    /// WiFi
    WiFi,

    /// Zigbee
    Zigbee,

    /// Matter
    Matter,

    /// MQTT
    MQTT,

    /// USB
    USB,

    /// Server-Sent Events
    SSE,

    /// ESPHome
    ESPHome,

    /// Generic protocol (for testing or unknown protocols)
    Generic,
}

/// Represents transport-specific connection details
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Transport {
    /// The host/address to connect to
    pub host: Option<String>,

    /// The port to connect to
    pub port: Option<u16>,

    /// Additional transport-specific configuration
    #[serde(flatten)]
    pub config: serde_json::Value,
}

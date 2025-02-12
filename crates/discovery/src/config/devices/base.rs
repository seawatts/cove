use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::config::utils::ConfigFile;

/// Device capabilities configuration
#[derive(Debug, Serialize, Deserialize, Clone, JsonSchema)]
pub struct DeviceCapabilities {
    pub brightness: Option<bool>,
    pub color: Option<bool>,
    pub color_temperature: Option<bool>,
    pub power: Option<bool>,
}

/// Device command configuration
#[derive(Debug, Serialize, Deserialize, Clone, JsonSchema)]
pub struct DeviceCommands {
    #[serde(flatten)]
    pub commands: HashMap<String, String>,
}

/// Device configuration structure
#[derive(Debug, Serialize, Deserialize, Clone, JsonSchema)]
pub struct Device {
    pub model: String,
    pub protocol: String,
    pub commands: DeviceCommands,
    pub capabilities: DeviceCapabilities,
}

impl ConfigFile for Device {}

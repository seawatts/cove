use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum HomeKitCategory {
    Other = 1,
    Bridge = 2,
    Fan = 3,
    GarageDoorOpener = 4,
    Lightbulb = 5,
    DoorLock = 6,
    Outlet = 7,
    Switch = 8,
    Thermostat = 9,
    Sensor = 10,
    SecuritySystem = 11,
    Door = 12,
    Window = 13,
    WindowCovering = 14,
    ProgrammableSwitch = 15,
    RangeExtender = 16,
    Camera = 17,
    VideoDoorbell = 18,
    AirPurifier = 19,
    AirHeater = 20,
    AirConditioner = 21,
    AirHumidifier = 22,
    AirDehumidifier = 23,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HomeKitDevice {
    pub id: String,
    pub name: String,
    pub category: HomeKitCategory,
    pub manufacturer: Option<String>,
    pub model: Option<String>,
    pub firmware_version: Option<String>,
    pub serial_number: Option<String>,
    pub services: Vec<HomeKitService>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HomeKitService {
    pub id: String,
    pub type_: String,
    pub name: String,
    pub characteristics: Vec<HomeKitCharacteristic>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HomeKitCharacteristic {
    pub id: String,
    pub type_: String,
    pub format: HomeKitCharacteristicFormat,
    pub permissions: HomeKitPermissions,
    pub value: Option<serde_json::Value>,
    pub unit: Option<String>,
    pub min_value: Option<serde_json::Value>,
    pub max_value: Option<serde_json::Value>,
    pub step_value: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HomeKitPermissions {
    pub readable: bool,
    pub writable: bool,
    pub notify: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum HomeKitCharacteristicFormat {
    Bool,
    Int,
    Float,
    String,
    Uint8,
    Uint16,
    Uint32,
    Uint64,
    Data,
    Tlv8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HomeKitDeviceConfig {
    pub name: String,
    pub room: Option<String>,
    pub auto_notify: bool,
    pub service_configs: HashMap<String, HomeKitServiceConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HomeKitServiceConfig {
    pub name: String,
    pub notify_characteristics: Vec<String>,
    pub custom_settings: HashMap<String, serde_json::Value>,
}

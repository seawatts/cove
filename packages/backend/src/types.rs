use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use specta::Type;
use strum_macros::{Display, EnumString};

#[derive(Debug, Clone, Display, Copy, Serialize, Deserialize, EnumString, PartialEq, Type)]
pub enum Protocol {
    Bluetooth,
    Generic,
    Matter,
    MQTT,
    WiFi,
    Zigbee,
    Usb,
    SSE,
}

#[derive(Debug, Clone, Display, Serialize, Deserialize, PartialEq, Type)]
pub enum DeviceStatus {
    Online,
    Offline,
    Unknown,
}

#[derive(Debug, Clone, Display, Serialize, Deserialize, PartialEq, Type)]
pub enum DeviceCategory {
    Light,
    Switch,
    Sensor,
    Media,
    Speaker,
    Display,
    Climate,
    Security,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct DeviceCapabilities {
    pub can_power: bool,
    pub can_toggle: bool,
    pub can_dim: bool,
    pub can_color: bool,
    pub can_volume: bool,
    pub can_play: bool,
    pub can_temperature: bool,
    pub can_humidity: bool,
    pub can_motion: bool,
    pub can_occupancy: bool,
    pub can_battery: bool,
}

impl Default for DeviceCapabilities {
    fn default() -> Self {
        Self {
            can_power: false,
            can_toggle: false,
            can_dim: false,
            can_color: false,
            can_volume: false,
            can_play: false,
            can_temperature: false,
            can_humidity: false,
            can_motion: false,
            can_occupancy: false,
            can_battery: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, Type)]
pub struct Location {
    pub room: Option<String>,
    pub floor: Option<String>,
    pub zone: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct NetworkInfo {
    pub addresses: Vec<String>,
    pub primary_address: Option<String>,
    pub port: Option<u16>,
    pub hostname: Option<String>,
    pub mac_address: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, Type)]
pub struct DeviceMetadata {
    pub manufacturer: Option<String>,
    pub model: Option<String>,
    pub firmware_version: Option<String>,
    pub hardware_version: Option<String>,
    pub icon_url: Option<String>,
}

// Base device struct that implements common functionality
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct BaseDevice {
    pub id: String,
    pub r#type: String,
    pub friendly_name: String,
    pub description: String,
    pub protocol: Protocol,
    pub status: DeviceStatus,
    pub categories: Vec<DeviceCategory>,
    pub capabilities: DeviceCapabilities,
    pub location: Location,
    pub metadata: DeviceMetadata,
    pub network_info: Option<NetworkInfo>,
    pub created: DateTime<Utc>,
    pub updated: DateTime<Utc>,
    pub last_online: Option<DateTime<Utc>>,
    pub raw_details: Value,
}

// Protocol-specific device types
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct WiFiDevice {
    pub base: BaseDevice,
    pub mdns_service_type: String,
    pub mdns_properties: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct BluetoothDevice {
    pub base: BaseDevice,
    pub signal_strength: Option<i32>,
    pub services: Vec<String>,
    pub is_connectable: bool,
    pub is_paired: bool,
}

impl AsRef<BaseDevice> for BluetoothDevice {
    fn as_ref(&self) -> &BaseDevice {
        &self.base
    }
}

impl AsRef<BaseDevice> for WiFiDevice {
    fn as_ref(&self) -> &BaseDevice {
        &self.base
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct ZigbeeDevice {
    pub base: BaseDevice,
    pub ieee_address: String,
    pub network_address: u16,
    pub supported_clusters: Vec<String>,
    pub link_quality: Option<u8>,
    pub route: Option<Vec<u16>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct MatterDevice {
    pub base: BaseDevice,
    pub node_id: u64,
    pub vendor_id: u16,
    pub product_id: u16,
    pub supported_clusters: Vec<String>,
}

// Helper function to convert legacy Device to new WiFiDevice
impl From<Device> for WiFiDevice {
    fn from(device: Device) -> Self {
        let network_info = NetworkInfo {
            addresses: device.raw_details["addresses"]
                .as_array()
                .map(|arr| {
                    arr.iter()
                        .filter_map(|v| v.as_str().map(String::from))
                        .collect()
                })
                .unwrap_or_default(),
            primary_address: device.raw_details["ip_address"].as_str().map(String::from),
            port: device.raw_details["port"].as_u64().map(|p| p as u16),
            hostname: device.raw_details["hostname"].as_str().map(String::from),
            mac_address: None,
        };

        let metadata = DeviceMetadata {
            manufacturer: device.raw_details["manufacturer"]
                .as_str()
                .map(String::from),
            model: device.raw_details["model"].as_str().map(String::from),
            firmware_version: device.raw_details["firmware_version"]
                .as_str()
                .map(String::from),
            hardware_version: None,
            icon_url: device.raw_details["icon_url"].as_str().map(String::from),
        };

        let location = Location {
            room: device.raw_details["room"].as_str().map(String::from),
            floor: None,
            zone: None,
        };

        let mut capabilities = DeviceCapabilities::default();
        if let Some(caps) = device.raw_details["capabilities"].as_object() {
            capabilities.can_power = caps["can_power"].as_bool().unwrap_or(false);
            capabilities.can_volume = caps["can_volume"].as_bool().unwrap_or(false);
            capabilities.can_play = caps["can_play"].as_bool().unwrap_or(false);
        }

        let categories = device.raw_details["categories"]
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| match v.as_str() {
                        Some("media") => Some(DeviceCategory::Media),
                        Some("display") => Some(DeviceCategory::Display),
                        Some("audio") | Some("speaker") => Some(DeviceCategory::Speaker),
                        Some("lighting") => Some(DeviceCategory::Light),
                        _ => Some(DeviceCategory::Unknown),
                    })
                    .collect()
            })
            .unwrap_or_else(|| vec![DeviceCategory::Unknown]);

        let mdns_service_type = device.raw_details["service_type"]
            .as_str()
            .unwrap_or("")
            .to_string();
        let mdns_properties = device.raw_details["text_records"].clone();

        WiFiDevice {
            base: BaseDevice {
                id: device.id,
                r#type: device.r#type,
                friendly_name: device.friendly_name,
                description: device.description,
                protocol: device.protocol,
                status: device.status,
                categories,
                capabilities,
                location,
                metadata,
                network_info: Some(network_info),
                created: device.created,
                updated: device.updated,
                last_online: device.last_online,
                raw_details: device.raw_details,
            },
            mdns_service_type,
            mdns_properties,
        }
    }
}

// Legacy Device struct that implements DeviceProperties
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct Device {
    pub id: String,
    pub r#type: String,
    pub friendly_name: String,
    pub description: String,
    pub protocol: Protocol,
    pub status: DeviceStatus,
    pub categories: Vec<DeviceCategory>,
    pub capabilities: DeviceCapabilities,
    pub location: Location,
    pub metadata: DeviceMetadata,
    pub network_info: Option<NetworkInfo>,
    pub created: DateTime<Utc>,
    pub updated: DateTime<Utc>,
    pub last_online: Option<DateTime<Utc>>,
    pub raw_details: Value,
}

impl From<WiFiDevice> for Device {
    fn from(device: WiFiDevice) -> Self {
        Device {
            id: device.base.id,
            r#type: device.base.r#type,
            friendly_name: device.base.friendly_name,
            description: device.base.description,
            protocol: device.base.protocol,
            status: device.base.status,
            categories: device.base.categories,
            capabilities: device.base.capabilities,
            location: device.base.location,
            metadata: device.base.metadata,
            network_info: device.base.network_info,
            created: device.base.created,
            updated: device.base.updated,
            last_online: device.base.last_online,
            raw_details: device.base.raw_details,
        }
    }
}

impl From<BluetoothDevice> for Device {
    fn from(device: BluetoothDevice) -> Self {
        Device {
            id: device.base.id,
            r#type: device.base.r#type,
            friendly_name: device.base.friendly_name,
            description: device.base.description,
            protocol: device.base.protocol,
            status: device.base.status,
            categories: device.base.categories,
            capabilities: device.base.capabilities,
            location: device.base.location,
            metadata: device.base.metadata,
            network_info: device.base.network_info,
            created: device.base.created,
            updated: device.base.updated,
            last_online: device.base.last_online,
            raw_details: device.base.raw_details,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct UsbDevice {
    #[serde(flatten)]
    pub base: BaseDevice,
    pub vendor_id: u16,
    pub product_id: u16,
    pub bus_number: u8,
    pub address: u8,
}

impl AsRef<BaseDevice> for UsbDevice {
    fn as_ref(&self) -> &BaseDevice {
        &self.base
    }
}

impl From<UsbDevice> for Device {
    fn from(device: UsbDevice) -> Self {
        Self {
            id: device.base.id,
            r#type: device.base.r#type,
            friendly_name: device.base.friendly_name,
            description: device.base.description,
            protocol: device.base.protocol,
            status: device.base.status,
            categories: device.base.categories,
            capabilities: device.base.capabilities,
            location: device.base.location,
            metadata: device.base.metadata,
            network_info: device.base.network_info,
            created: device.base.created,
            updated: device.base.updated,
            last_online: device.base.last_online,
            raw_details: device.base.raw_details,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct MqttDevice {
    #[serde(flatten)]
    pub base: BaseDevice,
    pub topic: String,
}

impl AsRef<BaseDevice> for MqttDevice {
    fn as_ref(&self) -> &BaseDevice {
        &self.base
    }
}

impl From<MqttDevice> for Device {
    fn from(device: MqttDevice) -> Self {
        Self {
            id: device.base.id,
            r#type: device.base.r#type,
            friendly_name: device.base.friendly_name,
            description: device.base.description,
            protocol: device.base.protocol,
            status: device.base.status,
            categories: device.base.categories,
            capabilities: device.base.capabilities,
            location: device.base.location,
            metadata: device.base.metadata,
            network_info: device.base.network_info,
            created: device.base.created,
            updated: device.base.updated,
            last_online: device.base.last_online,
            raw_details: device.base.raw_details,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct SseDevice {
    pub base: BaseDevice,
    pub endpoint: String,
}

impl AsRef<BaseDevice> for SseDevice {
    fn as_ref(&self) -> &BaseDevice {
        &self.base
    }
}

impl From<SseDevice> for Device {
    fn from(device: SseDevice) -> Self {
        Device {
            id: device.base.id,
            created: device.base.created,
            updated: device.base.updated,
            last_online: device.base.last_online,
            raw_details: device.base.raw_details,
            r#type: device.base.r#type,
            friendly_name: device.base.friendly_name,
            description: device.base.description,
            protocol: device.base.protocol,
            status: device.base.status,
            categories: device.base.categories,
            capabilities: device.base.capabilities,
            location: device.base.location,
            metadata: device.base.metadata,
            network_info: device.base.network_info,
        }
    }
}

#[derive(Debug, Clone)]
pub enum DeviceEvent {
    DeviceUpdated(Device),
    DeviceRemoved(String),
    NetworkOffline,
}

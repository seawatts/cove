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
    ESPHome,
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

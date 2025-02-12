use miette::Result;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, warn};

use crate::types::Device;

#[derive(Clone)]
pub struct DeviceRegistry {
    devices: Arc<RwLock<HashMap<String, Device>>>,
}

impl DeviceRegistry {
    pub fn new() -> Self {
        Self {
            devices: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn register_device<D>(&self, device: D) -> Result<()>
    where
        D: Into<Device>,
    {
        let device: Device = device.into();
        let device_id = device.id.clone();

        let mut devices = self.devices.write().await;
        if devices.insert(device_id.clone(), device).is_some() {
            info!("Updated existing device: {}", device_id);
        } else {
            info!("Registered new device: {}", device_id);
        }

        Ok(())
    }

    pub async fn unregister_device(&self, device_id: &str) -> Result<()> {
        let mut devices = self.devices.write().await;
        if devices.remove(device_id).is_some() {
            info!("Unregistered device: {}", device_id);
        } else {
            warn!("Attempted to unregister non-existent device: {}", device_id);
        }
        Ok(())
    }

    pub async fn get_device(&self, device_id: &str) -> Option<Device> {
        let devices = self.devices.read().await;
        devices.get(device_id).cloned()
    }

    pub async fn get_all_devices(&self) -> Vec<Device> {
        let devices = self.devices.read().await;
        devices.values().cloned().collect()
    }

    pub async fn update_device_status<F, T>(&self, device_id: &str, update_fn: F) -> Result<()>
    where
        F: FnOnce(&mut Device) -> Result<T>,
    {
        let mut devices = self.devices.write().await;

        if let Some(device) = devices.get_mut(device_id) {
            update_fn(device)?;
            info!("Updated device status: {}", device_id);
        } else {
            warn!("Attempted to update non-existent device: {}", device_id);
        }

        Ok(())
    }
}

impl Default for DeviceRegistry {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{DeviceMetadata, DeviceStatus, Location, Protocol};

    #[tokio::test]
    async fn test_device_registry() -> Result<()> {
        let registry = DeviceRegistry::new();
        let device = Device {
            id: "test_device".to_string(),
            r#type: "test".to_string(),
            friendly_name: "Test Device".to_string(),
            description: "Test device for unit tests".to_string(),
            protocol: Protocol::WiFi,
            status: DeviceStatus::Online,
            categories: vec![],
            capabilities: Default::default(),
            location: Location {
                room: None,
                floor: None,
                zone: None,
            },
            metadata: DeviceMetadata {
                manufacturer: None,
                model: None,
                firmware_version: None,
                hardware_version: None,
                icon_url: None,
            },
            network_info: None,
            created: chrono::Utc::now(),
            updated: chrono::Utc::now(),
            last_online: None,
            raw_details: serde_json::json!({}),
        };

        // Test registration
        registry.register_device(device.clone()).await?;
        assert_eq!(registry.get_all_devices().await.len(), 1);

        // Test retrieval
        let retrieved = registry.get_device("test_device").await.unwrap();
        assert_eq!(retrieved.id, "test_device");

        // Test update
        registry
            .update_device_status("test_device", |device| {
                device.status = DeviceStatus::Offline;
                Ok(())
            })
            .await?;

        let updated = registry.get_device("test_device").await.unwrap();
        assert_eq!(updated.status, DeviceStatus::Offline);

        // Test unregistration
        registry.unregister_device("test_device").await?;
        assert_eq!(registry.get_all_devices().await.len(), 0);

        Ok(())
    }
}

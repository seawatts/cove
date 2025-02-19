use async_trait::async_trait;
use bus::EventBus;
use miette::Result;
use std::sync::Arc;
use types::{
    events::BusEvent,
    system_service::{Service, ServiceHandle},
};

mod registry;
pub use registry::DeviceRegistry;

pub struct RegistryService {
    event_bus: Arc<EventBus>,
    device_registry: Arc<DeviceRegistry>,
    handle: ServiceHandle,
}

impl RegistryService {
    pub fn new(event_bus: Arc<EventBus>) -> Self {
        Self {
            event_bus,
            device_registry: Arc::new(DeviceRegistry::new()),
            handle: ServiceHandle::new(),
        }
    }

    async fn handle_bus_events(&self) -> Result<()> {
        let mut rx = self.event_bus.subscribe();

        while let Ok(event) = rx.recv().await {
            match event {
                BusEvent::DeviceDiscovered {
                    id,
                    device_type,
                    metadata,
                } => {
                    // Convert the event into a device and register it
                    // let device = types::Device {
                    //     id: id.clone(),
                    //     r#type: device_type,
                    //     friendly_name: metadata
                    //         .get("friendly_name")
                    //         .cloned()
                    //         .unwrap_or_else(|| id.clone()),
                    //     description: metadata.get("description").cloned().unwrap_or_default(),
                    //     protocol: types::Protocol::Generic, // Set based on metadata
                    //     status: types::DeviceStatus::Online,
                    //     categories: vec![], // Set based on metadata
                    //     capabilities: types::DeviceCapabilities::default(),
                    //     location: types::Location::default(),
                    //     metadata: types::DeviceMetadata::default(),
                    //     network_info: None,
                    //     created: chrono::Utc::now(),
                    //     updated: chrono::Utc::now(),
                    //     last_online: Some(chrono::Utc::now()),
                    //     raw_details: serde_json::json!(metadata),
                    // };

                    // self.device_registry.register_device(device).await?;
                }
                BusEvent::DeviceUpdated { id, metadata } => {
                    if let Some(mut device) = self.device_registry.get_device(&id).await {
                        // device.raw_details = serde_json::json!(metadata);
                        // device.updated = chrono::Utc::now();
                        // device.last_online = Some(chrono::Utc::now());
                        self.device_registry.register_device(device).await?;
                    }
                }
                BusEvent::DeviceRemoved { id } => {
                    self.device_registry.unregister_device(&id).await?;
                }
            }
        }

        Ok(())
    }
}

#[async_trait]
impl Service for RegistryService {
    async fn init(&self) -> Result<()> {
        tracing::info!("Registry service initialized");
        Ok(())
    }

    async fn run(&self) -> Result<()> {
        self.handle_bus_events().await
    }

    fn handle(&self) -> Option<&ServiceHandle> {
        Some(&self.handle)
    }
}

impl Clone for RegistryService {
    fn clone(&self) -> Self {
        Self {
            event_bus: self.event_bus.clone(),
            device_registry: self.device_registry.clone(),
            handle: ServiceHandle::new(),
        }
    }
}

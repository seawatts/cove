use async_trait::async_trait;
use bus::EventBus;
use miette::Result;
use std::sync::Arc;
use tracing::{error, info};
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
}

#[async_trait]
impl Service for RegistryService {
    async fn init(&self) -> Result<()> {
        info!("Registry service initialized");
        Ok(())
    }

    async fn run(&self) -> Result<()> {
        info!("Starting to handle bus events...");
        let mut rx = self.event_bus.subscribe().await;
        info!("Successfully subscribed to event bus");

        loop {
            tokio::select! {
                result = rx.recv() => {
                    match result {
                        Ok(event) => {
                            info!("Received event: {:?}", event);
                            match event {
                                BusEvent::DeviceDiscovered {
                                    id,
                                    device_type,
                                    metadata,
                                } => {
                                    info!("Device discovered: {}", id);

                                    // First, save to database
                                    let db_device = db::Device::new(
                                        &metadata
                                            .get("friendly_name")
                                            .cloned()
                                            .unwrap_or_else(|| id.clone()),
                                        match device_type.as_str() {
                                            "light" => db::DeviceType::Light,
                                            "switch" => db::DeviceType::Switch,
                                            "sensor" => db::DeviceType::Sensor,
                                            "thermostat" => db::DeviceType::Thermostat,
                                            "camera" => db::DeviceType::Camera,
                                            _ => db::DeviceType::Other(device_type.clone()),
                                        }
                                    )
                                    .with_capability(db::DeviceCapability::OnOff);

                                    match db::Db::create(db_device) {
                                        Ok(created_device) => {
                                            info!("Device registered in database with ID: {}", created_device.id);

                                            // Now register in memory
                                            let device_kind = match device_type.as_str() {
                                                "light" => types::devices::DeviceKind::Light,
                                                "switch" => types::devices::DeviceKind::Switch,
                                                "sensor" => types::devices::DeviceKind::Sensor,
                                                "camera" => types::devices::DeviceKind::Camera,
                                                "climate" => types::devices::DeviceKind::Climate,
                                                "media" => types::devices::DeviceKind::Media,
                                                "speaker" => types::devices::DeviceKind::Speaker,
                                                "display" => types::devices::DeviceKind::Display,
                                                "security" => types::devices::DeviceKind::Security,
                                                _ => types::devices::DeviceKind::Other,
                                            };

                                            let registry_device = types::devices::Device {
                                                id: id.clone(),
                                                kind: device_kind,
                                                capabilities: vec![], // Fill with appropriate capabilities
                                            };

                                            if let Err(err) = self.device_registry.register_device(registry_device).await {
                                                error!("Failed to register device in memory: {}", err);
                                            }
                                        },
                                        Err(err) => {
                                            error!("Failed to register device in database: {}", err);
                                        }
                                    }
                                }
                                BusEvent::DeviceUpdated { id, metadata } => {
                                    if let Some(device) = self.device_registry.get_device(&id).await {
                                        // device.raw_details = serde_json::json!(metadata);
                                        // device.updated = chrono::Utc::now();
                                        // device.last_online = Some(chrono::Utc::now());
                                        self.device_registry.register_device(device).await?;
                                    }
                                }
                                BusEvent::DeviceRemoved { id } => {
                                    self.device_registry.unregister_device(&id).await?;
                                }
                                BusEvent::SensorReading {
                                    ts,
                                    device_id,
                                    sensor_id,
                                    value,
                                    unit,
                                } => {
                                    if let Some(device) = self.device_registry.get_device(&device_id).await {
                                        // device.update_sensor_reading(sensor_id, value, unit).await?;
                                    }
                                }
                            }
                        }
                        Err(e) => {
                            error!("Error receiving event: {}", e);
                            // Resubscribe if we lost connection
                            rx = self.event_bus.subscribe().await;
                            info!("Resubscribed to event bus");
                        }
                    }
                }
                _ = self.handle.wait_for_cancel() => {
                    break;
                }
            }
        }

        Ok(())
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
            handle: self.handle.clone(),
        }
    }
}

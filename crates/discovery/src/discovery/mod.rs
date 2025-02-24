pub mod error;

use bus::EventBus;
use miette::Result;
use std::sync::Arc;
use tokio::sync::broadcast;
use tracing::{error, info};
use types::{BusEvent, Device, DeviceKind};

use async_trait::async_trait;
use std::collections::HashMap;

use crate::protocol::WiFiProtocol;

#[async_trait]
pub trait DeviceProtocol: Send + Sync + 'static {
    fn protocol_name(&self) -> &'static str;
    fn get_instance() -> Arc<Self>
    where
        Self: Sized;
    async fn start_discovery(&self, event_bus: EventBus) -> Result<()>;
    async fn stop_discovery(&self) -> Result<()>;
}

#[derive(Clone)]
pub struct DeviceDiscovery {
    shutdown: broadcast::Sender<()>,
    event_bus: Arc<EventBus>,
    protocols: Vec<Arc<dyn DeviceProtocol>>,
}

impl DeviceDiscovery {
    pub fn new(event_bus: Arc<EventBus>) -> Self {
        let (shutdown, _) = broadcast::channel(1);

        // Initialize all protocols
        let protocols: Vec<Arc<dyn DeviceProtocol>> = vec![
            WiFiProtocol::get_instance(),
            // BluetoothProtocol::get_instance(),
            // Arc::new(UsbProtocol::get_instance()),
            // Arc::new(MqttProtocol::get_instance()),
        ];

        Self {
            shutdown,
            event_bus,
            protocols,
        }
    }

    pub fn shutdown_signal(&self) -> broadcast::Receiver<()> {
        self.shutdown.subscribe()
    }

    async fn start_protocol(protocol: Arc<dyn DeviceProtocol>, event_bus: EventBus) {
        let protocol_name = protocol.protocol_name();
        tokio::spawn(async move {
            if let Err(e) = protocol.start_discovery(event_bus).await {
                error!("{} discovery error: {:?}", protocol_name, e);
            }
        });
    }

    fn create_device_from_metadata(
        id: String,
        device_type: String,
        metadata: HashMap<String, String>,
    ) -> Device {
        Device {
            id: id.clone(),
            kind: DeviceKind::Other,
            capabilities: vec![],
            // r#type: device_type,
            // friendly_name: metadata.get("friendly_name").cloned().unwrap_or_else(|| id),
            // description: metadata.get("description").cloned().unwrap_or_default(),
            // protocol: metadata
            //     .get("protocol")
            //     .and_then(|p| p.parse().ok())
            //     .unwrap_or(Protocol::Generic),
            // status: DeviceStatus::Online,
            // categories: vec![DeviceCategory::Unknown], // Can be updated based on metadata
            // capabilities: DeviceCapabilities::default(),
            // location: Location::default(),
            // metadata: DeviceMetadata {
            //     manufacturer: metadata.get("manufacturer").cloned(),
            //     model: metadata.get("model").cloned(),
            //     firmware_version: metadata.get("firmware_version").cloned(),
            //     hardware_version: metadata.get("hardware_version").cloned(),
            //     icon_url: metadata.get("icon_url").cloned(),
            // },
            // network_info: None, // Can be populated if network info is in metadata
            // created: Utc::now(),
            // updated: Utc::now(),
            // last_online: Some(Utc::now()),
            // raw_details: serde_json::json!(metadata),
        }
    }

    pub async fn start_continuous_discovery(&self) -> Result<()> {
        info!("Starting device discovery...");

        // Start all protocol monitoring
        for protocol in &self.protocols {
            Self::start_protocol(protocol.clone(), (*self.event_bus).clone()).await;
        }

        // Process device events
        let mut shutdown = self.shutdown.subscribe();

        loop {
            tokio::select! {
                _ = shutdown.recv() => {
                    info!("Stopping device discovery...");
                    // Stop all protocols
                    for protocol in &self.protocols {
                        if let Err(e) = protocol.stop_discovery().await {
                            error!("Failed to stop {} protocol: {:?}", protocol.protocol_name(), e);
                        }
                    }
                    break;
                }
            }
        }

        Ok(())
    }

    pub fn trigger_shutdown(&self) {
        let _ = self.shutdown.send(());
    }

    // Helper method to publish device discovery events
    pub async fn publish_device_discovered(
        &self,
        id: String,
        device_type: String,
        metadata: HashMap<String, String>,
    ) {
        let _ = self.event_bus.publish(BusEvent::DeviceDiscovered {
            id,
            device_type,
            metadata,
        });
    }

    // Helper method to publish device update events
    pub async fn publish_device_updated(&self, id: String, metadata: HashMap<String, String>) {
        let _ = self
            .event_bus
            .publish(BusEvent::DeviceUpdated { id, metadata });
    }

    // Helper method to publish device removal events
    pub async fn publish_device_removed(&self, id: String) {
        let _ = self.event_bus.publish(BusEvent::DeviceRemoved { id });
    }
}

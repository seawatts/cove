pub mod error;

use miette::Result;
use std::sync::Arc;
use tokio::sync::broadcast;
use tracing::{error, info};

use crate::{
    device::DeviceRegistry,
    events::EventManager,
    protocol::{
        bluetooth::BluetoothProtocol, mqtt::MqttProtocol, usb::UsbProtocol, wifi::WiFiProtocol,
    },
    types::{DeviceEvent, DeviceStatus},
};
use async_trait::async_trait;

#[async_trait]
pub trait DeviceProtocol: Send + Sync + 'static {
    fn protocol_name(&self) -> &'static str;
    fn get_instance() -> Arc<Self>
    where
        Self: Sized;
    async fn start_discovery(&self, device_events: broadcast::Sender<DeviceEvent>) -> Result<()>;
}

#[derive(Clone)]
pub struct DeviceDiscovery {
    registry: Arc<DeviceRegistry>,
    event_manager: Arc<EventManager>,
    shutdown: broadcast::Sender<()>,
    device_events: broadcast::Sender<DeviceEvent>,
    protocols: Vec<Arc<dyn DeviceProtocol>>,
}

impl DeviceDiscovery {
    pub fn new(registry: Arc<DeviceRegistry>, event_manager: Arc<EventManager>) -> Self {
        let (shutdown, _) = broadcast::channel(1);
        let (device_events, _) = broadcast::channel(100);

        // Initialize all protocols
        let protocols: Vec<Arc<dyn DeviceProtocol>> = vec![
            WiFiProtocol::get_instance(),
            BluetoothProtocol::get_instance(),
            Arc::new(
                UsbProtocol::new(event_manager.clone()).expect("Failed to initialize UsbProtocol"),
            ),
            Arc::new(
                MqttProtocol::new(event_manager.clone())
                    .expect("Failed to initialize MqttProtocol"),
            ),
        ];

        Self {
            registry,
            event_manager,
            shutdown,
            device_events,
            protocols,
        }
    }

    pub fn shutdown_signal(&self) -> broadcast::Receiver<()> {
        self.shutdown.subscribe()
    }

    async fn start_protocol(
        protocol: Arc<dyn DeviceProtocol>,
        device_events: broadcast::Sender<DeviceEvent>,
    ) {
        let protocol_name = protocol.protocol_name();
        tokio::spawn(async move {
            if let Err(e) = protocol.start_discovery(device_events).await {
                error!("{} discovery error: {:?}", protocol_name, e);
            }
        });
    }

    pub async fn start_continuous_discovery(&self) -> Result<()> {
        info!("Starting device discovery...");

        // Start all protocol monitoring
        for protocol in &self.protocols {
            Self::start_protocol(protocol.clone(), self.device_events.clone()).await;
        }

        // Process device events
        let mut shutdown = self.shutdown.subscribe();
        let mut device_events = self.device_events.subscribe();

        loop {
            tokio::select! {
                Ok(event) = device_events.recv() => {
                    match event {
                        DeviceEvent::DeviceUpdated(device) => {
                            if let Err(e) = self.registry.register_device(device).await {
                                error!("Failed to register device: {:?}", e);
                            }
                        }
                        DeviceEvent::DeviceRemoved(device_id) => {
                            if let Err(e) = self.registry.unregister_device(&device_id).await {
                                error!("Failed to unregister device: {:?}", e);
                            }
                        }
                        DeviceEvent::NetworkOffline => {
                            info!("Network went offline, marking all devices as offline");
                            // Get all devices and mark them as offline
                            let devices = self.registry.get_all_devices().await;
                            for mut device in devices {
                                device.status = DeviceStatus::Offline;
                                if let Err(e) = self.registry.register_device(device).await {
                                    error!("Failed to update device status: {:?}", e);
                                }
                            }
                        }
                    }
                }
                _ = shutdown.recv() => {
                    info!("Stopping device discovery...");
                    break;
                }
            }
        }

        Ok(())
    }

    pub fn trigger_shutdown(&self) {
        let _ = self.shutdown.send(());
    }
}

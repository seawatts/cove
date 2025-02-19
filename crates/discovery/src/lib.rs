// use crate::discovery::DeviceDiscovery;
// use crate::events::EventManager;
use async_trait::async_trait;
use bus::EventBus;
use miette::Result;
use std::sync::Arc;
use types::{
    // events::BusEvent,
    system_service::{Service, ServiceHandle},
};

pub struct DiscoveryService {
    event_bus: Arc<EventBus>,
    // device_discovery: Arc<DeviceDiscovery>,
    handle: ServiceHandle,
}

impl DiscoveryService {
    pub fn new(event_bus: Arc<EventBus>) -> Self {
        // let event_manager = Arc::new(EventManager::new());
        // let device_discovery = Arc::new(DeviceDiscovery::new(event_manager.clone()));

        Self {
            event_bus,
            // device_discovery,
            handle: ServiceHandle::new(),
        }
    }

    async fn handle_device_events(&self) -> Result<()> {
        // let mut rx = self.device_discovery.subscribe_device_events();

        // while let Ok(event) = rx.recv().await {
        //     match event {
        //         BusEvent::DeviceUpdated(device) => {
        //             self.event_bus.publish(BusEvent::DeviceDiscovered {
        //                 id: device.id.clone(),
        //                 device_type: device.r#type.clone(),
        //                 metadata: device
        //                     .raw_details
        //                     .as_object()
        //                     .map(|obj| {
        //                         obj.iter()
        //                             .map(|(k, v)| (k.clone(), v.to_string()))
        //                             .collect()
        //                     })
        //                     .unwrap_or_default(),
        //             })?;
        //         } // crate::types::DeviceEvent::DeviceRemoved(id) => {
        //           //     self.event_bus
        //           //         .publish(BusEvent::DeviceRemoved { id: id.clone() })?;
        //           // }
        //           // crate::types::DeviceEvent::NetworkOffline => {
        //           // Handle network offline event if needed
        //           // }
        //     }
        // }

        Ok(())
    }
}

#[async_trait]
impl Service for DiscoveryService {
    async fn init(&self) -> Result<()> {
        Ok(())
    }

    async fn run(&self) -> Result<()> {
        // Start device discovery in the background
        // let discovery = self.device_discovery.clone();
        // tokio::spawn(async move {
        //     if let Err(e) = discovery.start_continuous_discovery().await {
        //         tracing::error!("Device discovery error: {:?}", e);
        //     }
        // });

        // Handle device events and publish to event bus
        self.handle_device_events().await?;
        Ok(())
    }

    async fn cleanup(&self) -> Result<()> {
        Ok(())
    }

    fn handle(&self) -> Option<&ServiceHandle> {
        Some(&self.handle)
    }
}

impl Clone for DiscoveryService {
    fn clone(&self) -> Self {
        Self {
            event_bus: self.event_bus.clone(),
            // device_discovery: self.device_discovery.clone(),
            handle: ServiceHandle::new(),
        }
    }
}

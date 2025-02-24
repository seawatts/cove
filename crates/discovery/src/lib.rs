use discovery::DeviceDiscovery;
// use crate::device::DeviceRegistry;
// use crate::types::{Device, DeviceEvent};
use ::types::{Service, ServiceHandle};
use async_trait::async_trait;
use bus::EventBus;
use miette::Result;
use std::sync::Arc;

// pub mod device;
pub mod discovery;
// pub mod error;
// pub mod events;
pub mod protocol;
// pub mod types;

pub struct DiscoveryService {
    event_bus: Arc<EventBus>,
    device_discovery: DeviceDiscovery,
    handle: ServiceHandle,
}

impl DiscoveryService {
    pub fn new(event_bus: Arc<EventBus>) -> Self {
        Self {
            event_bus: event_bus.clone(),
            device_discovery: DeviceDiscovery::new(event_bus.clone()),
            handle: ServiceHandle::new(),
        }
    }

    async fn handle_device_events(&self) -> Result<()> {
        // while let Ok(event) = rx.recv().await {
        //     match event {
        //         DeviceEvent::DeviceUpdated(device) => {
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
        //         }
        //         DeviceEvent::DeviceRemoved(id) => {
        //             self.event_bus
        //                 .publish(BusEvent::DeviceRemoved { id: id.clone() })?;
        //         }
        //         DeviceEvent::NetworkOffline => {
        //             // When network is offline, we don't need to send any specific event
        //             // The device status updates will be handled by the individual protocols
        //             tracing::warn!(
        //                 "Network went offline, devices will update their status accordingly"
        //             );
        //         }
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
        // Start device discovery and wait for completion or shutdown
        let discovery = self.device_discovery.clone();
        tokio::select! {
            _ = self.handle.wait_for_cancel() => {
                self.device_discovery.trigger_shutdown();
                Ok(())
            }
            result = discovery.start_continuous_discovery() => {
                if let Err(e) = result {
                    tracing::error!("Device discovery error: {:?}", e);
                }
                Ok(())
            }
        }
    }

    async fn cleanup(&self) -> Result<()> {
        self.device_discovery.trigger_shutdown();
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
            device_discovery: self.device_discovery.clone(),
            handle: self.handle.clone(),
        }
    }
}

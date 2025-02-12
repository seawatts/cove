use std::{sync::Arc, time::Duration};

use async_trait::async_trait;
use chrono::Utc;
use miette::Result;
use once_cell::sync::Lazy;
use rusb::{Context, UsbContext};
use serde_json::json;
use tokio::sync::broadcast;
use tracing::{error, info};

use crate::{
    discovery::DeviceProtocol,
    events::{DeviceEvent, EventManager, EventPriority, EventType},
    types::{
        BaseDevice, DeviceCapabilities, DeviceCategory, DeviceEvent as DiscoveryDeviceEvent,
        DeviceMetadata, DeviceStatus, Location, Protocol, UsbDevice,
    },
};

pub static INSTANCE: Lazy<Arc<UsbProtocol>> = Lazy::new(|| {
    Arc::new(
        UsbProtocol::new(Arc::new(EventManager::new())).expect("Failed to initialize UsbProtocol"),
    )
});

#[derive(Clone)]
pub struct UsbProtocol {
    event_manager: Arc<EventManager>,
}

impl UsbProtocol {
    pub fn new(event_manager: Arc<EventManager>) -> Result<Self> {
        Ok(Self { event_manager })
    }

    pub fn get_instance() -> Arc<UsbProtocol> {
        INSTANCE.clone()
    }

    async fn monitor_usb(&self, device_tx: broadcast::Sender<DiscoveryDeviceEvent>) {
        info!("Starting USB device monitoring...");

        loop {
            let device_tx_clone = device_tx.clone();
            let event_manager = self.event_manager.clone();

            if let Err(e) = tokio::task::spawn_blocking(move || {
                if let Ok(context) = Context::new() {
                    if let Ok(devices) = context.devices() {
                        for device in devices.iter() {
                            let handle = device.open();
                            let descriptor = device.device_descriptor();

                            if let (Ok(handle), Ok(descriptor)) = (handle, descriptor) {
                                let manufacturer = handle
                                    .read_manufacturer_string_ascii(&descriptor)
                                    .unwrap_or_else(|_| String::from("Unknown"));
                                let product = handle
                                    .read_product_string_ascii(&descriptor)
                                    .unwrap_or_else(|_| String::from("Unknown"));

                                let device_id = format!(
                                    "usb_{}_{}_{}",
                                    descriptor.vendor_id(),
                                    descriptor.product_id(),
                                    device.bus_number()
                                );

                                let device_info = UsbDevice {
                                    base: BaseDevice {
                                        id: device_id.clone(),
                                        r#type: "usb".to_string(),
                                        friendly_name: product.clone(),
                                        description: format!("USB device: {}", product),
                                        protocol: Protocol::Usb,
                                        status: DeviceStatus::Online,
                                        categories: vec![DeviceCategory::Unknown],
                                        capabilities: DeviceCapabilities::default(),
                                        location: Location {
                                            room: None,
                                            floor: None,
                                            zone: None,
                                        },
                                        metadata: DeviceMetadata {
                                            manufacturer: Some(manufacturer.clone()),
                                            model: Some(product.clone()),
                                            firmware_version: None,
                                            hardware_version: None,
                                            icon_url: None,
                                        },
                                        network_info: None,
                                        created: Utc::now(),
                                        updated: Utc::now(),
                                        last_online: Some(Utc::now()),
                                        raw_details: json!({
                                            "vendor_id": descriptor.vendor_id(),
                                            "product_id": descriptor.product_id(),
                                            "bus_number": device.bus_number(),
                                            "address": device.address(),
                                            "class": descriptor.class_code(),
                                            "sub_class": descriptor.sub_class_code(),
                                            "protocol": descriptor.protocol_code(),
                                        }),
                                    },
                                    vendor_id: descriptor.vendor_id(),
                                    product_id: descriptor.product_id(),
                                    bus_number: device.bus_number(),
                                    address: device.address(),
                                };

                                // Send discovery event
                                let _ = device_tx_clone.send(DiscoveryDeviceEvent::DeviceUpdated(
                                    device_info.clone().into(),
                                ));

                                // Send device online event
                                let device_event = DeviceEvent {
                                    timestamp: Utc::now(),
                                    device_id: device_id.clone(),
                                    protocol: Protocol::Usb,
                                    category: DeviceCategory::Unknown,
                                    priority: EventPriority::Normal,
                                    event_type: EventType::DeviceOnline {
                                        device_id: device_id.clone(),
                                    },
                                    raw_data: Some(device_info.base.raw_details.clone()),
                                };

                                let _ = event_manager.publish_event(device_event);
                            }
                        }
                    }
                }
            })
            .await
            {
                error!("Failed to execute USB monitoring: {:?}", e);
                let _ = device_tx.send(DiscoveryDeviceEvent::NetworkOffline);
            }

            // Wait before next scan
            tokio::time::sleep(Duration::from_secs(5)).await;
        }
    }
}

#[async_trait]
impl DeviceProtocol for UsbProtocol {
    fn protocol_name(&self) -> &'static str {
        "USB"
    }

    fn get_instance() -> Arc<Self> {
        INSTANCE.clone()
    }

    async fn start_discovery(
        &self,
        device_events: broadcast::Sender<DiscoveryDeviceEvent>,
    ) -> Result<()> {
        // Start the monitoring in the background
        tokio::spawn({
            let this = self.clone();
            async move {
                this.monitor_usb(device_events).await;
            }
        });

        Ok(())
    }
}

use std::{sync::Arc, time::Duration};

use async_trait::async_trait;
use chrono::Utc;
use futures_util::StreamExt;
use miette::Result;
use once_cell::sync::Lazy;
use reqwest::Client;
use serde_json::json;
use tokio::sync::broadcast;
use tracing::{debug, error, info};

use crate::{
    discovery::DeviceProtocol,
    events::{DeviceEvent, EventManager, EventPriority, EventType},
    types::{
        BaseDevice, DeviceCapabilities, DeviceCategory, DeviceEvent as DiscoveryDeviceEvent,
        DeviceMetadata, DeviceStatus, Location, Protocol, SseDevice,
    },
};

pub static INSTANCE: Lazy<Arc<SseProtocol>> = Lazy::new(|| {
    Arc::new(
        SseProtocol::new(Arc::new(EventManager::new())).expect("Failed to initialize SseProtocol"),
    )
});

#[derive(Clone)]
pub struct SseProtocol {
    event_manager: Arc<EventManager>,
    client: Client,
}

impl SseProtocol {
    pub fn new(event_manager: Arc<EventManager>) -> Result<Self> {
        Ok(Self {
            event_manager,
            client: Client::new(),
        })
    }

    pub fn get_instance() -> Arc<SseProtocol> {
        INSTANCE.clone()
    }

    async fn monitor_sse(&self, device_tx: broadcast::Sender<DiscoveryDeviceEvent>) {
        info!("Starting SSE monitoring...");

        loop {
            let device_tx_clone = device_tx.clone();
            let event_manager = self.event_manager.clone();
            let client = self.client.clone();

            // Example SSE endpoints - you would configure these based on your needs
            let endpoints = [
                "http://localhost:3000/api/events",
                "http://localhost:3000/api/device-events",
                "http://apollo-air-1-12944c.local./events",
            ];

            for endpoint in endpoints.iter() {
                let response = match client.get(*endpoint).send().await {
                    Ok(response) => response,
                    Err(e) => {
                        error!("Failed to connect to SSE endpoint {}: {:?}", endpoint, e);
                        continue;
                    }
                };

                let mut stream = response.bytes_stream();

                while let Some(chunk) = stream.next().await {
                    match chunk {
                        Ok(bytes) => {
                            if let Ok(text) = String::from_utf8(bytes.to_vec()) {
                                for line in text.lines() {
                                    if line.starts_with("data: ") {
                                        let data = &line[6..];
                                        if let Ok(event) =
                                            serde_json::from_str::<serde_json::Value>(data)
                                        {
                                            debug!("Received SSE event: {:?}", event);

                                            // Extract device info from the event
                                            let device_id = format!(
                                                "sse_{}",
                                                event
                                                    .get("id")
                                                    .and_then(|i| i.as_str())
                                                    .unwrap_or("unknown")
                                            );

                                            // Create SSE device
                                            let sse_device = SseDevice {
                                                base: BaseDevice {
                                                    id: device_id.clone(),
                                                    r#type: "sse".to_string(),
                                                    friendly_name: format!(
                                                        "SSE Device {}",
                                                        device_id
                                                    ),
                                                    description: "Server-Sent Events Device"
                                                        .to_string(),
                                                    protocol: Protocol::SSE,
                                                    status: DeviceStatus::Online,
                                                    categories: vec![DeviceCategory::Sensor],
                                                    capabilities: DeviceCapabilities::default(),
                                                    location: Location::default(),
                                                    metadata: DeviceMetadata {
                                                        manufacturer: None,
                                                        model: None,
                                                        firmware_version: None,
                                                        hardware_version: None,
                                                        icon_url: None,
                                                    },
                                                    network_info: None,
                                                    created: Utc::now(),
                                                    updated: Utc::now(),
                                                    last_online: Some(Utc::now()),
                                                    raw_details: event.clone(),
                                                },
                                                endpoint: endpoint.to_string(),
                                            };

                                            // Send discovery event
                                            let _ = device_tx_clone.send(
                                                DiscoveryDeviceEvent::DeviceUpdated(
                                                    sse_device.clone().into(),
                                                ),
                                            );

                                            // Send device event
                                            let device_event = DeviceEvent {
                                                timestamp: Utc::now(),
                                                device_id: device_id.clone(),
                                                protocol: Protocol::SSE,
                                                category: DeviceCategory::Sensor,
                                                priority: EventPriority::Normal,
                                                event_type: EventType::StateChange {
                                                    device_id,
                                                    state: event,
                                                },
                                                raw_data: Some(json!({
                                                    "endpoint": endpoint,
                                                    "data": data
                                                })),
                                            };

                                            let _ = event_manager.publish_event(device_event);
                                        }
                                    }
                                }
                            }
                        }
                        Err(e) => {
                            error!("Error reading SSE stream: {:?}", e);
                            break;
                        }
                    }
                }
            }

            // Wait before reconnecting
            tokio::time::sleep(Duration::from_secs(5)).await;
        }
    }
}

#[async_trait]
impl DeviceProtocol for SseProtocol {
    fn protocol_name(&self) -> &'static str {
        "SSE"
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
                this.monitor_sse(device_events).await;
            }
        });

        Ok(())
    }
}

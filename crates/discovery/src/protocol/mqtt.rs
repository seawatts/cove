use std::{sync::Arc, time::Duration};

use async_trait::async_trait;
use chrono::Utc;
use miette::Result;
use once_cell::sync::Lazy;
use rumqttc::{AsyncClient, Event, MqttOptions, Packet, QoS};
use serde_json::json;
use tokio::sync::broadcast;
use tracing::{debug, error, info, warn};

use crate::{
    discovery::DeviceProtocol,
    events::{DeviceEvent, EventManager, EventPriority, EventType},
    types::{
        BaseDevice, DeviceCapabilities, DeviceCategory, DeviceEvent as DiscoveryDeviceEvent,
        DeviceMetadata, DeviceStatus, Location, MqttDevice, Protocol,
    },
};

pub static INSTANCE: Lazy<Arc<MqttProtocol>> = Lazy::new(|| {
    Arc::new(
        MqttProtocol::new(Arc::new(EventManager::new()))
            .expect("Failed to initialize MqttProtocol"),
    )
});

#[derive(Clone)]
pub struct MqttProtocol {
    event_manager: Arc<EventManager>,
}

impl MqttProtocol {
    pub fn new(event_manager: Arc<EventManager>) -> Result<Self> {
        Ok(Self { event_manager })
    }

    pub fn get_instance() -> Arc<MqttProtocol> {
        INSTANCE.clone()
    }

    async fn monitor_mqtt(&self, device_tx: broadcast::Sender<DiscoveryDeviceEvent>) {
        info!("Starting MQTT device monitoring...");

        loop {
            let mqtt_options = MqttOptions::new("cove-home", "localhost", 1883);
            let (client, mut eventloop) = AsyncClient::new(mqtt_options, 10);

            let device_tx_clone = device_tx.clone();
            let event_manager = self.event_manager.clone();

            // Subscribe to both general Home Assistant discovery and specific AIR-1 topics
            let subscriptions = [
                ("home/+/+/config", QoS::AtMostOnce),
                ("home/sensor/air1_+/#", QoS::AtMostOnce), // AIR-1 sensors
                ("home/binary_sensor/air1_+/#", QoS::AtMostOnce), // AIR-1 binary sensors
            ];

            let mut subscription_success = true;
            for (topic, qos) in subscriptions.iter() {
                if let Err(e) = client.subscribe(*topic, *qos).await {
                    error!("Failed to subscribe to {}: {:?}", topic, e);
                    subscription_success = false;
                    break;
                }
            }

            if subscription_success {
                info!("Subscribed to Home Assistant and AIR-1 discovery topics");

                while let Ok(event) = eventloop.poll().await {
                    match event {
                        Event::Incoming(Packet::Publish(publish)) => {
                            let topic = &publish.topic;
                            if let Ok(payload) = String::from_utf8(publish.payload.to_vec()) {
                                if let Ok(config) =
                                    serde_json::from_str::<serde_json::Value>(&payload)
                                {
                                    // Handle AIR-1 specific sensors
                                    if topic.contains("air1_") {
                                        debug!("Received AIR-1 data: {:?}", config);

                                        // Extract device info
                                        let device_id = format!(
                                            "mqtt_air1_{}",
                                            topic
                                                .split('/')
                                                .nth(2)
                                                .and_then(|s| s.strip_prefix("air1_"))
                                                .unwrap_or("unknown")
                                        );

                                        // Create MQTT device with AIR-1 specific details
                                        let mqtt_device = MqttDevice {
                                            base: BaseDevice {
                                                id: device_id.clone(),
                                                r#type: "air1".to_string(),
                                                friendly_name: format!(
                                                    "Apollo AIR-1 {}",
                                                    device_id
                                                ),
                                                description: "Apollo AIR-1 Air Quality Monitor"
                                                    .to_string(),
                                                protocol: Protocol::MQTT,
                                                status: DeviceStatus::Online,
                                                categories: vec![DeviceCategory::Sensor],
                                                capabilities: DeviceCapabilities::default(),
                                                location: Location::default(),
                                                metadata: DeviceMetadata {
                                                    manufacturer: Some(
                                                        "Apollo Automation".to_string(),
                                                    ),
                                                    model: Some("AIR-1".to_string()),
                                                    firmware_version: config
                                                        .get("sw_version")
                                                        .and_then(|v| v.as_str())
                                                        .map(String::from),
                                                    hardware_version: None,
                                                    icon_url: None,
                                                },
                                                network_info: None,
                                                created: Utc::now(),
                                                updated: Utc::now(),
                                                last_online: Some(Utc::now()),
                                                raw_details: config.clone(),
                                            },
                                            topic: topic.to_string(),
                                        };

                                        // Send discovery event
                                        let _ = device_tx_clone.send(
                                            DiscoveryDeviceEvent::DeviceUpdated(
                                                mqtt_device.clone().into(),
                                            ),
                                        );

                                        // Send device event
                                        let device_event = DeviceEvent {
                                            timestamp: Utc::now(),
                                            device_id: device_id.clone(),
                                            protocol: Protocol::MQTT,
                                            category: DeviceCategory::Sensor,
                                            priority: EventPriority::Normal,
                                            event_type: EventType::StateChange {
                                                device_id,
                                                state: config,
                                            },
                                            raw_data: Some(json!({
                                                "topic": topic,
                                                "payload": payload
                                            })),
                                        };

                                        let _ = event_manager.publish_event(device_event);
                                    } else {
                                        // Extract device information from the discovery message
                                        if let Some(device_info) = config.get("device") {
                                            let device_id = format!(
                                                "mqtt_{}",
                                                device_info
                                                    .get("identifiers")
                                                    .and_then(|i| i.as_array())
                                                    .and_then(|a| a.first())
                                                    .and_then(|i| i.as_str())
                                                    .unwrap_or("unknown")
                                            );

                                            let manufacturer = device_info
                                                .get("manufacturer")
                                                .and_then(|m| m.as_str())
                                                .unwrap_or("Unknown")
                                                .to_string();

                                            let model = device_info
                                                .get("model")
                                                .and_then(|m| m.as_str())
                                                .unwrap_or("Unknown")
                                                .to_string();

                                            let name = device_info
                                                .get("name")
                                                .and_then(|n| n.as_str())
                                                .unwrap_or("Unknown Device")
                                                .to_string();

                                            // Create MQTT device
                                            let mqtt_device = MqttDevice {
                                                base: BaseDevice {
                                                    id: device_id.clone(),
                                                    r#type: "mqtt".to_string(),
                                                    friendly_name: name.clone(),
                                                    description: format!("MQTT device: {}", name),
                                                    protocol: Protocol::MQTT,
                                                    status: DeviceStatus::Online,
                                                    categories: vec![DeviceCategory::Unknown],
                                                    capabilities: DeviceCapabilities::default(),
                                                    location: Location {
                                                        room: None,
                                                        floor: None,
                                                        zone: None,
                                                    },
                                                    metadata: DeviceMetadata {
                                                        manufacturer: Some(manufacturer),
                                                        model: Some(model),
                                                        firmware_version: device_info
                                                            .get("sw_version")
                                                            .and_then(|v| v.as_str())
                                                            .map(String::from),
                                                        hardware_version: None,
                                                        icon_url: None,
                                                    },
                                                    network_info: None,
                                                    created: Utc::now(),
                                                    updated: Utc::now(),
                                                    last_online: Some(Utc::now()),
                                                    raw_details: config.clone(),
                                                },
                                                topic: publish.topic.clone(),
                                            };

                                            // Send discovery event
                                            let _ = device_tx_clone.send(
                                                DiscoveryDeviceEvent::DeviceUpdated(
                                                    mqtt_device.clone().into(),
                                                ),
                                            );

                                            // Send device online event
                                            let device_event = DeviceEvent {
                                                timestamp: Utc::now(),
                                                device_id: device_id.clone(),
                                                protocol: Protocol::MQTT,
                                                category: DeviceCategory::Unknown,
                                                priority: EventPriority::Normal,
                                                event_type: EventType::DeviceOnline {
                                                    device_id: device_id.clone(),
                                                },
                                                raw_data: Some(config),
                                            };

                                            let _ = event_manager.publish_event(device_event);
                                        }
                                    }
                                }
                            }
                        }
                        Event::Incoming(Packet::Disconnect) => {
                            warn!("MQTT broker disconnected");
                            let _ = device_tx.send(DiscoveryDeviceEvent::NetworkOffline);
                            break;
                        }
                        _ => {}
                    }
                }
            } else {
                let _ = device_tx.send(DiscoveryDeviceEvent::NetworkOffline);
            }

            // Wait before reconnecting
            tokio::time::sleep(Duration::from_secs(5)).await;
        }
    }
}

#[async_trait]
impl DeviceProtocol for MqttProtocol {
    fn protocol_name(&self) -> &'static str {
        "MQTT"
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
                this.monitor_mqtt(device_events).await;
            }
        });

        Ok(())
    }
}

use async_trait::async_trait;
use chrono::Utc;
use esphome::connection::ESPHomeConnection;
use esphome::traits::{ESPHomeApi, EntityManagement, StateManagement};
use esphome::types::{Entity, StateResponse};
use miette::Result;
use std::collections::HashMap;
use std::sync::Arc;
use timeseries::{DeviceStateReading, EventReading, Ts};
use tokio::sync::mpsc;
use types::capabilities::{
    AirQualityMetric, CapabilityEvent, CapabilityState, CapabilityType, SensorType,
};

mod capabilities;
pub use capabilities::*;

#[derive(Debug)]
pub struct ESPHomeProtocol {
    address: String,
    port: u16,
    connection: Option<ESPHomeConnection>,
    event_tx: mpsc::Sender<CapabilityEvent>,
}

impl ESPHomeProtocol {
    pub fn new(address: String, port: u16, event_tx: mpsc::Sender<CapabilityEvent>) -> Self {
        Self {
            address,
            port,
            connection: None,
            event_tx,
        }
    }

    async fn handle_state_update(&self, entity: Entity, response: StateResponse) {
        match (&entity, response) {
            (Entity::Sensor { key, name, .. }, StateResponse::Sensor { state, .. }) => {
                // Create a DeviceStateReading for timeseries storage
                let device_state = DeviceStateReading {
                    ts: Utc::now(),
                    device_id: self.address.clone(),
                    device_type: "sensor".to_string(),
                    values: {
                        let mut values = HashMap::new();
                        values.insert(key.to_string(), state);
                        values
                    },
                    flags: HashMap::new(),
                    strings: HashMap::new(),
                    room: None, // Room could be added as a configuration option
                };

                // Store the device state
                if let Err(e) = Ts::create(device_state).await {
                    tracing::error!("Failed to store device state: {}", e);
                }

                // Create an EventReading for the capability event
                let event = EventReading {
                    ts: Utc::now(),
                    device_id: self.address.clone(),
                    event_id: key.to_string(),
                    event_type: "capability_state_changed".to_string(),
                    value: serde_json::json!({
                        "capability_type": format!("{:?}", self.determine_sensor_type(name, state)),
                        "value": state,
                    }),
                    room: None,
                };

                // Store the event
                if let Err(e) = Ts::create(event).await {
                    tracing::error!("Failed to store capability event: {}", e);
                }

                // Send state changed event
                if let Err(e) = self
                    .event_tx
                    .send(CapabilityEvent::StateChanged {
                        device_id: self.address.clone(),
                        capability_id: key.to_string(),
                        capability_type: CapabilityType::Sensor(
                            self.determine_sensor_type(name, state),
                        ),
                        state: CapabilityState {
                            timestamp: Utc::now(),
                            value: serde_json::json!({
                                "value": state,
                            }),
                        },
                    })
                    .await
                {
                    // If we can't send the event, send an error event instead
                    let _ = self
                        .event_tx
                        .send(CapabilityEvent::Error {
                            device_id: self.address.clone(),
                            capability_id: key.to_string(),
                            error: format!("Failed to send state change event: {}", e),
                        })
                        .await;
                }
            }
            // Add other entity types as needed
            _ => {}
        }
    }

    fn determine_sensor_type(&self, name: &str, _value: f32) -> SensorType {
        let name = name.to_lowercase();
        if name.contains("temp") {
            SensorType::Temperature
        } else if name.contains("humid") {
            SensorType::Humidity
        } else if name.contains("pm2.5") {
            SensorType::AirQuality(AirQualityMetric::PM25)
        } else if name.contains("pm10") {
            SensorType::AirQuality(AirQualityMetric::PM10)
        } else if name.contains("co2") {
            SensorType::CO2
        } else if name.contains("voc") {
            SensorType::VOC
        } else {
            // Default to Other in the original Capability enum for backwards compatibility
            SensorType::Light // This should probably be more flexible
        }
    }
}

#[async_trait]
impl super::Protocol for ESPHomeProtocol {
    async fn connect(&mut self) -> Result<()> {
        let mut connection = ESPHomeConnection::builder()
            .address(&self.address)
            .port(self.port)
            .build()
            .await?;

        // Connect to the device
        connection.connect().await?;

        // Subscribe to state changes
        let protocol = Arc::new(self.clone());
        connection
            .subscribe_states(move |entity, response| {
                let protocol = protocol.clone();
                Box::pin(async move {
                    protocol.handle_state_update(entity, response).await;
                })
            })
            .await?;

        self.connection = Some(connection);
        Ok(())
    }

    async fn disconnect(&mut self) -> Result<()> {
        if let Some(connection) = &mut self.connection {
            connection.disconnect().await?;
            self.connection = None;
        }
        Ok(())
    }

    async fn is_connected(&self) -> bool {
        self.connection.is_some()
    }
}

// Add Clone implementation for ESPHomeProtocol
impl Clone for ESPHomeProtocol {
    fn clone(&self) -> Self {
        Self {
            address: self.address.clone(),
            port: self.port,
            connection: None, // Don't clone the connection
            event_tx: self.event_tx.clone(),
        }
    }
}

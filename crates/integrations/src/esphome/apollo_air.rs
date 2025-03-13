use async_trait::async_trait;
use bus::EventBus;
use chrono::Utc;
use esphome::{ESPHomeApi, ESPHomeConfig, ESPHomeConnection, StateManagement};
use miette::Result;
use std::sync::Arc;
use timeseries::{SensorReading, TimeseriesDbService, Ts};
use tokio::sync::RwLock;
use tracing::{debug, error, info};
use types::BusEvent;

use crate::{Integration, IntegrationConfig};

pub struct ApolloAir1 {
    name: String,
    connection: RwLock<Option<ESPHomeConnection>>,
    config: ESPHomeConfig,
    integration_config: IntegrationConfig,
    event_bus: Arc<EventBus>,
    timeseries_service: Arc<TimeseriesDbService>,
}

impl ApolloAir1 {
    pub fn new(
        name: String,
        address: String,
        port: u16,
        event_bus: Arc<EventBus>,
        timeseries_service: Arc<TimeseriesDbService>,
    ) -> Self {
        let config = ESPHomeConfig {
            address: format!("{}:{}", address, port),
            password: None, // Set if you have authentication enabled
            timeout: std::time::Duration::from_secs(5),
        };

        Self {
            name,
            connection: RwLock::new(None),
            config,
            integration_config: IntegrationConfig {},
            event_bus,
            timeseries_service,
        }
    }

    async fn setup_state_subscription(&self, connection: &mut ESPHomeConnection) -> Result<()> {
        let device_id = self.name.clone();
        let event_bus = self.event_bus.clone();
        let ts = self.timeseries_service.clone();

        connection
            .subscribe_states(move |entity, state| {
                let device_id = device_id.clone();
                let event_bus = event_bus.clone();
                let ts = ts.clone();
                Box::pin(async move {
                    info!("Entity: {:?}", entity);
                    info!("state: {:?}", state);

                    // Extract sensor info based on entity type
                    let (sensor_id, value, unit) = match entity {
                        esphome::Entity::Sensor(sensor) => match state {
                            esphome::StateResponse::Sensor(s) => (
                                sensor.object_id.clone(),
                                s.state as f64,
                                sensor.unit_of_measurement.clone(),
                            ),
                            _ => return,
                        },
                        _ => return, // Skip non-sensor entities
                    };

                    // Create sensor reading
                    let reading = SensorReading {
                        ts: Utc::now(),
                        device_id: device_id.clone(),
                        sensor_id,
                        value,
                        unit: Some(unit),
                        room: None,
                    };

                    // Store in timeseries database using the injected timeseries service
                    if let Err(e) = ts.create_reading(reading.clone()).await {
                        error!("Failed to store sensor reading: {}", e);
                    } else {
                        info!(
                            "Stored sensor reading for {}: {}",
                            reading.sensor_id, reading.value
                        );
                    }

                    // Publish state change event
                    event_bus
                        .publish(BusEvent::SensorReading {
                            ts: Utc::now(),
                            device_id: device_id.clone(),
                            sensor_id: reading.sensor_id,
                            value: reading.value,
                            unit: reading.unit,
                        })
                        .await
                        .map_err(|e| error!("Failed to publish sensor reading: {}", e));
                })
            })
            .await?;
        tokio::time::sleep(std::time::Duration::from_secs(30)).await;
        info!("Set up state subscription for {}", self.name);
        Ok(())
    }

    // Helper method to check connection status
    pub async fn is_connected(&self) -> bool {
        if let Some(connection) = &*self.connection.read().await {
            connection.connected
        } else {
            false
        }
    }
}

impl Integration for ApolloAir1 {
    fn name(&self) -> &str {
        &self.name
    }

    fn config(&self) -> &IntegrationConfig {
        &self.integration_config
    }

    fn start(self: Arc<Self>) -> Result<()> {
        let this = Arc::clone(&self);
        tokio::spawn(async move {
            // let self_clone = self.clone();
            let mut connection = ESPHomeConnection::new(this.config.clone()).await.unwrap();

            // Connect and authenticate
            connection.hello().await.unwrap();
            connection.connect().await.unwrap();

            // Set up state subscription
            this.setup_state_subscription(&mut connection)
                .await
                .unwrap();

            // Store connection
            *this.connection.write().await = Some(connection);
        });

        info!("Started Apollo Air 1 integration for {}", self.name);
        Ok(())
    }

    fn stop(&self) -> Result<()> {
        // Convert to async block and await
        tokio::runtime::Handle::current().block_on(async {
            if let Some(mut connection) = self.connection.write().await.take() {
                connection.disconnect().await?;
                info!("Stopped Apollo Air 1 integration for {}", self.name);
            }
            Ok(())
        })
    }
}

// Factory function to create a new Apollo Air-1 instance
pub fn create_apollo_air_1(
    name: String,
    address: String,
    port: u16,
    eventBus: Arc<EventBus>,
    timeseries_service: Arc<TimeseriesDbService>,
) -> Result<Arc<ApolloAir1>> {
    Ok(Arc::new(ApolloAir1::new(
        name,
        address,
        port,
        eventBus,
        timeseries_service,
    )))
}

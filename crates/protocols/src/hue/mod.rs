mod api;
mod config;
mod discovery;
mod types;

use std::sync::Arc;

use ::types::{
    Accessory, AccessoryEvent, CharacteristicType, Command, Format, Permissions, Protocol,
    ProtocolHandler, ServiceType, Unit,
};
use async_trait::async_trait;
use miette::Result;
use reqwest::Client;
use serde_json::json;
use tokio::sync::{broadcast, RwLock};
use tracing::{debug, error, info};
use url::Url;

use self::{
    api::HueApi,
    config::HueConfig,
    types::{HueLight, HueLightState},
};
use crate::error::ProtocolError;

pub struct HueProtocol {
    config: Arc<RwLock<HueConfig>>,
    api: Arc<HueApi>,
}

impl HueProtocol {
    pub async fn new(bridge_ip: String, username: Option<String>) -> Result<Self> {
        let bridge_ip_clone = bridge_ip.clone();
        let config = HueConfig {
            bridge_ip,
            username: username.clone(),
            ..Default::default()
        };

        let api = HueApi::new(
            Client::new(),
            Url::parse(&format!("http://{}", bridge_ip_clone))
                .map_err(|e| ProtocolError::ConfigurationError(e.to_string()))?,
            username,
        );

        Ok(Self {
            config: Arc::new(RwLock::new(config)),
            api: Arc::new(api),
        })
    }

    /// Pairs with the Hue bridge
    pub async fn pair(&self) -> Result<String> {
        info!("Attempting to pair with Hue bridge...");

        // Try to create a new user
        let username = self
            .api
            .create_user("cove#device")
            .await
            .map_err(|e| ProtocolError::AuthenticationError(e.to_string()))?;

        // Update the config with the new username
        self.config.write().await.username = Some(username.clone());

        Ok(username)
    }

    /// Converts a Hue light to our Accessory model
    fn convert_light_to_accessory(&self, light: HueLight) -> Accessory {
        let mut accessory = Accessory::new(
            format!("hue_{}", light.id),
            light.name,
            ::types::protocols::Protocol::WiFi,
        );

        // Add manufacturer details
        accessory.manufacturer = Some("Philips".to_string());
        accessory.model = Some(light.model_id);
        accessory.firmware_version = Some(light.software_version);

        // Create the main light service
        let mut light_service = ::types::services::Service::new(
            "main".to_string(),
            ServiceType::Lightbulb,
            "Main Light".to_string(),
        );

        // Add power characteristic
        light_service.add_characteristic(
            ::types::characteristics::Characteristic::new(
                "power".to_string(),
                CharacteristicType::On,
                Format::Bool,
            )
            .with_permissions(Permissions {
                readable: true,
                writable: true,
                notify: true,
            })
            .with_value(json!(light.state.on)),
        );

        // Add brightness if supported
        if light.state.bri.is_some() {
            light_service.add_characteristic(
                ::types::characteristics::Characteristic::new(
                    "brightness".to_string(),
                    CharacteristicType::Brightness,
                    Format::Uint8,
                )
                .with_permissions(Permissions {
                    readable: true,
                    writable: true,
                    notify: true,
                })
                .with_unit(Unit::Percentage)
                .with_value(json!(light.state.bri.unwrap_or(0)))
                .with_min_value(json!(0))
                .with_max_value(json!(100))
                .with_step_value(json!(1)),
            );
        }

        // Add color temperature if supported
        if light.state.ct.is_some() {
            light_service.add_characteristic(
                ::types::characteristics::Characteristic::new(
                    "color_temp".to_string(),
                    CharacteristicType::ColorTemperature,
                    Format::Uint16,
                )
                .with_permissions(Permissions {
                    readable: true,
                    writable: true,
                    notify: true,
                })
                .with_value(json!(light.state.ct.unwrap_or(153)))
                .with_min_value(json!(153)) // 6500K
                .with_max_value(json!(500)) // 2000K
                .with_step_value(json!(1)),
            );
        }

        // Add color if supported
        if light.state.hue.is_some() && light.state.sat.is_some() {
            light_service.add_characteristic(
                ::types::characteristics::Characteristic::new(
                    "hue".to_string(),
                    CharacteristicType::Hue,
                    Format::Float,
                )
                .with_permissions(Permissions {
                    readable: true,
                    writable: true,
                    notify: true,
                })
                .with_value(json!(light.state.hue.unwrap_or(0)))
                .with_min_value(json!(0))
                .with_max_value(json!(360))
                .with_step_value(json!(1)),
            );

            light_service.add_characteristic(
                ::types::characteristics::Characteristic::new(
                    "saturation".to_string(),
                    CharacteristicType::Saturation,
                    Format::Float,
                )
                .with_permissions(Permissions {
                    readable: true,
                    writable: true,
                    notify: true,
                })
                .with_value(json!(light.state.sat.unwrap_or(0)))
                .with_min_value(json!(0))
                .with_max_value(json!(100))
                .with_step_value(json!(1)),
            );
        }

        accessory.add_service(light_service);
        accessory
    }
}

#[async_trait]
impl ProtocolHandler for HueProtocol {
    fn protocol_name(&self) -> &'static str {
        "hue"
    }

    async fn start_discovery(&self) -> Result<()> {
        info!("Starting Hue light discovery...");

        // Ensure we're authenticated
        if self.config.read().await.username.is_none() {
            return Err(
                ProtocolError::AuthenticationError("Not paired with bridge".to_string()).into(),
            );
        }

        Ok(())
    }

    async fn stop_discovery(&self) -> Result<()> {
        info!("Stopping Hue light discovery...");
        Ok(())
    }

    async fn connect(&self, accessory: &Accessory) -> Result<()> {
        debug!("Connecting to Hue light: {}", accessory.id);
        Ok(())
    }

    async fn disconnect(&self, accessory: &Accessory) -> Result<()> {
        debug!("Disconnecting from Hue light: {}", accessory.id);
        Ok(())
    }

    async fn send_command(&self, accessory: &Accessory, command: Command) -> Result<()> {
        let light_id = accessory
            .id
            .strip_prefix("hue_")
            .ok_or_else(|| ProtocolError::CommandError("Invalid Hue light ID".to_string()))?;

        match (
            command.service_id.as_str(),
            command.characteristic_id.as_str(),
        ) {
            ("main", "power") => {
                let on = command.value.as_bool().ok_or_else(|| {
                    ProtocolError::CommandError("Invalid power value".to_string())
                })?;

                self.api
                    .set_light_state(light_id, json!({ "on": on }))
                    .await?;
            }
            ("main", "brightness") => {
                let bri = command.value.as_u64().ok_or_else(|| {
                    ProtocolError::CommandError("Invalid brightness value".to_string())
                })?;

                self.api
                    .set_light_state(light_id, json!({ "bri": bri }))
                    .await?;
            }
            ("main", "color_temp") => {
                let ct = command.value.as_u64().ok_or_else(|| {
                    ProtocolError::CommandError("Invalid color temperature value".to_string())
                })?;

                self.api
                    .set_light_state(light_id, json!({ "ct": ct }))
                    .await?;
            }
            ("main", "hue") => {
                let hue = command
                    .value
                    .as_f64()
                    .ok_or_else(|| ProtocolError::CommandError("Invalid hue value".to_string()))?;

                self.api
                    .set_light_state(light_id, json!({ "hue": hue }))
                    .await?;
            }
            ("main", "saturation") => {
                let sat = command.value.as_f64().ok_or_else(|| {
                    ProtocolError::CommandError("Invalid saturation value".to_string())
                })?;

                self.api
                    .set_light_state(light_id, json!({ "sat": sat }))
                    .await?;
            }
            _ => {
                return Err(ProtocolError::CommandError("Unsupported command".to_string()).into());
            }
        }

        Ok(())
    }

    async fn get_state(
        &self,
        accessory: &Accessory,
    ) -> Result<Vec<::types::protocols::AccessoryEvent>> {
        let light_id = accessory
            .id
            .strip_prefix("hue_")
            .ok_or_else(|| ProtocolError::StateError("Invalid Hue light ID".to_string()))?;

        let light = self.api.get_light(light_id).await?;
        let mut events = Vec::new();

        // Add power state
        events.push(::types::protocols::AccessoryEvent {
            accessory_id: accessory.id.clone(),
            service_id: "main".to_string(),
            characteristic_id: "power".to_string(),
            value: json!(light.state.on),
            is_response: false,
        });

        // Add brightness if available
        if let Some(bri) = light.state.bri {
            events.push(::types::protocols::AccessoryEvent {
                accessory_id: accessory.id.clone(),
                service_id: "main".to_string(),
                characteristic_id: "brightness".to_string(),
                value: json!(bri),
                is_response: false,
            });
        }

        // Add color temperature if available
        if let Some(ct) = light.state.ct {
            events.push(::types::protocols::AccessoryEvent {
                accessory_id: accessory.id.clone(),
                service_id: "main".to_string(),
                characteristic_id: "color_temp".to_string(),
                value: json!(ct),
                is_response: false,
            });
        }

        // Add color if available
        if let Some(hue) = light.state.hue {
            events.push(::types::protocols::AccessoryEvent {
                accessory_id: accessory.id.clone(),
                service_id: "main".to_string(),
                characteristic_id: "hue".to_string(),
                value: json!(hue),
                is_response: false,
            });
        }

        if let Some(sat) = light.state.sat {
            events.push(::types::protocols::AccessoryEvent {
                accessory_id: accessory.id.clone(),
                service_id: "main".to_string(),
                characteristic_id: "saturation".to_string(),
                value: json!(sat),
                is_response: false,
            });
        }

        Ok(events)
    }

    async fn subscribe_to_events(
        &self,
        accessory: &Accessory,
        tx: broadcast::Sender<::types::protocols::AccessoryEvent>,
    ) -> Result<()> {
        // Hue doesn't support real-time events, so we'll poll periodically
        let accessory = accessory.clone();
        let this = self.clone();

        tokio::spawn(async move {
            loop {
                match this.get_state(&accessory).await {
                    Ok(events) => {
                        for event in events {
                            if let Err(e) = tx.send(event) {
                                error!("Failed to send event: {}", e);
                            }
                        }
                    }
                    Err(e) => {
                        error!("Failed to get state: {}", e);
                    }
                }

                tokio::time::sleep(std::time::Duration::from_secs(1)).await;
            }
        });

        Ok(())
    }

    async fn identify(&self, accessory: &Accessory) -> Result<()> {
        let light_id = accessory
            .id
            .strip_prefix("hue_")
            .ok_or_else(|| ProtocolError::CommandError("Invalid Hue light ID".to_string()))?;

        // Flash the light twice
        for _ in 0..2 {
            self.api
                .set_light_state(light_id, json!({ "alert": "select" }))
                .await?;
            tokio::time::sleep(std::time::Duration::from_secs(1)).await;
        }

        Ok(())
    }
}

impl Clone for HueProtocol {
    fn clone(&self) -> Self {
        Self {
            config: self.config.clone(),
            api: self.api.clone(),
        }
    }
}

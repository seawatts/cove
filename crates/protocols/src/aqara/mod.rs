mod api;
mod config;
mod types;

use std::sync::Arc;

use ::types::{
    Accessory, AccessoryEvent, Command,
    ProtocolHandler,
};
use async_trait::async_trait;
use miette::Result;
use reqwest::Client;
use serde_json::json;
use tokio::sync::{broadcast, RwLock};
use tracing::{debug, error, info};

use self::{
    api::AqaraApi,
    config::AqaraConfig,
};
use crate::error::ProtocolError;

pub struct AqaraProtocol {
    config: Arc<RwLock<AqaraConfig>>,
    api: Arc<AqaraApi>,
}

impl AqaraProtocol {
    pub async fn new(cloud_key: String, device_id: String) -> Result<Self> {
        let cloud_key_clone = cloud_key.clone();
        let config = AqaraConfig {
            cloud_key,
            device_id: device_id.clone(),
            ..Default::default()
        };

        let api = AqaraApi::new(Client::new(), cloud_key_clone, device_id);

        Ok(Self {
            config: Arc::new(RwLock::new(config)),
            api: Arc::new(api),
        })
    }

    // Converts an Aqara lock to our Accessory model
    // fn convert_lock_to_accessory(&self, lock: AqaraLock) -> Accessory {
    //     let mut accessory = Accessory::new(format!("aqara_{}", lock.id), lock.name, Protocol::WiFi);

    //     // Add manufacturer details
    //     accessory.manufacturer = Some("Aqara".to_string());
    //     accessory.model = Some("U100".to_string());
    //     accessory.firmware_version = Some(lock.firmware_version);

    //     // Create the main lock service
    //     let mut lock_service =
    //         ::types::services::Service::new("main".to_string(), "Main Lock".to_string());

    //     // Add lock state characteristic
    //     lock_service.add_characteristic(
    //         ::types::characteristics::Characteristic::new(
    //             "lock_state".to_string(),
    //             CharacteristicType::LockCurrentState,
    //             Format::Uint8,
    //         )
    //         .with_permissions(Permissions {
    //             readable: true,
    //             writable: false,
    //             notify: true,
    //         })
    //         .with_value(json!(lock.state.locked)),
    //     );

    //     // Add target state characteristic
    //     lock_service.add_characteristic(
    //         ::types::characteristics::Characteristic::new(
    //             "target_state".to_string(),
    //             CharacteristicType::LockTargetState,
    //             Format::Uint8,
    //         )
    //         .with_permissions(Permissions {
    //             readable: true,
    //             writable: true,
    //             notify: true,
    //         })
    //         .with_value(json!(lock.state.target_state)),
    //     );

    //     // Add battery level characteristic
    //     lock_service.add_characteristic(
    //         ::types::characteristics::Characteristic::new(
    //             "battery".to_string(),
    //             CharacteristicType::BatteryLevel,
    //             Format::Uint8,
    //         )
    //         .with_permissions(Permissions {
    //             readable: true,
    //             writable: false,
    //             notify: true,
    //         })
    //         .with_unit(Unit::Percentage)
    //         .with_value(json!(lock.state.battery_level))
    //         .with_min_value(json!(0))
    //         .with_max_value(json!(100))
    //         .with_step_value(json!(1)),
    //     );

    //     accessory.add_service(lock_service);
    //     accessory
    // }
}

#[async_trait]
impl ProtocolHandler for AqaraProtocol {
    fn protocol_name(&self) -> &'static str {
        "aqara"
    }

    async fn start_discovery(&self) -> Result<()> {
        info!("Starting Aqara lock discovery...");
        Ok(())
    }

    async fn stop_discovery(&self) -> Result<()> {
        info!("Stopping Aqara lock discovery...");
        Ok(())
    }

    async fn connect(&self, accessory: &Accessory) -> Result<()> {
        debug!("Connecting to Aqara lock: {}", accessory.id);
        Ok(())
    }

    async fn disconnect(&self, accessory: &Accessory) -> Result<()> {
        debug!("Disconnecting from Aqara lock: {}", accessory.id);
        Ok(())
    }

    async fn send_command(&self, accessory: &Accessory, command: Command) -> Result<()> {
        let lock_id = accessory
            .id
            .strip_prefix("aqara_")
            .ok_or_else(|| ProtocolError::CommandError("Invalid Aqara lock ID".to_string()))?;

        match (
            command.service_id.as_str(),
            command.characteristic_id.as_str(),
        ) {
            ("main", "target_state") => {
                let target_state = command.value.as_u64().ok_or_else(|| {
                    ProtocolError::CommandError("Invalid target state value".to_string())
                })?;

                self.api.set_lock_state(lock_id, target_state == 1).await?;
            }
            _ => {
                return Err(ProtocolError::CommandError("Unsupported command".to_string()).into());
            }
        }

        Ok(())
    }

    async fn get_state(&self, accessory: &Accessory) -> Result<Vec<AccessoryEvent>> {
        let lock_id = accessory
            .id
            .strip_prefix("aqara_")
            .ok_or_else(|| ProtocolError::StateError("Invalid Aqara lock ID".to_string()))?;

        let lock = self.api.get_lock(lock_id).await?;
        let mut events = Vec::new();

        // Add lock state
        events.push(AccessoryEvent {
            accessory_id: accessory.id.clone(),
            service_id: "main".to_string(),
            characteristic_id: "lock_state".to_string(),
            value: json!(lock.state.locked),
            is_response: false,
        });

        // Add target state
        events.push(AccessoryEvent {
            accessory_id: accessory.id.clone(),
            service_id: "main".to_string(),
            characteristic_id: "target_state".to_string(),
            value: json!(lock.state.target_state),
            is_response: false,
        });

        // Add battery level
        events.push(AccessoryEvent {
            accessory_id: accessory.id.clone(),
            service_id: "main".to_string(),
            characteristic_id: "battery".to_string(),
            value: json!(lock.state.battery_level),
            is_response: false,
        });

        Ok(events)
    }

    async fn subscribe_to_events(
        &self,
        accessory: &Accessory,
        tx: broadcast::Sender<AccessoryEvent>,
    ) -> Result<()> {
        // Aqara doesn't support real-time events, so we'll poll periodically
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

                tokio::time::sleep(std::time::Duration::from_secs(5)).await;
            }
        });

        Ok(())
    }

    async fn identify(&self, accessory: &Accessory) -> Result<()> {
        let lock_id = accessory
            .id
            .strip_prefix("aqara_")
            .ok_or_else(|| ProtocolError::CommandError("Invalid Aqara lock ID".to_string()))?;

        // Toggle the lock twice
        for _ in 0..2 {
            self.api.set_lock_state(lock_id, true).await?;
            tokio::time::sleep(std::time::Duration::from_secs(2)).await;
            self.api.set_lock_state(lock_id, false).await?;
            tokio::time::sleep(std::time::Duration::from_secs(2)).await;
        }

        Ok(())
    }
}

impl Clone for AqaraProtocol {
    fn clone(&self) -> Self {
        Self {
            config: self.config.clone(),
            api: self.api.clone(),
        }
    }
}

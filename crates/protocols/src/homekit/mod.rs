// use async_trait::async_trait;
// use hap::{
//     accessory::{AccessoryCategory, AccessoryInformation},
//     characteristic::{CharacteristicType, CharacteristicValue},
//     server::{IpServer, Server},
//     storage::FileStorage,
//     Config, MacAddress, Pin,
// };
// use miette::{IntoDiagnostic, Result};
// use std::sync::Arc;
// use tokio::sync::broadcast;
// use tokio::sync::RwLock;
// use tracing::{debug, error};
// use tracing::{info, warn};
// use types::{
//     homekit::{HomeKitDevice, HomeKitDeviceConfig},
//     AccessoryEvent, Command, Protocol, ProtocolHandler,
// };
// use uuid::Uuid;

// mod bridge;
// mod config;
// mod discovery;

// use self::{bridge::HomekitBridge, config::HomeKitConfig};

// pub struct HomeKitProtocol {
//     config: Arc<RwLock<HomeKitConfig>>,
//     bridge: Arc<HomekitBridge>,
// }

// impl HomeKitProtocol {
//     pub async fn new(config_dir: &str) -> Result<Self> {
//         let config = HomeKitConfig::load(config_dir).await?;
//         let bridge = HomekitBridge::new(config_dir, &config).await?;

//         Ok(Self {
//             config: Arc::new(RwLock::new(config)),
//             bridge: Arc::new(bridge),
//         })
//     }

//     pub async fn add_device(&self, device_config: HomeKitDeviceConfig) -> Result<HomeKitDevice> {
//         let device = self.bridge.add_device(&device_config).await?;

//         // Update config with new device
//         let mut config = self.config.write().await;
//         config.devices.insert(device.id.clone(), device_config);
//         config.save().await?;

//         Ok(device)
//     }

//     pub async fn remove_device(&self, device_id: &str) -> Result<()> {
//         self.bridge.remove_device(device_id).await?;

//         // Remove from config
//         let mut config = self.config.write().await;
//         config.devices.remove(device_id);
//         config.save().await?;

//         Ok(())
//     }

//     pub async fn get_device(&self, device_id: &str) -> Result<Option<HomeKitDevice>> {
//         self.bridge.get_device(device_id).await
//     }

//     pub async fn get_devices(&self) -> Result<Vec<HomeKitDevice>> {
//         self.bridge.get_devices().await
//     }
// }

// #[async_trait]
// impl ProtocolHandler for HomeKitProtocol {
//     fn protocol_name(&self) -> &'static str {
//         "homekit"
//     }

//     async fn start_discovery(&self) -> Result<()> {
//         info!("Starting HomeKit device discovery...");
//         self.bridge.start_discovery().await
//     }

//     async fn stop_discovery(&self) -> Result<()> {
//         info!("Stopping HomeKit device discovery...");
//         self.bridge.stop_discovery().await
//     }

//     async fn connect(&self, device_id: &str) -> Result<()> {
//         debug!("Connecting to HomeKit device: {}", device_id);
//         self.bridge.connect_device(device_id).await
//     }

//     async fn disconnect(&self, device_id: &str) -> Result<()> {
//         debug!("Disconnecting from HomeKit device: {}", device_id);
//         self.bridge.disconnect_device(device_id).await
//     }

//     async fn send_command(&self, device_id: &str, command: Command) -> Result<()> {
//         self.bridge.send_command(device_id, command).await
//     }

//     async fn get_state(&self, device_id: &str) -> Result<Vec<AccessoryEvent>> {
//         self.bridge.get_device_state(device_id).await
//     }

//     async fn subscribe_to_events(
//         &self,
//         device_id: &str,
//         tx: broadcast::Sender<AccessoryEvent>,
//     ) -> Result<()> {
//         self.bridge.subscribe_to_device_events(device_id, tx).await
//     }

//     async fn identify(&self, device_id: &str) -> Result<()> {
//         self.bridge.identify_device(device_id).await
//     }
// }

// impl Clone for HomeKitProtocol {
//     fn clone(&self) -> Self {
//         Self {
//             config: self.config.clone(),
//             bridge: self.bridge.clone(),
//         }
//     }
// }

// pub struct HomekitBridge {
//     server: Arc<IpServer>,
//     storage: Arc<FileStorage>,
// }

// impl HomekitBridge {
//     pub async fn new(config_dir: &str) -> Result<Self> {
//         // Create storage for HomeKit data
//         let storage = Arc::new(FileStorage::new(config_dir).into_diagnostic()?);

//         // Generate unique MAC address and setup ID if not exists
//         let mac = storage
//             .load_mac()
//             .unwrap_or_else(|_| MacAddress::generate());
//         let setup_id = storage
//             .load_setup_id()
//             .unwrap_or_else(|_| String::from("COVE"));

//         // Create bridge configuration
//         let config = Config {
//             name: "Cove Bridge".into(),
//             category: AccessoryCategory::Bridge,
//             pin: Pin::new("123-45-678")?, // Change this to a secure PIN
//             setup_id,
//             mac,
//         };

//         // Create and start the HAP server
//         let server = Arc::new(IpServer::new(config, storage.clone()).into_diagnostic()?);
//         server.start().await.into_diagnostic()?;

//         Ok(Self { server, storage })
//     }

//     pub async fn add_u100_lock(&self, name: &str, id: &str) -> Result<()> {
//         let lock_aid = Uuid::new_v4().as_u128() as u64;

//         // Create lock accessory
//         let mut lock = hap::accessory::Accessory::new(
//             lock_aid,
//             AccessoryCategory::Lock,
//             AccessoryInformation {
//                 name: name.into(),
//                 manufacturer: "Aqara".into(),
//                 model: "U100".into(),
//                 serial_number: id.into(),
//                 firmware_revision: "1.0".into(),
//             },
//         );

//         // Add Lock Mechanism service
//         let lock_service = hap::service::LockMechanism::new(
//             lock_aid,
//             "Lock Mechanism".into(),
//             CharacteristicValue::Bool(false), // Initial state: locked
//         );
//         lock.add_service(lock_service);

//         // Add Battery service
//         let battery_service = hap::service::BatteryService::new(
//             lock_aid,
//             "Battery".into(),
//             CharacteristicValue::UInt8(100), // Initial battery level
//         );
//         lock.add_service(battery_service);

//         // Add lock to bridge
//         self.server.add_accessory(lock).await.into_diagnostic()?;
//         info!("Added U100 lock {} to HomeKit bridge", name);

//         Ok(())
//     }

//     pub async fn update_lock_state(&self, aid: u64, locked: bool) -> Result<()> {
//         self.server
//             .update_characteristic(
//                 aid,
//                 CharacteristicType::LockCurrentState,
//                 CharacteristicValue::Bool(locked),
//             )
//             .await
//             .into_diagnostic()?;
//         Ok(())
//     }

//     pub async fn update_battery_level(&self, aid: u64, level: u8) -> Result<()> {
//         self.server
//             .update_characteristic(
//                 aid,
//                 CharacteristicType::BatteryLevel,
//                 CharacteristicValue::UInt8(level),
//             )
//             .await
//             .into_diagnostic()?;
//         Ok(())
//     }
// }

// // Handler for lock commands from HomeKit
// pub async fn handle_lock_command(aid: u64, value: CharacteristicValue) -> Result<()> {
//     match value {
//         CharacteristicValue::Bool(locked) => {
//             info!(
//                 "Lock {} command received: {}",
//                 aid,
//                 if locked { "lock" } else { "unlock" }
//             );
//             // Here you would implement the actual command to the U100 lock
//             // For example:
//             // aqara_client.set_lock_state(aid, locked).await?;
//         }
//         _ => warn!("Unexpected lock command value: {:?}", value),
//     }
//     Ok(())
// }

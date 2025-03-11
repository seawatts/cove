// use async_trait::async_trait;
// use miette::Result;
// use protocols::esphome::types::{Entity, StateResponse};
// use protocols::esphome::{ESPHomeProtocol, ESPHomeSensor};
// use std::sync::Arc;
// use tokio::sync::mpsc;
// use types::capabilities::CapabilityEvent;

// pub struct ApolloAir1 {
//     protocol: ESPHomeProtocol<Entity, StateResponse>,
//     event_tx: mpsc::Sender<CapabilityEvent>,
// }

// impl ApolloAir1 {
//     pub fn new(address: String, port: u16, event_tx: mpsc::Sender<CapabilityEvent>) -> Self {
//         Self {
//             protocol: ESPHomeProtocol::new(address, port, event_tx.clone()),
//             event_tx,
//         }
//     }

//     pub async fn connect(&mut self) -> Result<()> {
//         self.protocol.connect().await
//     }

//     pub async fn disconnect(&mut self) -> Result<()> {
//         self.protocol.disconnect().await
//     }

//     pub async fn is_connected(&self) -> bool {
//         self.protocol.is_connected().await
//     }
// }

// #[async_trait]
// impl super::Integration for ApolloAir1 {
//     async fn start(&mut self) -> Result<()> {
//         self.connect().await
//     }

//     async fn stop(&mut self) -> Result<()> {
//         self.disconnect().await
//     }

//     async fn status(&self) -> Result<super::IntegrationStatus> {
//         if self.is_connected().await {
//             Ok(super::IntegrationStatus::Connected)
//         } else {
//             Ok(super::IntegrationStatus::Disconnected)
//         }
//     }
// }

// // Factory function to create a new Apollo Air-1 instance
// pub fn create_apollo_air_1(
//     name: String,
//     address: String,
//     port: u16,
//     event_tx: mpsc::Sender<CapabilityEvent>,
// ) -> Result<Arc<ApolloAir1>> {
//     Ok(Arc::new(ApolloAir1::new(address, port, event_tx)))
// }

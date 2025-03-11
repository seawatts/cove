use async_trait::async_trait;
use miette::Result;
use std::future::Future;
use tokio::sync::mpsc;

use crate::proto::api::{
    ConnectResponse, DeviceInfoResponse, HelloResponse, ListEntitiesDoneResponse, PingResponse,
    SubscribeLogsResponse,
};
use crate::types::{Entity, StateResponse};

/// Core trait defining the ESPHome device API capabilities
#[async_trait]
pub trait ESPHomeApi {
    /// Initialize connection with hello handshake
    async fn hello(&mut self) -> Result<HelloResponse>;

    /// Connect to the ESPHome device
    async fn connect(&mut self) -> Result<ConnectResponse>;

    /// Disconnect from the ESPHome device
    async fn disconnect(&mut self) -> Result<()>;

    /// Check connection with ping
    async fn ping(&mut self) -> Result<PingResponse>;

    /// Get device information
    async fn device_info(&mut self) -> Result<DeviceInfoResponse>;
}

/// Trait for entity discovery and management
#[async_trait]
pub trait EntityManagement {
    /// List all entities from the device
    async fn list_entities(&mut self) -> Result<Vec<Entity>>;

    /// List specific entity type (e.g., binary sensors)
    async fn list_entity_type(&mut self) -> Result<ListEntitiesDoneResponse>;
}

/// Trait for state management and subscriptions
#[async_trait]
pub trait StateManagement {
    /// Subscribe to state updates
    async fn subscribe_states<F, Fut>(&mut self, callback: F) -> Result<()>
    where
        F: Fn(Entity, StateResponse) -> Fut + Send + Sync + 'static,
        Fut: Future<Output = ()> + Send + 'static;

    /// Unsubscribe from state updates
    fn unsubscribe_states(&mut self);
}

/// Trait for log management
#[async_trait]
pub trait LogManagement {
    /// Subscribe to device logs
    async fn subscribe_logs(
        &mut self,
        level: Option<i32>,
    ) -> Result<mpsc::Receiver<SubscribeLogsResponse>>;

    /// Unsubscribe from logs
    fn unsubscribe_logs(&mut self);
}

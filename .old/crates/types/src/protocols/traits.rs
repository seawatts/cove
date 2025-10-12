use async_trait::async_trait;
use miette::Result;
use serde_json::Value;
use tokio::sync::broadcast;

use crate::accessories::Accessory;

/// Represents a command to be sent to an accessory
#[derive(Debug, Clone)]
pub struct Command {
    /// The service ID to send the command to
    pub service_id: String,

    /// The characteristic ID to update
    pub characteristic_id: String,

    /// The new value to set
    pub value: Value,
}

/// Represents an event from an accessory
#[derive(Debug, Clone)]
pub struct AccessoryEvent {
    /// The accessory that generated the event
    pub accessory_id: String,

    /// The service that generated the event
    pub service_id: String,

    /// The characteristic that changed
    pub characteristic_id: String,

    /// The new value
    pub value: Value,

    /// Whether this was a response to a command
    pub is_response: bool,
}

/// Trait that defines how to communicate with accessories using a specific protocol
#[async_trait]
pub trait ProtocolHandler: Send + Sync {
    /// Returns the name of this protocol
    fn protocol_name(&self) -> &'static str;

    /// Starts discovery of accessories using this protocol
    async fn start_discovery(&self) -> Result<()>;

    /// Stops discovery of accessories
    async fn stop_discovery(&self) -> Result<()>;

    /// Connects to an accessory
    async fn connect(&self, accessory: &Accessory) -> Result<()>;

    /// Disconnects from an accessory
    async fn disconnect(&self, accessory: &Accessory) -> Result<()>;

    /// Sends a command to an accessory
    async fn send_command(&self, accessory: &Accessory, command: Command) -> Result<()>;

    /// Gets the current state of an accessory
    async fn get_state(&self, accessory: &Accessory) -> Result<Vec<AccessoryEvent>>;

    /// Subscribes to state changes from an accessory
    async fn subscribe_to_events(
        &self,
        accessory: &Accessory,
        tx: broadcast::Sender<AccessoryEvent>,
    ) -> Result<()>;

    /// Identifies an accessory (e.g., makes it flash or beep)
    async fn identify(&self, accessory: &Accessory) -> Result<()>;
}

/// Trait for protocol-specific accessory configuration
pub trait ProtocolConfig {
    /// Returns the protocol-specific configuration for an accessory
    fn get_config(&self) -> Value;

    /// Updates the protocol-specific configuration for an accessory
    fn update_config(&mut self, config: Value) -> Result<()>;
}

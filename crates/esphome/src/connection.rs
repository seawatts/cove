use crate::proto::api::{
    ConnectRequest, ConnectResponse, DeviceInfoRequest, DeviceInfoResponse, DisconnectRequest,
    DisconnectResponse, HelloRequest, HelloResponse, ListEntitiesBinarySensorResponse,
    ListEntitiesDoneResponse, ListEntitiesRequest, PingRequest, PingResponse, SubscribeLogsRequest,
    SubscribeLogsResponse, SubscribeStatesRequest,
};
use crate::proto::MessageType;
use crate::protocol::{ESPHomeProtocolClient, ProtocolError};

use bytes::Bytes;
use miette::{Diagnostic, Result};
use prost::Message;
use thiserror::Error;
use tokio::sync::mpsc;

#[derive(Debug, Error, Diagnostic)]
pub enum ESPHomeError {
    #[error("Connection error: {0}")]
    ConnectionError(String),

    #[error("Authentication error: {0}")]
    AuthenticationError(String),

    #[error("Communication error: {0}")]
    CommunicationError(String),

    #[error("Protocol error: {0}")]
    ProtocolError(#[from] ProtocolError),
}

/// ESPHome API connection client
pub struct ESPHomeConnection {
    /// Protocol client for low-level communication
    protocol: ESPHomeProtocolClient,
    /// Optional password for authentication
    password: Option<String>,
    /// Whether the connection is established
    pub connected: bool,
}

impl ESPHomeConnection {
    /// Create a new ESPHome API connection
    pub async fn new(address: impl Into<String>, password: Option<String>) -> Result<Self> {
        Ok(Self {
            protocol: ESPHomeProtocolClient::new(address.into()),
            password,
            connected: false,
        })
    }

    /// Initialize the connection by sending a hello request
    pub async fn hello(&mut self) -> Result<HelloResponse> {
        let request = HelloRequest {
            client_info: "Rust ESPHome Client".to_string(),
            api_version_major: 1,
            api_version_minor: 9,
        };

        self.protocol
            .send_and_receive(MessageType::HelloRequest, &request)
            .await
    }

    /// Connect to the ESPHome device
    pub async fn connect(&mut self) -> Result<ConnectResponse> {
        let password = self.password.clone().unwrap_or_default();
        let request = ConnectRequest { password };

        let response: ConnectResponse = self
            .protocol
            .send_and_receive(MessageType::ConnectRequest, &request)
            .await?;

        if response.invalid_password {
            return Err(ESPHomeError::AuthenticationError("Invalid password".into()).into());
        }

        self.connected = true;
        Ok(response)
    }

    /// Disconnect from the ESPHome device
    pub async fn disconnect(&mut self) -> Result<DisconnectResponse> {
        let request = DisconnectRequest {};

        let response = self
            .protocol
            .send_and_receive(MessageType::DisconnectRequest, &request)
            .await?;

        self.connected = false;
        self.protocol.close();

        Ok(response)
    }

    /// Send a ping request to check connectivity
    pub async fn ping(&mut self) -> Result<PingResponse> {
        if !self.connected {
            return Err(ProtocolError::ConnectionError("Not connected".into()).into());
        }

        let request = PingRequest {};
        self.protocol
            .send_and_receive(MessageType::PingRequest, &request)
            .await
    }

    /// Get device information
    pub async fn device_info(&mut self) -> Result<DeviceInfoResponse> {
        let request = DeviceInfoRequest {};
        self.protocol
            .send_and_receive(MessageType::DeviceInfoRequest, &request)
            .await
    }

    /// Subscribe to state updates
    pub async fn subscribe_states(&mut self) -> Result<()> {
        if !self.connected {
            return Err(ProtocolError::ConnectionError("Not connected".into()).into());
        }

        let request = SubscribeStatesRequest {};
        self.protocol
            .send(MessageType::SubscribeStatesRequest, &request)
            .await
    }

    /// Subscribe to logs with a callback for receiving log messages
    pub async fn subscribe_logs(
        &mut self,
        level: Option<i32>,
    ) -> Result<mpsc::Receiver<SubscribeLogsResponse>> {
        if !self.connected {
            return Err(ProtocolError::ConnectionError("Not connected".into()).into());
        }

        // Send the subscription request first
        let request = SubscribeLogsRequest {
            level: level.unwrap_or(0),
            dump_config: false,
        };

        self.protocol
            .send(MessageType::SubscribeLogsRequest, &request)
            .await?;

        // Register a callback for the log responses
        let logs_rx = self
            .protocol
            .register_callback(MessageType::SubscribeLogsResponse)
            .await?;

        // Create a new channel with decoded messages
        let (tx, rx) = mpsc::channel::<SubscribeLogsResponse>(32);

        // Spawn a task to decode the messages and forward them
        tokio::spawn(async move {
            let mut logs_rx = logs_rx; // Make it mutable in this scope
            while let Some(data) = logs_rx.recv().await {
                match SubscribeLogsResponse::decode(data) {
                    Ok(log_msg) => {
                        // Try to send the decoded message, ignore errors (e.g. if receiver dropped)
                        let _ = tx.send(log_msg).await;
                    }
                    Err(e) => {
                        eprintln!("Failed to decode log message: {}", e);
                    }
                }
            }
        });

        Ok(rx)
    }

    /// Unsubscribe from log messages
    pub fn unsubscribe_logs(&mut self) {
        self.protocol
            .remove_callbacks(MessageType::SubscribeLogsResponse);
    }

    pub async fn list_binary_sensors(&mut self) -> Result<ListEntitiesDoneResponse> {
        if !self.connected {
            return Err(ProtocolError::ConnectionError("Not connected".into()).into());
        }

        let request = ListEntitiesRequest {};

        let response = self
            .protocol
            .send_and_receive(MessageType::ListEntitiesRequest, &request)
            .await?;

        Ok(response)
    }
}

impl Drop for ESPHomeConnection {
    fn drop(&mut self) {
        self.protocol.close();
    }
}

/// Builder for ESPHomeConnection
pub struct ESPHomeConnectionBuilder {
    address: String,
    password: Option<String>,
}

impl ESPHomeConnectionBuilder {
    /// Create a new ESPHomeConnectionBuilder
    pub fn new(address: impl Into<String>) -> Self {
        Self {
            address: address.into(),
            password: None,
        }
    }

    /// Set the password for authentication
    pub fn password(mut self, password: impl Into<String>) -> Self {
        self.password = Some(password.into());
        self
    }

    /// Build the ESPHomeConnection
    pub async fn build(self) -> Result<ESPHomeConnection> {
        ESPHomeConnection::new(self.address, self.password).await
    }

    /// Build and connect to the ESPHome device
    pub async fn connect(self) -> Result<ESPHomeConnection> {
        let mut connection = ESPHomeConnection::new(self.address, self.password).await?;
        connection.hello().await?;
        connection.connect().await?;
        Ok(connection)
    }
}

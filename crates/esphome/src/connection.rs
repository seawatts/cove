use async_trait::async_trait;
use bytes::Bytes;
use miette::Result;
use prost::Message;
use tokio::sync::mpsc;
use tokio::task::JoinHandle;

use crate::error::ESPHomeError;
use crate::proto::api::{
    ConnectRequest, ConnectResponse, DeviceInfoRequest, DeviceInfoResponse, DisconnectRequest,
    HelloRequest, HelloResponse, ListEntitiesDoneResponse, ListEntitiesRequest, PingRequest,
    PingResponse, SubscribeLogsRequest, SubscribeLogsResponse, SubscribeStatesRequest,
};
use crate::proto::MessageType;
use crate::protocol::ESPHomeProtocolClient;
use crate::traits::{ESPHomeApi, EntityManagement, LogManagement, StateManagement};
use crate::types::{ESPHomeConfig, Entity, StateResponse};

/// ESPHome API connection client
pub struct ESPHomeConnection {
    /// Protocol client for low-level communication
    protocol: ESPHomeProtocolClient,
    /// Connection configuration
    config: ESPHomeConfig,
    /// Whether the connection is established
    pub connected: bool,
}

#[async_trait]
impl ESPHomeApi for ESPHomeConnection {
    async fn hello(&mut self) -> Result<HelloResponse> {
        let request = HelloRequest {
            client_info: "Rust ESPHome Client".to_string(),
            api_version_major: 1,
            api_version_minor: 9,
        };

        self.protocol
            .send_and_receive::<_, HelloResponse>(MessageType::HelloRequest, &request)
            .await
    }

    async fn connect(&mut self) -> Result<ConnectResponse> {
        let password = self.config.password.clone().unwrap_or_default();
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

    async fn disconnect(&mut self) -> Result<()> {
        let request = DisconnectRequest {};

        let _response = self
            .protocol
            .send_and_receive(MessageType::DisconnectRequest, &request)
            .await?;

        self.connected = false;
        self.protocol.close();

        Ok(())
    }

    async fn ping(&mut self) -> Result<PingResponse> {
        if !self.connected {
            return Err(ESPHomeError::ConnectionError("Not connected".into()).into());
        }

        let request = PingRequest {};
        self.protocol
            .send_and_receive(MessageType::PingRequest, &request)
            .await
    }

    async fn device_info(&mut self) -> Result<DeviceInfoResponse> {
        let request = DeviceInfoRequest {};
        self.protocol
            .send_and_receive(MessageType::DeviceInfoRequest, &request)
            .await
    }
}

#[async_trait]
impl EntityManagement for ESPHomeConnection {
    async fn list_entities(&mut self) -> Result<Vec<Entity>> {
        if !self.connected {
            return Err(ESPHomeError::ConnectionError("Not connected".into()).into());
        }

        let (tx, mut rx) = mpsc::channel::<Entity>(32);
        self.register_entity_callbacks(&tx).await?;

        // Get done_rx separately to handle in main loop
        let mut done_rx = self
            .protocol
            .register_callback(MessageType::ListEntitiesDoneResponse)
            .await?;

        let request = ListEntitiesRequest {};
        self.protocol
            .send(MessageType::ListEntitiesRequest, &request)
            .await?;

        let mut entities = Vec::new();
        let timeout = tokio::time::sleep(self.config.timeout);
        tokio::pin!(timeout);

        loop {
            tokio::select! {
                Some(entity) = rx.recv() => {
                    entities.push(entity);
                }
                Some(_) = done_rx.recv() => {
                    // We received the done signal, clean up and return
                    self.cleanup_entity_callbacks();
                    return Ok(entities);
                }
                _ = &mut timeout => {
                    self.cleanup_entity_callbacks();
                    return Err(ESPHomeError::TimeoutError("Timed out waiting for entities".into()).into());
                }
                else => {
                    // All channels closed unexpectedly
                    self.cleanup_entity_callbacks();
                    return Err(ESPHomeError::CommunicationError("Entity discovery channels closed unexpectedly".into()).into());
                }
            }
        }
    }

    async fn list_entity_type(&mut self) -> Result<ListEntitiesDoneResponse> {
        if !self.connected {
            return Err(ESPHomeError::ConnectionError("Not connected".into()).into());
        }

        let request = ListEntitiesRequest {};
        self.protocol
            .send_and_receive(MessageType::ListEntitiesRequest, &request)
            .await
    }
}

#[async_trait]
impl StateManagement for ESPHomeConnection {
    async fn subscribe_states(&mut self) -> Result<mpsc::Receiver<StateResponse>> {
        if !self.connected {
            return Err(ESPHomeError::ConnectionError("Not connected".into()).into());
        }

        let request = SubscribeStatesRequest {};
        self.protocol
            .send(MessageType::SubscribeStatesRequest, &request)
            .await?;

        let (tx, rx) = mpsc::channel::<StateResponse>(32);
        self.register_state_callbacks(&tx).await?;

        Ok(rx)
    }

    fn unsubscribe_states(&mut self) {
        self.cleanup_state_callbacks();
    }
}

#[async_trait]
impl LogManagement for ESPHomeConnection {
    async fn subscribe_logs(
        &mut self,
        level: Option<i32>,
    ) -> Result<mpsc::Receiver<SubscribeLogsResponse>> {
        if !self.connected {
            return Err(ESPHomeError::ConnectionError("Not connected".into()).into());
        }

        let request = SubscribeLogsRequest {
            level: level.unwrap_or(0),
            dump_config: false,
        };

        self.protocol
            .send(MessageType::SubscribeLogsRequest, &request)
            .await?;

        let logs_rx = self
            .protocol
            .register_callback(MessageType::SubscribeLogsResponse)
            .await?;

        let (tx, rx) = mpsc::channel::<SubscribeLogsResponse>(32);

        tokio::spawn(async move {
            let mut logs_rx = logs_rx;
            while let Some(data) = logs_rx.recv().await {
                if let Ok(log_msg) = SubscribeLogsResponse::decode(data) {
                    let _ = tx.send(log_msg).await;
                }
            }
        });

        Ok(rx)
    }

    fn unsubscribe_logs(&mut self) {
        self.protocol
            .remove_callbacks(MessageType::SubscribeLogsResponse);
    }
}

impl ESPHomeConnection {
    /// Create a new ESPHome API connection
    pub async fn new(config: ESPHomeConfig) -> Result<Self> {
        Ok(Self {
            protocol: ESPHomeProtocolClient::new(config.address.clone()),
            config,
            connected: false,
        })
    }

    /// Helper function to register callbacks for entity responses
    async fn register_entity_callbacks(&mut self, tx: &mpsc::Sender<Entity>) -> Result<()> {
        let binary_sensor_rx = self
            .protocol
            .register_callback(MessageType::ListEntitiesBinarySensorResponse)
            .await?;
        let cover_rx = self
            .protocol
            .register_callback(MessageType::ListEntitiesCoverResponse)
            .await?;
        let fan_rx = self
            .protocol
            .register_callback(MessageType::ListEntitiesFanResponse)
            .await?;
        let light_rx = self
            .protocol
            .register_callback(MessageType::ListEntitiesLightResponse)
            .await?;
        let sensor_rx = self
            .protocol
            .register_callback(MessageType::ListEntitiesSensorResponse)
            .await?;
        let switch_rx = self
            .protocol
            .register_callback(MessageType::ListEntitiesSwitchResponse)
            .await?;
        let text_sensor_rx = self
            .protocol
            .register_callback(MessageType::ListEntitiesTextSensorResponse)
            .await?;
        let climate_rx = self
            .protocol
            .register_callback(MessageType::ListEntitiesClimateResponse)
            .await?;
        let camera_rx = self
            .protocol
            .register_callback(MessageType::ListEntitiesCameraResponse)
            .await?;
        let number_rx = self
            .protocol
            .register_callback(MessageType::ListEntitiesNumberResponse)
            .await?;
        let select_rx = self
            .protocol
            .register_callback(MessageType::ListEntitiesSelectResponse)
            .await?;
        let siren_rx = self
            .protocol
            .register_callback(MessageType::ListEntitiesSirenResponse)
            .await?;
        let lock_rx = self
            .protocol
            .register_callback(MessageType::ListEntitiesLockResponse)
            .await?;
        let button_rx = self
            .protocol
            .register_callback(MessageType::ListEntitiesButtonResponse)
            .await?;
        let media_player_rx = self
            .protocol
            .register_callback(MessageType::ListEntitiesMediaPlayerResponse)
            .await?;
        let event_rx = self
            .protocol
            .register_callback(MessageType::ListEntitiesEventResponse)
            .await?;
        let alarm_control_panel_rx = self
            .protocol
            .register_callback(MessageType::ListEntitiesAlarmControlPanelResponse)
            .await?;
        let date_rx = self
            .protocol
            .register_callback(MessageType::ListEntitiesDateResponse)
            .await?;
        let datetime_rx = self
            .protocol
            .register_callback(MessageType::ListEntitiesDateTimeResponse)
            .await?;
        let text_rx = self
            .protocol
            .register_callback(MessageType::ListEntitiesTextResponse)
            .await?;
        let time_rx = self
            .protocol
            .register_callback(MessageType::ListEntitiesTimeResponse)
            .await?;
        let valve_rx = self
            .protocol
            .register_callback(MessageType::ListEntitiesValveResponse)
            .await?;
        let update_rx = self
            .protocol
            .register_callback(MessageType::ListEntitiesUpdateResponse)
            .await?;

        // Spawn handlers for all entity types
        spawn_entity_handler(binary_sensor_rx, tx.clone(), Entity::BinarySensor);
        spawn_entity_handler(cover_rx, tx.clone(), Entity::Cover);
        spawn_entity_handler(fan_rx, tx.clone(), Entity::Fan);
        spawn_entity_handler(light_rx, tx.clone(), Entity::Light);
        spawn_entity_handler(sensor_rx, tx.clone(), Entity::Sensor);
        spawn_entity_handler(switch_rx, tx.clone(), Entity::Switch);
        spawn_entity_handler(text_sensor_rx, tx.clone(), Entity::TextSensor);
        spawn_entity_handler(climate_rx, tx.clone(), Entity::Climate);
        spawn_entity_handler(camera_rx, tx.clone(), Entity::Camera);
        spawn_entity_handler(number_rx, tx.clone(), Entity::Number);
        spawn_entity_handler(select_rx, tx.clone(), Entity::Select);
        spawn_entity_handler(siren_rx, tx.clone(), Entity::Siren);
        spawn_entity_handler(lock_rx, tx.clone(), Entity::Lock);
        spawn_entity_handler(button_rx, tx.clone(), Entity::Button);
        spawn_entity_handler(media_player_rx, tx.clone(), Entity::MediaPlayer);
        spawn_entity_handler(event_rx, tx.clone(), Entity::Event);
        spawn_entity_handler(
            alarm_control_panel_rx,
            tx.clone(),
            Entity::AlarmControlPanel,
        );
        spawn_entity_handler(date_rx, tx.clone(), Entity::Date);
        spawn_entity_handler(datetime_rx, tx.clone(), Entity::DateTime);
        spawn_entity_handler(text_rx, tx.clone(), Entity::Text);
        spawn_entity_handler(time_rx, tx.clone(), Entity::Time);
        spawn_entity_handler(valve_rx, tx.clone(), Entity::Valve);
        spawn_entity_handler(update_rx, tx.clone(), Entity::Update);

        Ok(())
    }

    /// Helper function to register callbacks for state responses
    async fn register_state_callbacks(&mut self, tx: &mpsc::Sender<StateResponse>) -> Result<()> {
        let alarm_control_panel_rx = self
            .protocol
            .register_callback(MessageType::AlarmControlPanelStateResponse)
            .await?;
        let binary_sensor_rx = self
            .protocol
            .register_callback(MessageType::BinarySensorStateResponse)
            .await?;
        let climate_rx = self
            .protocol
            .register_callback(MessageType::ClimateStateResponse)
            .await?;
        let cover_rx = self
            .protocol
            .register_callback(MessageType::CoverStateResponse)
            .await?;
        let date_rx = self
            .protocol
            .register_callback(MessageType::DateStateResponse)
            .await?;
        let datetime_rx = self
            .protocol
            .register_callback(MessageType::DateTimeStateResponse)
            .await?;
        let fan_rx = self
            .protocol
            .register_callback(MessageType::FanStateResponse)
            .await?;
        let light_rx = self
            .protocol
            .register_callback(MessageType::LightStateResponse)
            .await?;
        let lock_rx = self
            .protocol
            .register_callback(MessageType::LockStateResponse)
            .await?;
        let media_player_rx = self
            .protocol
            .register_callback(MessageType::MediaPlayerStateResponse)
            .await?;
        let number_rx = self
            .protocol
            .register_callback(MessageType::NumberStateResponse)
            .await?;
        let select_rx = self
            .protocol
            .register_callback(MessageType::SelectStateResponse)
            .await?;
        let sensor_rx = self
            .protocol
            .register_callback(MessageType::SensorStateResponse)
            .await?;
        let siren_rx = self
            .protocol
            .register_callback(MessageType::SirenStateResponse)
            .await?;
        let switch_rx = self
            .protocol
            .register_callback(MessageType::SwitchStateResponse)
            .await?;
        let text_rx = self
            .protocol
            .register_callback(MessageType::TextStateResponse)
            .await?;
        let text_sensor_rx = self
            .protocol
            .register_callback(MessageType::TextSensorStateResponse)
            .await?;
        let time_rx = self
            .protocol
            .register_callback(MessageType::TimeStateResponse)
            .await?;
        let update_rx = self
            .protocol
            .register_callback(MessageType::UpdateStateResponse)
            .await?;
        let valve_rx = self
            .protocol
            .register_callback(MessageType::ValveStateResponse)
            .await?;

        spawn_state_handler(
            alarm_control_panel_rx,
            tx.clone(),
            StateResponse::AlarmControlPanel,
        );
        spawn_state_handler(binary_sensor_rx, tx.clone(), StateResponse::BinarySensor);
        spawn_state_handler(climate_rx, tx.clone(), StateResponse::Climate);
        spawn_state_handler(cover_rx, tx.clone(), StateResponse::Cover);
        spawn_state_handler(date_rx, tx.clone(), StateResponse::Date);
        spawn_state_handler(datetime_rx, tx.clone(), StateResponse::DateTime);
        spawn_state_handler(fan_rx, tx.clone(), StateResponse::Fan);
        spawn_state_handler(light_rx, tx.clone(), StateResponse::Light);
        spawn_state_handler(lock_rx, tx.clone(), StateResponse::Lock);
        spawn_state_handler(media_player_rx, tx.clone(), StateResponse::MediaPlayer);
        spawn_state_handler(number_rx, tx.clone(), StateResponse::Number);
        spawn_state_handler(select_rx, tx.clone(), StateResponse::Select);
        spawn_state_handler(sensor_rx, tx.clone(), StateResponse::Sensor);
        spawn_state_handler(siren_rx, tx.clone(), StateResponse::Siren);
        spawn_state_handler(switch_rx, tx.clone(), StateResponse::Switch);
        spawn_state_handler(text_rx, tx.clone(), StateResponse::Text);
        spawn_state_handler(text_sensor_rx, tx.clone(), StateResponse::TextSensor);
        spawn_state_handler(time_rx, tx.clone(), StateResponse::Time);
        spawn_state_handler(update_rx, tx.clone(), StateResponse::Update);
        spawn_state_handler(valve_rx, tx.clone(), StateResponse::Valve);

        Ok(())
    }

    /// Helper function to clean up entity callbacks
    fn cleanup_entity_callbacks(&mut self) {
        self.protocol
            .remove_callbacks(MessageType::ListEntitiesBinarySensorResponse);
        self.protocol
            .remove_callbacks(MessageType::ListEntitiesCoverResponse);
        self.protocol
            .remove_callbacks(MessageType::ListEntitiesFanResponse);
        self.protocol
            .remove_callbacks(MessageType::ListEntitiesLightResponse);
        self.protocol
            .remove_callbacks(MessageType::ListEntitiesSensorResponse);
        self.protocol
            .remove_callbacks(MessageType::ListEntitiesSwitchResponse);
        self.protocol
            .remove_callbacks(MessageType::ListEntitiesTextSensorResponse);
        self.protocol
            .remove_callbacks(MessageType::ListEntitiesClimateResponse);
        self.protocol
            .remove_callbacks(MessageType::ListEntitiesCameraResponse);
        self.protocol
            .remove_callbacks(MessageType::ListEntitiesNumberResponse);
        self.protocol
            .remove_callbacks(MessageType::ListEntitiesSelectResponse);
        self.protocol
            .remove_callbacks(MessageType::ListEntitiesSirenResponse);
        self.protocol
            .remove_callbacks(MessageType::ListEntitiesLockResponse);
        self.protocol
            .remove_callbacks(MessageType::ListEntitiesButtonResponse);
        self.protocol
            .remove_callbacks(MessageType::ListEntitiesMediaPlayerResponse);
        self.protocol
            .remove_callbacks(MessageType::ListEntitiesEventResponse);
        self.protocol
            .remove_callbacks(MessageType::ListEntitiesAlarmControlPanelResponse);
        self.protocol
            .remove_callbacks(MessageType::ListEntitiesDateResponse);
        self.protocol
            .remove_callbacks(MessageType::ListEntitiesDateTimeResponse);
        self.protocol
            .remove_callbacks(MessageType::ListEntitiesTextResponse);
        self.protocol
            .remove_callbacks(MessageType::ListEntitiesTimeResponse);
        self.protocol
            .remove_callbacks(MessageType::ListEntitiesValveResponse);
        self.protocol
            .remove_callbacks(MessageType::ListEntitiesUpdateResponse);
        self.protocol
            .remove_callbacks(MessageType::ListEntitiesDoneResponse);
    }

    /// Helper function to clean up state callbacks
    fn cleanup_state_callbacks(&mut self) {
        self.protocol
            .remove_callbacks(MessageType::AlarmControlPanelStateResponse);
        self.protocol
            .remove_callbacks(MessageType::BinarySensorStateResponse);
        self.protocol
            .remove_callbacks(MessageType::ClimateStateResponse);
        self.protocol
            .remove_callbacks(MessageType::CoverStateResponse);
        self.protocol
            .remove_callbacks(MessageType::DateStateResponse);
        self.protocol
            .remove_callbacks(MessageType::DateTimeStateResponse);
        self.protocol
            .remove_callbacks(MessageType::FanStateResponse);
        self.protocol
            .remove_callbacks(MessageType::LightStateResponse);
        self.protocol
            .remove_callbacks(MessageType::LockStateResponse);
        self.protocol
            .remove_callbacks(MessageType::MediaPlayerStateResponse);
        self.protocol
            .remove_callbacks(MessageType::NumberStateResponse);
        self.protocol
            .remove_callbacks(MessageType::SelectStateResponse);
        self.protocol
            .remove_callbacks(MessageType::SensorStateResponse);
        self.protocol
            .remove_callbacks(MessageType::SirenStateResponse);
        self.protocol
            .remove_callbacks(MessageType::SwitchStateResponse);
        self.protocol
            .remove_callbacks(MessageType::TextStateResponse);
        self.protocol
            .remove_callbacks(MessageType::TextSensorStateResponse);
        self.protocol
            .remove_callbacks(MessageType::TimeStateResponse);
        self.protocol
            .remove_callbacks(MessageType::UpdateStateResponse);
        self.protocol
            .remove_callbacks(MessageType::ValveStateResponse);
    }
}

/// Helper function to spawn a task that handles a specific entity type
fn spawn_entity_handler<T: prost::Message + Default + 'static>(
    rx: mpsc::Receiver<Bytes>,
    tx: mpsc::Sender<Entity>,
    mapper: fn(T) -> Entity,
) -> JoinHandle<()> {
    tokio::spawn(async move {
        let mut rx = rx;
        while let Some(data) = rx.recv().await {
            if let Ok(entity) = T::decode(data) {
                let _ = tx.send(mapper(entity)).await;
            }
        }
    })
}

/// Helper function to spawn a task that handles a specific state type
fn spawn_state_handler<T: prost::Message + Default + 'static>(
    rx: mpsc::Receiver<Bytes>,
    tx: mpsc::Sender<StateResponse>,
    mapper: fn(T) -> StateResponse,
) -> JoinHandle<()> {
    tokio::spawn(async move {
        let mut rx = rx;
        while let Some(data) = rx.recv().await {
            if let Ok(state) = T::decode(data) {
                let _ = tx.send(mapper(state)).await;
            }
        }
    })
}

impl Drop for ESPHomeConnection {
    fn drop(&mut self) {
        self.protocol.close();
    }
}

/// Builder for ESPHomeConnection
#[derive(Default)]
pub struct ESPHomeConnectionBuilder {
    config: Option<ESPHomeConfig>,
}

impl ESPHomeConnectionBuilder {
    /// Create a new ESPHomeConnectionBuilder
    pub fn new() -> Self {
        Self { config: None }
    }

    /// Set the configuration
    pub fn config(mut self, config: ESPHomeConfig) -> Self {
        self.config = Some(config);
        self
    }

    /// Build the ESPHomeConnection
    pub async fn build(self) -> Result<ESPHomeConnection> {
        let config = self.config.ok_or_else(|| {
            ESPHomeError::ConnectionError("Configuration not provided".to_string())
        })?;
        ESPHomeConnection::new(config).await
    }

    /// Build and connect to the ESPHome device
    pub async fn connect(self) -> Result<ESPHomeConnection> {
        let mut connection = self.build().await?;
        connection.hello().await?;
        connection.connect().await?;
        Ok(connection)
    }
}

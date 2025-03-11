use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use bytes::{Buf, BufMut, Bytes, BytesMut};
use futures::{SinkExt, StreamExt};
use miette::{Diagnostic, Result};
use prost::Message;
use thiserror::Error;
use tokio::net::TcpStream;
use tokio::sync::{mpsc, oneshot};
use tokio::task::JoinHandle;
use tokio_util::codec::{Decoder, Encoder, Framed};

// Import the MessageType enum and helpers from proto.rs
use crate::proto::MessageType;

/// Error types for ESPHome protocol operations
#[derive(Debug, Error, Diagnostic)]
pub enum ProtocolError {
    #[error("Connection error: {0}")]
    ConnectionError(String),

    #[error("Protocol error: {0}")]
    ProtocolError(String),

    #[error("Communication error: {0}")]
    CommunicationError(String),

    #[error("Decode error: {0}")]
    DecodeError(#[from] prost::DecodeError),

    #[error("Encode error: {0}")]
    EncodeError(#[from] prost::EncodeError),

    #[error("I/O error: {0}")]
    IoError(#[from] std::io::Error),

    #[error("Invalid response: {0}")]
    InvalidResponse(String),
}

impl From<crate::error::Error> for ProtocolError {
    fn from(err: crate::error::Error) -> Self {
        match err {
            crate::error::Error::InvalidResponse(msg) => Self::InvalidResponse(msg),
            _ => Self::ProtocolError(err.to_string()),
        }
    }
}

/// Helper trait to determine if a message type is a response
pub trait IsResponse {
    fn is_response(&self) -> bool;
}

impl IsResponse for MessageType {
    fn is_response(&self) -> bool {
        match self {
            MessageType::HelloResponse
            | MessageType::ConnectResponse
            | MessageType::DisconnectResponse
            | MessageType::PingResponse
            | MessageType::DeviceInfoResponse
            | MessageType::ListEntitiesBinarySensorResponse
            | MessageType::ListEntitiesCoverResponse
            | MessageType::ListEntitiesFanResponse
            | MessageType::ListEntitiesLightResponse
            | MessageType::ListEntitiesSensorResponse
            | MessageType::ListEntitiesSwitchResponse
            | MessageType::ListEntitiesTextSensorResponse
            | MessageType::ListEntitiesDoneResponse
            | MessageType::BinarySensorStateResponse
            | MessageType::CoverStateResponse
            | MessageType::FanStateResponse
            | MessageType::LightStateResponse
            | MessageType::SensorStateResponse
            | MessageType::SwitchStateResponse
            | MessageType::TextSensorStateResponse
            | MessageType::SubscribeLogsResponse
            | MessageType::HomeassistantServiceResponse
            | MessageType::GetTimeResponse
            | MessageType::SubscribeHomeAssistantStateResponse
            | MessageType::HomeAssistantStateResponse
            | MessageType::ListEntitiesServicesResponse
            | MessageType::ListEntitiesCameraResponse
            | MessageType::CameraImageResponse
            | MessageType::ListEntitiesClimateResponse
            | MessageType::ClimateStateResponse
            | MessageType::ListEntitiesNumberResponse
            | MessageType::NumberStateResponse
            | MessageType::ListEntitiesSelectResponse
            | MessageType::SelectStateResponse
            | MessageType::ListEntitiesSirenResponse
            | MessageType::SirenStateResponse
            | MessageType::ListEntitiesLockResponse
            | MessageType::LockStateResponse
            | MessageType::ListEntitiesButtonResponse
            | MessageType::ListEntitiesMediaPlayerResponse
            | MessageType::MediaPlayerStateResponse
            | MessageType::BluetoothLEAdvertisementResponse
            | MessageType::BluetoothDeviceConnectionResponse
            | MessageType::BluetoothGATTGetServicesResponse
            | MessageType::BluetoothGATTGetServicesDoneResponse
            | MessageType::BluetoothGATTReadResponse
            | MessageType::BluetoothGATTNotifyDataResponse
            | MessageType::BluetoothConnectionsFreeResponse
            | MessageType::BluetoothGATTErrorResponse
            | MessageType::BluetoothGATTWriteResponse
            | MessageType::BluetoothGATTNotifyResponse
            | MessageType::BluetoothDevicePairingResponse
            | MessageType::BluetoothDeviceUnpairingResponse
            | MessageType::BluetoothDeviceClearCacheResponse
            | MessageType::VoiceAssistantResponse
            | MessageType::VoiceAssistantEventResponse
            | MessageType::BluetoothLERawAdvertisementsResponse
            | MessageType::ListEntitiesAlarmControlPanelResponse
            | MessageType::AlarmControlPanelStateResponse
            | MessageType::ListEntitiesTextResponse
            | MessageType::TextStateResponse
            | MessageType::ListEntitiesDateResponse
            | MessageType::DateStateResponse
            | MessageType::ListEntitiesTimeResponse
            | MessageType::TimeStateResponse
            | MessageType::VoiceAssistantAudio
            | MessageType::ListEntitiesEventResponse
            | MessageType::EventResponse
            | MessageType::ListEntitiesValveResponse
            | MessageType::ValveStateResponse
            | MessageType::ListEntitiesDateTimeResponse
            | MessageType::DateTimeStateResponse
            | MessageType::VoiceAssistantTimerEventResponse
            | MessageType::ListEntitiesUpdateResponse
            | MessageType::UpdateStateResponse
            | MessageType::VoiceAssistantAnnounceFinished
            | MessageType::VoiceAssistantConfigurationResponse => true,
            _ => false,
        }
    }
}

/// A message frame in the ESPHome protocol
#[derive(Debug)]
pub struct ESPHomeFrame {
    pub msg_type: MessageType,
    pub data: Bytes,
}

/// Codec for encoding and decoding ESPHome protocol frames
pub struct ESPHomeCodec;

impl Decoder for ESPHomeCodec {
    type Item = ESPHomeFrame;
    type Error = ProtocolError;

    fn decode(
        &mut self,
        src: &mut BytesMut,
    ) -> std::result::Result<Option<Self::Item>, Self::Error> {
        // Need at least 1 byte for the preamble
        if src.is_empty() {
            return Ok(None);
        }

        // Check for the zero byte preamble
        if src[0] != 0 {
            // Invalid preamble, discard one byte and try again
            src.advance(1);
            return Err(ProtocolError::ProtocolError("Invalid preamble".into()));
        }

        // Save the current position to revert if we don't have a complete frame
        let original_buf = src.clone();

        // Remove the zero byte
        src.advance(1);

        // Parse message size (VarInt)
        let size = match decode_varuint(src) {
            Some(size) => size,
            None => {
                // Incomplete VarInt, restore buffer and try again later
                *src = original_buf;
                return Ok(None);
            }
        };

        // Parse message type (VarInt)
        let msg_type_val = match decode_varuint(src) {
            Some(msg_type) => msg_type,
            None => {
                // Incomplete VarInt, restore buffer and try again later
                *src = original_buf;
                return Ok(None);
            }
        };

        // Convert to MessageType
        let msg_type = match msg_type_val {
            1 => MessageType::HelloRequest,
            2 => MessageType::HelloResponse,
            3 => MessageType::ConnectRequest,
            4 => MessageType::ConnectResponse,
            5 => MessageType::DisconnectRequest,
            6 => MessageType::DisconnectResponse,
            7 => MessageType::PingRequest,
            8 => MessageType::PingResponse,
            9 => MessageType::DeviceInfoRequest,
            10 => MessageType::DeviceInfoResponse,
            11 => MessageType::ListEntitiesRequest,
            12 => MessageType::ListEntitiesBinarySensorResponse,
            13 => MessageType::ListEntitiesCoverResponse,
            14 => MessageType::ListEntitiesFanResponse,
            15 => MessageType::ListEntitiesLightResponse,
            16 => MessageType::ListEntitiesSensorResponse,
            17 => MessageType::ListEntitiesSwitchResponse,
            18 => MessageType::ListEntitiesTextSensorResponse,
            19 => MessageType::ListEntitiesDoneResponse,
            20 => MessageType::SubscribeStatesRequest,
            21 => MessageType::BinarySensorStateResponse,
            22 => MessageType::CoverStateResponse,
            23 => MessageType::FanStateResponse,
            24 => MessageType::LightStateResponse,
            25 => MessageType::SensorStateResponse,
            26 => MessageType::SwitchStateResponse,
            27 => MessageType::TextSensorStateResponse,
            28 => MessageType::SubscribeLogsRequest,
            29 => MessageType::SubscribeLogsResponse,
            30 => MessageType::CoverCommandRequest,
            31 => MessageType::FanCommandRequest,
            32 => MessageType::LightCommandRequest,
            33 => MessageType::SwitchCommandRequest,
            34 => MessageType::SubscribeHomeassistantServicesRequest,
            35 => MessageType::HomeassistantServiceResponse,
            36 => MessageType::GetTimeRequest,
            37 => MessageType::GetTimeResponse,
            38 => MessageType::SubscribeHomeAssistantStatesRequest,
            39 => MessageType::SubscribeHomeAssistantStateResponse,
            40 => MessageType::HomeAssistantStateResponse,
            41 => MessageType::ListEntitiesServicesResponse,
            42 => MessageType::ExecuteServiceRequest,
            43 => MessageType::ListEntitiesCameraResponse,
            44 => MessageType::CameraImageResponse,
            45 => MessageType::CameraImageRequest,
            46 => MessageType::ListEntitiesClimateResponse,
            47 => MessageType::ClimateStateResponse,
            48 => MessageType::ClimateCommandRequest,
            49 => MessageType::ListEntitiesNumberResponse,
            50 => MessageType::NumberStateResponse,
            51 => MessageType::NumberCommandRequest,
            52 => MessageType::ListEntitiesSelectResponse,
            53 => MessageType::SelectStateResponse,
            54 => MessageType::SelectCommandRequest,
            55 => MessageType::ListEntitiesSirenResponse,
            56 => MessageType::SirenStateResponse,
            57 => MessageType::SirenCommandRequest,
            58 => MessageType::ListEntitiesLockResponse,
            59 => MessageType::LockStateResponse,
            60 => MessageType::LockCommandRequest,
            61 => MessageType::ListEntitiesButtonResponse,
            62 => MessageType::ButtonCommandRequest,
            63 => MessageType::ListEntitiesMediaPlayerResponse,
            64 => MessageType::MediaPlayerStateResponse,
            65 => MessageType::MediaPlayerCommandRequest,
            66 => MessageType::SubscribeBluetoothLEAdvertisementsRequest,
            67 => MessageType::BluetoothLEAdvertisementResponse,
            68 => MessageType::BluetoothDeviceRequest,
            69 => MessageType::BluetoothDeviceConnectionResponse,
            70 => MessageType::BluetoothGATTGetServicesRequest,
            71 => MessageType::BluetoothGATTGetServicesResponse,
            72 => MessageType::BluetoothGATTGetServicesDoneResponse,
            73 => MessageType::BluetoothGATTReadRequest,
            74 => MessageType::BluetoothGATTReadResponse,
            75 => MessageType::BluetoothGATTWriteRequest,
            76 => MessageType::BluetoothGATTReadDescriptorRequest,
            77 => MessageType::BluetoothGATTWriteDescriptorRequest,
            78 => MessageType::BluetoothGATTNotifyRequest,
            79 => MessageType::BluetoothGATTNotifyDataResponse,
            80 => MessageType::SubscribeBluetoothConnectionsFreeRequest,
            81 => MessageType::BluetoothConnectionsFreeResponse,
            82 => MessageType::BluetoothGATTErrorResponse,
            83 => MessageType::BluetoothGATTWriteResponse,
            84 => MessageType::BluetoothGATTNotifyResponse,
            85 => MessageType::BluetoothDevicePairingResponse,
            86 => MessageType::BluetoothDeviceUnpairingResponse,
            87 => MessageType::UnsubscribeBluetoothLEAdvertisementsRequest,
            88 => MessageType::BluetoothDeviceClearCacheResponse,
            89 => MessageType::SubscribeVoiceAssistantRequest,
            90 => MessageType::VoiceAssistantRequest,
            91 => MessageType::VoiceAssistantResponse,
            92 => MessageType::VoiceAssistantEventResponse,
            93 => MessageType::BluetoothLERawAdvertisementsResponse,
            94 => MessageType::ListEntitiesAlarmControlPanelResponse,
            95 => MessageType::AlarmControlPanelStateResponse,
            96 => MessageType::AlarmControlPanelCommandRequest,
            97 => MessageType::ListEntitiesTextResponse,
            98 => MessageType::TextStateResponse,
            99 => MessageType::TextCommandRequest,
            100 => MessageType::ListEntitiesDateResponse,
            101 => MessageType::DateStateResponse,
            102 => MessageType::DateCommandRequest,
            103 => MessageType::ListEntitiesTimeResponse,
            104 => MessageType::TimeStateResponse,
            105 => MessageType::TimeCommandRequest,
            106 => MessageType::VoiceAssistantAudio,
            107 => MessageType::ListEntitiesEventResponse,
            108 => MessageType::EventResponse,
            109 => MessageType::ListEntitiesValveResponse,
            110 => MessageType::ValveStateResponse,
            111 => MessageType::ValveCommandRequest,
            112 => MessageType::ListEntitiesDateTimeResponse,
            113 => MessageType::DateTimeStateResponse,
            114 => MessageType::DateTimeCommandRequest,
            115 => MessageType::VoiceAssistantTimerEventResponse,
            116 => MessageType::ListEntitiesUpdateResponse,
            117 => MessageType::UpdateStateResponse,
            118 => MessageType::UpdateCommandRequest,
            119 => MessageType::VoiceAssistantAnnounceRequest,
            120 => MessageType::VoiceAssistantAnnounceFinished,
            121 => MessageType::VoiceAssistantConfigurationRequest,
            122 => MessageType::VoiceAssistantConfigurationResponse,
            123 => MessageType::VoiceAssistantSetConfiguration,
            _ => {
                return Err(ProtocolError::InvalidResponse(format!(
                    "Unknown message type: {}",
                    msg_type_val
                )));
            }
        };

        // Check if we have the complete message
        if src.len() < size as usize {
            // Not enough data, restore buffer and try again later
            *src = original_buf;
            return Ok(None);
        }

        // Extract the message data
        let data = src.split_to(size as usize).freeze();

        Ok(Some(ESPHomeFrame { msg_type, data }))
    }
}

impl Encoder<ESPHomeFrame> for ESPHomeCodec {
    type Error = ProtocolError;

    fn encode(
        &mut self,
        item: ESPHomeFrame,
        dst: &mut BytesMut,
    ) -> std::result::Result<(), Self::Error> {
        // Reserve space for the frame
        dst.reserve(1 + 10 + item.data.len()); // 1 byte preamble + up to 10 bytes for VarInts + data

        // Write zero byte preamble
        dst.put_u8(0);

        // Write message size as VarInt
        encode_varuint(item.data.len() as u64, dst);

        // Write message type as VarInt
        encode_varuint(item.msg_type as u64, dst);

        // Write message data
        dst.extend_from_slice(&item.data);

        Ok(())
    }
}

/// Decode a VarInt (variable-length integer) from a buffer
pub fn decode_varuint(buffer: &mut BytesMut) -> Option<u64> {
    let mut value: u64 = 0;
    let mut shift: u32 = 0;

    let mut i = 0;
    while i < buffer.len() {
        let byte = buffer[i];
        value |= ((byte & 0x7F) as u64) << shift;
        i += 1;

        if byte & 0x80 == 0 {
            // Advance the buffer past the consumed bytes
            buffer.advance(i);
            return Some(value);
        }

        shift += 7;
        if shift > 63 {
            return None; // VarInt too large
        }
    }

    None // Incomplete VarInt
}

/// Encode a value as VarInt (variable-length integer) into a buffer
pub fn encode_varuint(mut value: u64, buffer: &mut BytesMut) {
    loop {
        let mut byte = (value & 0x7F) as u8;
        value >>= 7;
        if value != 0 {
            byte |= 0x80;
        }
        buffer.put_u8(byte);
        if value == 0 {
            break;
        }
    }
}

pub type MessageResponseSender = oneshot::Sender<std::result::Result<Bytes, ProtocolError>>;

/// A low-level ESPHome TCP protocol client
pub struct ESPHomeProtocolClient {
    address: String,
    tx: Option<mpsc::Sender<(ESPHomeFrame, Option<MessageResponseSender>)>>,
    task: Option<JoinHandle<()>>,
    pending_responses: Arc<Mutex<HashMap<MessageType, MessageResponseSender>>>,
    message_callbacks: Arc<Mutex<HashMap<MessageType, Vec<mpsc::Sender<Bytes>>>>>,
}

impl ESPHomeProtocolClient {
    /// Create a new protocol client
    pub fn new(address: String) -> Self {
        Self {
            address,
            tx: None,
            task: None,
            pending_responses: Arc::new(Mutex::new(HashMap::new())),
            message_callbacks: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Ensure we have an active connection
    pub async fn ensure_connected(&mut self) -> Result<()> {
        if self.tx.is_some() {
            return Ok(());
        }

        // Connect to the TCP server
        let stream = TcpStream::connect(&self.address)
            .await
            .map_err(|_| ProtocolError::ConnectionError("Failed to connect to device".into()))?;

        // Create a framed connection with our codec
        let framed = Framed::new(stream, ESPHomeCodec);
        let (mut sink, mut stream) = framed.split();

        // Create channels for internal communication
        let (tx, mut rx) = mpsc::channel::<(ESPHomeFrame, Option<MessageResponseSender>)>(32);

        // Clone the pending responses for the background task
        let pending_responses = self.pending_responses.clone();
        let message_callbacks = self.message_callbacks.clone();

        // Start background task to handle the connection
        let task = tokio::spawn(async move {
            // Process incoming and outgoing messages
            loop {
                tokio::select! {
                    // Handle outgoing messages
                    Some((frame, response_sender)) = rx.recv() => {
                        // If this message expects a response, store the sender
                        if let Some(sender) = response_sender {
                            // Determine expected response type
                            let expected_response = match frame.msg_type {
                                MessageType::HelloRequest => MessageType::HelloResponse,
                                MessageType::ConnectRequest => MessageType::ConnectResponse,
                                MessageType::DisconnectRequest => MessageType::DisconnectResponse,
                                MessageType::PingRequest => MessageType::PingResponse,
                                MessageType::DeviceInfoRequest => MessageType::DeviceInfoResponse,
                                // Add more mappings as needed for other request-response pairs
                                _ => {
                                    // For messages without a direct response, we can't easily predict
                                    // Just use the same type for now (this won't work for all messages)
                                    frame.msg_type
                                }
                            };

                            let mut responses = pending_responses.lock().unwrap();
                            responses.insert(expected_response, sender);
                        }

                        // Send the frame
                        if let Err(e) = sink.send(frame).await {
                            eprintln!("Failed to send frame: {}", e);
                            break;
                        }
                    }

                    // Handle incoming messages
                    result = stream.next() => {
                        match result {
                            Some(Ok(frame)) => {
                                // If this is a response, send it to the waiting request
                                if frame.msg_type.is_response() {
                                    let mut responses = pending_responses.lock().unwrap();
                                    if let Some(sender) = responses.remove(&frame.msg_type) {
                                        let _ = sender.send(Ok(frame.data));
                                    } else {
                                        // Check if there are any callbacks registered for this message type
                                        let callbacks = message_callbacks.lock().unwrap();
                                        if let Some(senders) = callbacks.get(&frame.msg_type) {
                                            // Send to all callbacks registered for this message type
                                            for sender in senders {
                                                if sender.capacity() > 0 {
                                                    let _ = sender.try_send(frame.data.clone());
                                                }
                                            }
                                        }
                                    }
                                } else {
                                    // Handle non-response messages
                                    // Check if there are any callbacks registered for this message type
                                    let callbacks = message_callbacks.lock().unwrap();
                                    if let Some(senders) = callbacks.get(&frame.msg_type) {
                                        // Send to all callbacks registered for this message type
                                        for sender in senders {
                                            if sender.capacity() > 0 {
                                                let _ = sender.try_send(frame.data.clone());
                                            }
                                        }
                                    } else {
                                        // No callbacks registered for this message type
                                        eprintln!("Received unhandled message type: {:?}", frame.msg_type);
                                    }
                                }
                            }
                            Some(Err(e)) => {
                                eprintln!("Frame error: {}", e);
                                break;
                            }
                            None => {
                                // EOF
                                break;
                            }
                        }
                    }
                }
            }

            // Clean up resources
            let mut responses = pending_responses.lock().unwrap();
            for (_, sender) in responses.drain() {
                let _ = sender.send(Err(ProtocolError::ConnectionError(
                    "Connection closed".into(),
                )));
            }
        });

        self.tx = Some(tx);
        self.task = Some(task);

        Ok(())
    }

    /// Send a message and receive a response
    pub async fn send_and_receive<T, U>(&mut self, msg_type: MessageType, request: &T) -> Result<U>
    where
        T: Message,
        U: Message + Default,
    {
        // Ensure we have a connection
        self.ensure_connected().await?;

        // Encode the request
        let mut buf = BytesMut::with_capacity(request.encoded_len());
        request
            .encode(&mut buf)
            .map_err(|err| ProtocolError::EncodeError(err.into()))?;

        // Create the frame
        let frame = ESPHomeFrame {
            msg_type,
            data: buf.freeze(),
        };

        // Create a channel for the response
        let (response_tx, response_rx) = oneshot::channel();

        // Send the message
        if let Some(tx) = &self.tx {
            tx.send((frame, Some(response_tx)))
                .await
                .map_err(|_| ProtocolError::CommunicationError("Failed to send message".into()))?;
        } else {
            return Err(ProtocolError::ConnectionError("Not connected".into()).into());
        }

        // Wait for the response
        let response_data = response_rx
            .await
            .map_err(|_| ProtocolError::CommunicationError("Failed to receive response".into()))?
            .map_err(|e| e)?;

        // Decode the response
        let response =
            U::decode(response_data).map_err(|err| ProtocolError::DecodeError(err.into()))?;

        Ok(response)
    }

    /// Send a message without waiting for a response
    pub async fn send<T>(&mut self, msg_type: MessageType, request: &T) -> Result<()>
    where
        T: Message,
    {
        // Ensure we have a connection
        self.ensure_connected().await?;

        // Encode the request
        let mut buf = BytesMut::with_capacity(request.encoded_len());
        request
            .encode(&mut buf)
            .map_err(|err| ProtocolError::EncodeError(err.into()))?;

        // Create the frame
        let frame = ESPHomeFrame {
            msg_type,
            data: buf.freeze(),
        };

        // Send the message
        if let Some(tx) = &self.tx {
            tx.send((frame, None))
                .await
                .map_err(|_| ProtocolError::CommunicationError("Failed to send message".into()))?;
        } else {
            return Err(ProtocolError::ConnectionError("Not connected".into()).into());
        }

        Ok(())
    }

    /// Register a callback for a specific message type
    pub async fn register_callback(
        &mut self,
        msg_type: MessageType,
    ) -> Result<mpsc::Receiver<Bytes>> {
        // Create a channel for the callback
        let (tx, rx) = mpsc::channel::<Bytes>(32);

        // Add the callback to the map
        let mut callbacks = self.message_callbacks.lock().unwrap();

        let entry = callbacks.entry(msg_type).or_insert_with(Vec::new);
        entry.push(tx);

        Ok(rx)
    }

    /// Remove all callbacks for a specific message type
    pub fn remove_callbacks(&mut self, msg_type: MessageType) {
        let mut callbacks = self.message_callbacks.lock().unwrap();
        callbacks.remove(&msg_type);
    }

    /// Close the connection and clean up resources
    pub fn close(&mut self) {
        self.tx = None;

        // Abort the background task
        if let Some(task) = self.task.take() {
            task.abort();
        }

        // Clear pending responses
        let mut responses = self.pending_responses.lock().unwrap();
        for (_, sender) in responses.drain() {
            let _ = sender.send(Err(ProtocolError::ConnectionError(
                "Connection closed".into(),
            )));
        }

        // Clear callbacks
        let mut callbacks = self.message_callbacks.lock().unwrap();
        callbacks.clear();
    }
}

impl Drop for ESPHomeProtocolClient {
    fn drop(&mut self) {
        self.close();
    }
}

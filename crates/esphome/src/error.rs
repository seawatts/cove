use miette::Diagnostic;
use thiserror::Error;

use crate::protocol::ProtocolError;

/// Error type for ESPHome operations
#[derive(Debug, Error, Diagnostic)]
pub enum ESPHomeError {
    /// Error during protocol buffer encoding/decoding
    #[error("Protocol buffer error: {0}")]
    Protobuf(#[from] prost::DecodeError),

    /// Error during protocol buffer encoding
    #[error("Protocol buffer encoding error: {0}")]
    ProtobufEncode(#[from] prost::EncodeError),

    /// I/O error during communication
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),

    /// Authentication error
    #[error("Authentication failed: {0}")]
    AuthenticationError(String),

    /// Connection error
    #[error("Connection error: {0}")]
    ConnectionError(String),

    /// Device error
    #[error("Device error: {0}")]
    Device(String),

    /// Timeout error
    #[error("Timeout error: {0}")]
    TimeoutError(String),

    /// Invalid response from device
    #[error("Invalid response: {0}")]
    InvalidResponse(String),

    /// Other error
    #[error("Other error: {0}")]
    Other(String),

    /// Communication error
    #[error("Communication error: {0}")]
    CommunicationError(String),

    /// Protocol error
    #[error("Protocol error: {0}")]
    ProtocolError(#[from] ProtocolError),

    /// Entity error
    #[error("Entity error: {0}")]
    EntityError(String),
}

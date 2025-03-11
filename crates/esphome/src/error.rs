use std::io;
use thiserror::Error;

/// Result type for ESPHome operations
pub type Result<T> = std::result::Result<T, Error>;

/// Error type for ESPHome operations
#[derive(Error, Debug)]
pub enum Error {
    /// Error during protocol buffer encoding/decoding
    #[error("Protocol buffer error: {0}")]
    Protobuf(#[from] prost::DecodeError),

    /// Error during protocol buffer encoding
    #[error("Protocol buffer encoding error: {0}")]
    ProtobufEncode(#[from] prost::EncodeError),

    /// I/O error during communication
    #[error("I/O error: {0}")]
    Io(#[from] io::Error),

    /// Authentication error
    #[error("Authentication failed: {0}")]
    Authentication(String),

    /// Connection error
    #[error("Connection error: {0}")]
    Connection(String),

    /// Device error
    #[error("Device error: {0}")]
    Device(String),

    /// Timeout error
    #[error("Timeout error: {0}")]
    Timeout(String),

    /// Invalid response from device
    #[error("Invalid response: {0}")]
    InvalidResponse(String),

    /// Other error
    #[error("Other error: {0}")]
    Other(String),
}

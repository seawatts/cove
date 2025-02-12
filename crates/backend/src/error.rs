use miette::Diagnostic;
use serde_json;
use serde_yaml;
use std::io;
use std::sync::Arc;
use thiserror::Error;

// Re-export specific error types
pub use crate::config::error::ConfigError;
pub use crate::device::error::DeviceError;
pub use crate::discovery::error::DiscoveryError;
pub use crate::protocol::error::ProtocolError;

/// The main error type for the Cove application that wraps all other error types
#[derive(Error, Diagnostic, Debug, Clone)]
pub enum Error {
    #[error(transparent)]
    #[diagnostic(code(cove::io))]
    Io(#[from] Arc<io::Error>),

    #[error(transparent)]
    #[diagnostic(code(cove::config::json))]
    Json(#[from] Arc<serde_json::Error>),

    #[error(transparent)]
    #[diagnostic(code(cove::config::yaml))]
    Yaml(#[from] Arc<serde_yaml::Error>),

    #[error(transparent)]
    #[diagnostic(transparent)]
    Discovery(#[from] DiscoveryError),

    #[error(transparent)]
    #[diagnostic(transparent)]
    Device(#[from] DeviceError),

    #[error(transparent)]
    #[diagnostic(transparent)]
    Protocol(#[from] ProtocolError),

    #[error(transparent)]
    #[diagnostic(transparent)]
    Config(ConfigError),
}

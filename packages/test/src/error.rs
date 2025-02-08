use miette::Diagnostic;
use serde_json;
use serde_yaml;
use std::io;
use thiserror::Error;

// Re-export specific error types
// pub use crate::config::error::ConfigError;
// pub use crate::device::error::DeviceError;
// pub use crate::discovery::error::DiscoveryError;
// pub use crate::protocol::error::ProtocolError;

/// The main error type for the Cove application that wraps all other error types
#[derive(Error, Diagnostic, Debug)]
pub enum Error {}

use crate::error::Error;
use crate::types::Protocol;
use miette::{Diagnostic, SourceSpan};
use std::{sync::Arc, time::Duration};
use thiserror::Error;
use tracing::error;

#[derive(Error, Diagnostic, Debug, Clone)]
pub enum DiscoveryError {
    #[error("Failed to discover {protocol} devices")]
    #[diagnostic(
        code(cove::discovery::failed),
        help("Check if devices are online and broadcasting"),
        url("https://docs.rs/cove/latest/discovery")
    )]
    Failed {
        protocol: Protocol,
        #[label("Error occurred here")]
        span: SourceSpan,
        #[related]
        related: Vec<Error>,
    },

    #[error("Discovery timed out for {protocol} after {duration:?}")]
    #[diagnostic(
        code(cove::discovery::timeout),
        help("Consider increasing the timeout duration")
    )]
    Timeout {
        protocol: Protocol,
        duration: Duration,
        #[source]
        source: Arc<tokio::time::error::Elapsed>,
    },

    #[error("No devices found{}", .protocol.map_or(String::new(), |p| format!(" for {}", p)))]
    #[diagnostic(
        code(cove::discovery::no_devices),
        help("Ensure devices are powered on and in discovery mode")
    )]
    NoDevicesFound {
        protocol: Option<Protocol>,
        #[related]
        related: Vec<Error>,
    },
}

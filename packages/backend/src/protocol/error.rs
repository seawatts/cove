use crate::error::Error;
use crate::types::Protocol;
use miette::{Diagnostic, SourceSpan};
use std::{sync::Arc, time::Duration};
use thiserror::Error;
use tracing::error;

#[derive(Error, Diagnostic, Debug, Clone)]
pub enum ProtocolError {
    #[error("Connection failed for {protocol}")]
    #[diagnostic(
        code(cove::protocol::connection),
        help("Check network connectivity and device status")
    )]
    ConnectionFailed {
        protocol: Protocol,
        #[related]
        related: Vec<Error>,
    },

    #[error("Authentication failed for {protocol}")]
    #[diagnostic(code(cove::protocol::auth), help("Verify credentials and permissions"))]
    AuthenticationFailed {
        protocol: Protocol,
        #[related]
        related: Vec<Error>,
    },

    #[error("Invalid message format for {protocol}")]
    #[diagnostic(
        code(cove::protocol::format),
        help("Check message format specification")
    )]
    InvalidMessage {
        protocol: Protocol,
        details: String,
        #[source_code]
        message: String,
        #[label("Invalid here")]
        span: SourceSpan,
    },

    #[error("Protocol {protocol} not supported")]
    #[diagnostic(
        code(cove::protocol::unsupported),
        help("Check supported protocols in documentation")
    )]
    UnsupportedProtocol { protocol: Protocol },

    #[error("Communication timeout for {protocol}")]
    #[diagnostic(
        code(cove::protocol::timeout),
        help("Check network conditions or increase timeout")
    )]
    Timeout {
        protocol: Protocol,
        duration: Duration,
    },

    #[error("Configuration error for {protocol}")]
    #[diagnostic(code(cove::protocol::config), help("Verify protocol configuration"))]
    Configuration {
        protocol: Protocol,
        details: String,
        #[source_code]
        config: String,
    },

    #[error(transparent)]
    #[diagnostic(code(cove::protocol::mdns))]
    Mdns(#[from] Arc<mdns_sd::Error>),
}

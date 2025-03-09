use miette::Diagnostic;
use thiserror::Error;

#[derive(Debug, Error, Diagnostic)]
pub enum ProtocolError {
    #[error("Failed to connect to accessory: {0}")]
    ConnectionError(String),

    #[error("Failed to authenticate: {0}")]
    AuthenticationError(String),

    #[error("Failed to discover accessories: {0}")]
    DiscoveryError(String),

    #[error("Failed to send command: {0}")]
    CommandError(String),

    #[error("Failed to get state: {0}")]
    StateError(String),

    #[error("Invalid configuration: {0}")]
    ConfigurationError(String),

    #[error("Protocol-specific error: {0}")]
    ProtocolSpecificError(String),

    #[error("HTTP error: {0}")]
    HttpError(#[from] reqwest::Error),

    #[error("JSON error: {0}")]
    JsonError(#[from] serde_json::Error),

    #[error("URL parse error: {0}")]
    UrlError(#[from] url::ParseError),
}

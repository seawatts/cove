// ESPHome client library for Cove
//! This library provides an interface to communicate with ESPHome devices using Protocol Buffers.

pub mod client;
pub mod connection;
pub mod device;
pub mod error;
pub mod proto;
pub mod protocol;
// pub mod types;

// Re-export main types for easier access
// pub use client::ESPHomeClient;
// pub use connection::{Connection, ConnectionInfo, EntityState};
// pub use device::{Device, DeviceInfo, DeviceRegistry};
pub use connection::{ESPHomeConnection, ESPHomeConnectionBuilder};
pub use error::{Error, Result};
pub use protocol::ProtocolError;

// Version info
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

use std::time::Duration;

use miette::Result;
use tracing::{debug, warn};

use crate::types::Device;

pub struct BluetoothProtocol {
    timeout: Duration,
}

impl BluetoothProtocol {
    pub fn new() -> Self {
        Self {
            timeout: Duration::from_secs(5),
        }
    }

    pub fn with_timeout(timeout: Duration) -> Self {
        Self { timeout }
    }

    pub async fn discover(&self) -> Result<Vec<Device>> {
        debug!(
            "Starting Bluetooth device discovery with timeout: {:?}",
            self.timeout
        );

        // For now, return empty list since Bluetooth discovery is not implemented yet
        // In the future, this will use btleplug to discover devices
        warn!("Bluetooth discovery not implemented yet");
        Ok(vec![])
    }
}

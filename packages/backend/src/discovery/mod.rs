pub mod error;

use miette::Result;
use tokio::task::JoinSet;
use tracing::error;

use crate::{
    protocol::{bluetooth::BluetoothProtocol, wifi::WiFiProtocol},
    types::{Device, DeviceProperties, WiFiDevice},
};
use async_trait::async_trait;

#[async_trait]
pub trait DiscoveryModule {
    type DeviceType: DeviceProperties + Into<Device>;

    async fn discover(&self) -> Result<Vec<Self::DeviceType>>;
}

pub struct WiFiDiscovery(WiFiProtocol);

impl WiFiDiscovery {
    pub fn new() -> Self {
        Self(WiFiProtocol::new())
    }

    pub fn with_timeout(timeout: std::time::Duration) -> Self {
        Self(WiFiProtocol::with_timeout(timeout))
    }
}

#[async_trait]
impl DiscoveryModule for WiFiDiscovery {
    type DeviceType = WiFiDevice;

    async fn discover(&self) -> Result<Vec<Self::DeviceType>> {
        self.0.discover().await
    }
}

pub struct BluetoothDiscovery(BluetoothProtocol);

impl BluetoothDiscovery {
    pub fn new() -> Self {
        Self(BluetoothProtocol::new())
    }

    pub fn with_timeout(timeout: std::time::Duration) -> Self {
        Self(BluetoothProtocol::with_timeout(timeout))
    }
}

#[async_trait]
impl DiscoveryModule for BluetoothDiscovery {
    type DeviceType = Device;

    async fn discover(&self) -> Result<Vec<Self::DeviceType>> {
        self.0.discover().await
    }
}

pub async fn discover_all_devices() -> Result<Vec<Device>> {
    let mut join_set = JoinSet::new();

    // Create and spawn discovery modules with explicit type conversion
    join_set.spawn(async {
        let devices = BluetoothDiscovery::new().discover().await?;
        Ok::<Vec<Device>, miette::Report>(devices.into_iter().map(Into::into).collect())
    });
    join_set.spawn(async {
        let devices = WiFiDiscovery::new().discover().await?;
        Ok::<Vec<Device>, miette::Report>(devices.into_iter().map(Into::into).collect())
    });

    let mut devices = Vec::new();

    while let Some(result) = join_set.join_next().await {
        match result {
            Ok(Ok(module_devices)) => devices.extend(module_devices),
            Ok(Err(e)) => error!(%e),
            Err(e) => error!(%e),
        }
    }

    Ok(devices)
}

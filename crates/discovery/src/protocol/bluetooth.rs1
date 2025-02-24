use std::{sync::Arc, time::Duration};

use async_trait::async_trait;
use btleplug::api::{Central, Manager as _, Peripheral, ScanFilter};
use btleplug::platform::{Adapter, Manager};
use chrono::Utc;
use miette::Result;
use once_cell::sync::Lazy;
use serde_json::json;
use tokio::sync::broadcast;
use tracing::{debug, error, info, warn};

use crate::{
    discovery::{error::DiscoveryError, DeviceProtocol},
    error::{Error, ProtocolError},
    types::{
        BaseDevice, BluetoothDevice, DeviceCapabilities, DeviceCategory, DeviceEvent,
        DeviceMetadata, DeviceStatus, Location, Protocol,
    },
};

pub static INSTANCE: Lazy<Arc<BluetoothProtocol>> =
    Lazy::new(|| Arc::new(BluetoothProtocol::new()));

#[derive(Clone)]
pub struct BluetoothProtocol {
    timeout: Duration,
}

impl BluetoothProtocol {
    pub fn new() -> Self {
        Self {
            timeout: Duration::from_secs(5),
        }
    }

    pub fn get_instance() -> Arc<BluetoothProtocol> {
        INSTANCE.clone()
    }

    pub fn with_timeout(timeout: Duration) -> Self {
        Self { timeout }
    }

    async fn scan_for_devices(
        adapter: &Adapter,
        timeout: Duration,
        device_tx: &broadcast::Sender<DeviceEvent>,
    ) -> Result<Vec<BluetoothDevice>> {
        let mut devices = Vec::new();

        // Start scanning
        adapter
            .start_scan(ScanFilter::default())
            .await
            .map_err(|e| {
                let err = DiscoveryError::Failed {
                    protocol: Protocol::Bluetooth,
                    span: (0..1).into(),
                    related: vec![Error::Protocol(ProtocolError::Bluetooth(Arc::new(e)))],
                };
                error!("{:?}", err);
                err
            })?;

        // Wait for the specified timeout
        tokio::time::sleep(timeout).await;

        // Get discovered devices
        let peripherals = adapter.peripherals().await.map_err(|e| {
            let err = DiscoveryError::Failed {
                protocol: Protocol::Bluetooth,
                span: (0..1).into(),
                related: vec![Error::Protocol(ProtocolError::Bluetooth(Arc::new(e)))],
            };
            error!("{:?}", err);
            err
        })?;

        for peripheral in peripherals.iter() {
            if let Ok(properties) = peripheral.properties().await {
                if let Some(props) = properties {
                    // Check if this is likely an iOS device based on manufacturer data
                    let is_ios = props
                        .manufacturer_data
                        .iter()
                        .any(|(company_id, _)| *company_id == 0x004C); // Apple's company identifier

                    if is_ios {
                        let device = BluetoothDevice {
                            base: BaseDevice {
                                id: format!("bluetooth_{}", props.address),
                                r#type: "ios_device".to_string(),
                                friendly_name: props
                                    .local_name
                                    .unwrap_or_else(|| "iOS Device".to_string()),
                                description: "iOS Device discovered via Bluetooth".to_string(),
                                protocol: Protocol::Bluetooth,
                                status: DeviceStatus::Online,
                                categories: vec![DeviceCategory::Unknown],
                                capabilities: DeviceCapabilities::default(),
                                location: Location::default(),
                                metadata: DeviceMetadata {
                                    manufacturer: Some("Apple".to_string()),
                                    model: None,
                                    firmware_version: None,
                                    hardware_version: None,
                                    icon_url: None,
                                },
                                network_info: None,
                                created: Utc::now(),
                                updated: Utc::now(),
                                last_online: Some(Utc::now()),
                                raw_details: json!({
                                    "address": props.address.to_string(),
                                    "rssi": props.rssi,
                                    "tx_power_level": props.tx_power_level,
                                    "manufacturer_data": props.manufacturer_data,
                                }),
                            },
                            signal_strength: Some(props.rssi.unwrap_or(0) as i32),
                            services: props.services.iter().map(|uuid| uuid.to_string()).collect(),
                            is_connectable: true, // Most iOS devices are connectable
                            is_paired: false, // We'd need to check system Bluetooth settings for this
                        };

                        let _ = device_tx.send(DeviceEvent::DeviceUpdated(device.clone().into()));
                        devices.push(device);
                    }
                }
            }
        }

        // Stop scanning
        adapter.stop_scan().await.map_err(|e| {
            let err = DiscoveryError::Failed {
                protocol: Protocol::Bluetooth,
                span: (0..1).into(),
                related: vec![Error::Protocol(ProtocolError::Bluetooth(Arc::new(e)))],
            };
            error!("{:?}", err);
            err
        })?;

        Ok(devices)
    }

    pub async fn discover_devices(
        &self,
        device_tx: broadcast::Sender<DeviceEvent>,
    ) -> Result<Vec<BluetoothDevice>> {
        info!("Starting Bluetooth device discovery...");

        // Initialize Bluetooth
        let manager = Manager::new().await.map_err(|e| {
            let err = DiscoveryError::Failed {
                protocol: Protocol::Bluetooth,
                span: (0..1).into(),
                related: vec![Error::Protocol(ProtocolError::Bluetooth(Arc::new(e)))],
            };
            error!("{:?}", err);
            err
        })?;

        let adapters = manager.adapters().await.map_err(|e| {
            let err = DiscoveryError::Failed {
                protocol: Protocol::Bluetooth,
                span: (0..1).into(),
                related: vec![Error::Protocol(ProtocolError::Bluetooth(Arc::new(e)))],
            };
            error!("{:?}", err);
            err
        })?;

        if adapters.is_empty() {
            warn!("No Bluetooth adapters found");
            return Ok(Vec::new());
        }

        // Use the first adapter
        let adapter = adapters.into_iter().next().unwrap();
        debug!(
            "Using Bluetooth adapter: {:?}",
            adapter.adapter_info().await
        );

        // Start continuous scanning in the background
        let this = self.clone();
        tokio::spawn(async move {
            loop {
                match Self::scan_for_devices(&adapter, this.timeout, &device_tx).await {
                    Ok(_) => {
                        debug!("Bluetooth scan completed successfully");
                    }
                    Err(e) => {
                        error!("Bluetooth scan error: {:?}", e);
                    }
                }

                // Wait before starting the next scan
                tokio::time::sleep(Duration::from_secs(30)).await;
            }
        });

        Ok(Vec::new())
    }
}

#[async_trait]
impl DeviceProtocol for BluetoothProtocol {
    fn protocol_name(&self) -> &'static str {
        "Bluetooth"
    }

    fn get_instance() -> Arc<Self> {
        INSTANCE.clone()
    }

    async fn start_discovery(&self, device_events: broadcast::Sender<DeviceEvent>) -> Result<()> {
        self.discover_devices(device_events).await?;
        Ok(())
    }
}

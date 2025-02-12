use std::sync::Arc;

use miette::Result;
use tokio::sync::broadcast;
use tracing::{debug, error, info, warn};

use crate::{
    device::DeviceRegistry,
    events::{AlertLevel, DeviceEvent, EventType},
    types::DeviceStatus,
};

pub struct EventProcessor {
    device_registry: Arc<DeviceRegistry>,
    high_priority_rx: broadcast::Receiver<DeviceEvent>,
    normal_priority_rx: broadcast::Receiver<DeviceEvent>,
    low_priority_rx: broadcast::Receiver<DeviceEvent>,
}

impl EventProcessor {
    pub fn new(
        device_registry: Arc<DeviceRegistry>,
        high_priority_rx: broadcast::Receiver<DeviceEvent>,
        normal_priority_rx: broadcast::Receiver<DeviceEvent>,
        low_priority_rx: broadcast::Receiver<DeviceEvent>,
    ) -> Self {
        Self {
            device_registry,
            high_priority_rx,
            normal_priority_rx,
            low_priority_rx,
        }
    }

    pub async fn start(&mut self) -> Result<()> {
        info!("Starting event processor...");

        loop {
            tokio::select! {
                // High priority events take precedence
                Ok(event) = self.high_priority_rx.recv() => {
                    if let Err(e) = self.process_event(event).await {
                        error!("Failed to process high priority event: {:?}", e);
                    }
                }
                // Normal priority events
                Ok(event) = self.normal_priority_rx.recv() => {
                    if let Err(e) = self.process_event(event).await {
                        error!("Failed to process normal priority event: {:?}", e);
                    }
                }
                // Low priority events
                Ok(event) = self.low_priority_rx.recv() => {
                    if let Err(e) = self.process_event(event).await {
                        error!("Failed to process low priority event: {:?}", e);
                    }
                }
            }
        }
    }

    async fn process_event(&self, event: DeviceEvent) -> Result<()> {
        debug!("Processing event: {:?}", event);

        match &event.event_type {
            EventType::StateChange { device_id, state } => {
                // Update device state in registry
                if let Some(mut device) = self.device_registry.get_device(device_id).await {
                    device.raw_details = state.clone();
                    self.device_registry.register_device(device).await?;
                }
            }
            EventType::Command {
                device_id,
                command,
                params,
            } => {
                // Handle device commands
                info!(
                    "Command received for device {}: {} {:?}",
                    device_id, command, params
                );
            }
            EventType::Alert {
                device_id,
                level,
                message,
            } => {
                // Handle alerts based on level
                match level {
                    AlertLevel::Critical => error!("CRITICAL ALERT for {}: {}", device_id, message),
                    AlertLevel::Warning => warn!("Warning for {}: {}", device_id, message),
                    AlertLevel::Info => info!("Info for {}: {}", device_id, message),
                }
            }
            EventType::DeviceOnline { device_id } => {
                if let Some(mut device) = self.device_registry.get_device(device_id).await {
                    device.status = DeviceStatus::Online;
                    self.device_registry.register_device(device).await?;
                }
            }
            EventType::DeviceOffline { device_id } => {
                if let Some(mut device) = self.device_registry.get_device(device_id).await {
                    device.status = DeviceStatus::Offline;
                    self.device_registry.register_device(device).await?;
                }
            }
            EventType::SensorReading {
                device_id,
                sensor_type,
                value,
                unit,
            } => {
                // Process sensor readings
                debug!(
                    "Sensor reading for {}: {:?} = {:?} {}",
                    device_id, sensor_type, value, unit
                );
            }
        }

        Ok(())
    }
}

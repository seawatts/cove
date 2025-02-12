pub mod api;
pub mod config;
pub mod device;
pub mod discovery;
pub mod error;
pub mod events;
pub mod logging;
pub mod protocol;
pub mod types;

use miette::Result;
use std::{net::SocketAddr, sync::Arc};
use tokio::signal;
use tracing::{error, info};

use crate::{api::Api, device::DeviceRegistry, discovery::DeviceDiscovery};
use events::{EventManager, EventProcessor};

#[tokio::main]
async fn main() -> Result<()> {
    logging::setup_tracing()?;
    logging::setup_miette()?;

    // Generate schemas
    config::Config::generate_schema().await?;
    info!("✅ Schema generation completed");

    // Load all configurations
    info!("Loading configurations...");
    let configs = config::LoadedConfigs::load_all().await?;

    // Validate all configurations
    info!("Validating configurations...");
    configs.validate().await?;
    info!("✅ All configurations loaded and validated");

    info!("Starting Cove home automation system...");

    // Initialize components
    let device_registry = Arc::new(DeviceRegistry::new());
    let event_manager = Arc::new(EventManager::new());
    let device_discovery = DeviceDiscovery::new(device_registry.clone(), event_manager.clone());

    // Start the API server
    let api = Api::new(
        device_registry.clone(),
        SocketAddr::from(([127, 0, 0, 1], 4000)),
    );
    let api_handle = tokio::spawn(async move {
        if let Err(e) = api.start().await {
            error!("API server error: {}", e);
        }
    });

    // Initialize event processor
    let mut event_processor: EventProcessor = EventProcessor::new(
        device_registry.clone(),
        event_manager.subscribe_high_priority(),
        event_manager.subscribe_normal_priority(),
        event_manager.subscribe_low_priority(),
    );

    // Start discovery and event processing
    tokio::select! {
        _ = device_discovery.start_continuous_discovery() => {
            info!("Device discovery completed");
        }
        _ = event_processor.start() => {
            info!("Event processor completed");
        }
    }

    // Wait for shutdown signal
    match signal::ctrl_c().await {
        Ok(()) => {
            info!("Shutdown signal received, stopping services...");
            api_handle.abort();
            info!("Services stopped");
        }
        Err(err) => {
            error!("Unable to listen for shutdown signal: {}", err);
        }
    }

    Ok(())
}

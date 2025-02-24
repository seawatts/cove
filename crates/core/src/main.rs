use std::sync::Arc;

use bus::EventBus;
use discovery::service::DiscoveryService;
use miette::Result;
use owo_colors::OwoColorize;
use registry::RegistryService;
use std::time::Instant;
use tokio::signal;
use tracing::{error, info};
use types::system_service::Service;

use api::{self, ApiService};
use integrations::IntegrationService;
use logging;

pub struct System {
    integration_service: Arc<IntegrationService>,
    api_service: Arc<ApiService>,
    event_bus: Arc<EventBus>,
    discovery_service: Arc<DiscoveryService>,
    registry_service: Arc<RegistryService>,
}

impl System {
    pub async fn start(&self) -> Result<()> {
        // Start EventBus first and wait for it to be ready
        info!("Starting event bus...");
        self.event_bus.clone().start().await?;

        // Start other services
        info!("Starting registry service...");
        self.registry_service.clone().start().await?;

        info!("Starting discovery service...");
        self.discovery_service.clone().start().await?;

        info!("Starting integration service...");
        self.integration_service.clone().start().await?;

        info!("Starting API service...");
        self.api_service.clone().start().await?;

        Ok(())
    }

    pub async fn stop(&self) -> Result<()> {
        // Stop services in reverse order
        info!("Stopping API service...");
        self.api_service.stop().await?;

        info!("Stopping integration service...");
        self.integration_service.stop().await?;

        info!("Stopping discovery service...");
        self.discovery_service.stop().await?;

        info!("Stopping registry service...");
        self.registry_service.stop().await?;

        info!("Stopping event bus...");
        self.event_bus.stop().await?;

        Ok(())
    }
}

const VERSION: &str = env!("CARGO_PKG_VERSION");

#[tokio::main]
async fn main() -> Result<()> {
    let start_time = Instant::now();
    logging::setup_logging()?;

    info!("");
    info!("   {} {}", "▲ Cove".magenta(), VERSION.magenta());

    // Create services
    let api_service = Arc::new(ApiService::new());
    let integration_service = Arc::new(IntegrationService::new());
    let event_bus = Arc::new(EventBus::new());
    let discovery_service = Arc::new(DiscoveryService::new(event_bus.clone()));
    let registry_service = Arc::new(RegistryService::new(event_bus.clone()));
    // Create the system
    let system = Arc::new(System {
        integration_service,
        api_service,
        event_bus,
        discovery_service,
        registry_service,
    });

    // Clone system for the signal handler
    let system_for_signal = system.clone();

    // Start the system in a separate task
    let system_handle = tokio::spawn(async move {
        if let Err(e) = system.start().await {
            error!("System error: {}", e);
        }
    });

    info!("");
    info!("   {} Starting...", "✓".green());
    info!(
        "   {} Ready in {}ms",
        "✓".green(),
        start_time.elapsed().as_millis()
    );

    // Wait for shutdown signal
    match signal::ctrl_c().await {
        Ok(()) => {
            system_for_signal.stop().await?;
            // Wait for the system tasks to complete gracefully
            if let Err(e) = system_handle.await {
                error!("Error waiting for system to stop: {}", e);
            }
            std::process::exit(0);
        }
        Err(err) => {
            error!("Unable to listen for shutdown signal: {}", err);
            std::process::exit(1);
        }
    }
}

use std::sync::Arc;

use bus::EventBus;
use db::DbService;
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
use timeseries::TimeseriesDbService;
pub struct System {
    integration_service: Arc<IntegrationService>,
    api_service: Arc<ApiService>,
    event_bus: Arc<EventBus>,
    discovery_service: Arc<DiscoveryService>,
    registry_service: Arc<RegistryService>,
    db_service: Arc<DbService>,
    timeseries_service: Arc<TimeseriesDbService>,
}

impl System {
    pub async fn start(&self) -> Result<()> {
        // Start database service first to ensure the database is ready
        info!("Starting database service...");
        self.db_service.clone().start().await?;

        // Start EventBus next and wait for it to be ready
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

        info!("Starting timeseries service...");
        self.timeseries_service.clone().start().await?;

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

        info!("Stopping database service...");
        self.db_service.stop().await?;

        info!("Stopping timeseries service...");
        self.timeseries_service.stop().await?;

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
    let event_bus = Arc::new(EventBus::new());
    let api_service = Arc::new(ApiService::new());
    let integration_service = Arc::new(IntegrationService::new());
    let discovery_service = Arc::new(DiscoveryService::new(event_bus.clone()));
    let registry_service = Arc::new(RegistryService::new(event_bus.clone()));

    // Configure database path from environment variable or use default
    let db_path = std::env::var("COVE_DB_PATH").unwrap_or_else(|_| {
        // Use the workspace root directory instead of a relative path
        let workspace_root = std::env::current_dir()
            .unwrap_or_else(|_| std::path::PathBuf::from("."))
            .ancestors()
            .find(|p| p.join("Cargo.toml").exists())
            .unwrap_or_else(|| std::path::Path::new("."))
            .to_path_buf();

        workspace_root
            .join(".data")
            .join("sqlite")
            .join("cove.db")
            .to_string_lossy()
            .to_string()
    });
    let db_service = Arc::new(DbService::new(db_path));
    let timeseries_service = Arc::new(TimeseriesDbService::new());

    // Create the system
    let system = Arc::new(System {
        integration_service,
        api_service,
        event_bus,
        discovery_service,
        registry_service,
        db_service,
        timeseries_service,
    });

    // Start the system
    system.clone().start().await?;

    // Wait for signals
    info!("System running, press Ctrl+C to exit");

    // Wait for shutdown signal
    match signal::ctrl_c().await {
        Ok(()) => {
            system.stop().await?;
            std::process::exit(0);
        }
        Err(err) => {
            error!("Unable to listen for shutdown signal: {}", err);
            std::process::exit(1);
        }
    }
}

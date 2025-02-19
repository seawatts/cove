use std::sync::Arc;

use miette::Result;
use owo_colors::OwoColorize;
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
}

impl System {
    pub async fn start(&self) -> Result<()> {
        self.integration_service.clone().start().await?;
        self.api_service.clone().start().await?;
        Ok(())
    }

    pub async fn stop(&self) -> Result<()> {
        self.api_service.stop().await?;
        self.integration_service.stop().await?;
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

    // Create the system
    let system = Arc::new(System {
        integration_service,
        api_service,
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
            info!("Shutdown signal received, stopping services...");
            if let Err(e) = system_for_signal.stop().await {
                error!("Error during shutdown: {}", e);
            }
            system_handle.abort();
            info!("Services stopped");
        }
        Err(err) => {
            error!("Unable to listen for shutdown signal: {}", err);
        }
    }

    Ok(())
}

pub mod config;
pub mod device;
pub mod discovery;
pub mod error;
pub mod logging;
pub mod protocol;
pub mod types;

use miette::Result;
use tracing::info;

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

    match discovery::discover_all_devices().await {
        Ok(devices) => {
            if !devices.is_empty() {
                info!("✅ Discovered {} devices", devices.len());
                for device in devices {
                    info!("Found device {:#?}", device);
                }
            }
        }
        Err(e) => return Err(e),
    }

    info!("🛑 Stopped device discovery");

    Ok(())
}

use protocols::homekit::HomeKitProtocol;
use std::sync::Arc;

#[derive(Clone)]
pub struct AppState {
    pub homekit_protocol: Arc<HomeKitProtocol>,
}

impl AppState {
    pub async fn new(config_dir: &str) -> miette::Result<Self> {
        // Initialize HomeKit protocol
        let protocol = HomeKitProtocol::new(config_dir).await?;

        Ok(Self {
            homekit_protocol: Arc::new(protocol),
        })
    }
}

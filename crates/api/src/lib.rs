use std::net::SocketAddr;

use async_trait::async_trait;
use miette::Result;
use tracing::error;

use types::system_service::{Service, ServiceHandle};

mod port;
mod router;
mod server;

use port::find_available_port;
use server::Api;

pub struct ApiService {
    api: Api,
    handle: ServiceHandle,
}

impl ApiService {
    pub fn new() -> Self {
        Self {
            api: Api::new(),
            handle: ServiceHandle::new(),
        }
    }
}

#[async_trait]
impl Service for ApiService {
    async fn run(&self) -> Result<()> {
        let port = find_available_port(4000).await?;
        let addr = SocketAddr::from(([0, 0, 0, 0], port));

        // Start the API server and wait for completion
        if let Err(e) = self.api.start(addr).await {
            error!("API server error: {}", e);
        }
        Ok(())
    }

    async fn cleanup(&self) -> Result<()> {
        self.api.stop().await?;
        Ok(())
    }

    fn handle(&self) -> Option<&ServiceHandle> {
        Some(&self.handle)
    }
}

impl Clone for ApiService {
    fn clone(&self) -> Self {
        Self {
            api: self.api.clone(),
            handle: ServiceHandle::new(),
        }
    }
}

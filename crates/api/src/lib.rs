use std::net::SocketAddr;
use std::sync::Arc;

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
        if let Err(e) = self.api.start(SocketAddr::from(([0, 0, 0, 0], port))).await {
            error!("API server error: {}", e);
        }
        Ok(())
    }

    async fn cleanup(&self) -> Result<()> {
        self.api.stop().await
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

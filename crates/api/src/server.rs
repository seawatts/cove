use axum::{routing::get, Router as AxumRouter};
use miette::{Diagnostic, Report, Result};
use std::net::SocketAddr;
use thiserror::Error;
use tokio::net::TcpListener;
use tower_http::cors::{Any, CorsLayer};
use tracing::{error, info};

use crate::router::{self};

#[derive(Debug, Diagnostic, Error)]
#[error("Server error: {0}")]
struct ServerError(#[source] std::io::Error);

#[derive(Clone)]
pub struct Api {
    // registry: Arc<DeviceRegistry>,
}

impl Api {
    pub fn new() -> Self {
        Self {}
    }

    pub async fn start(&self, addr: SocketAddr) -> Result<()> {
        // Create the rspc router
        let (_, _) = router::new().build().unwrap();
        // let registry = self.registry.clone();

        // Configure CORS
        let cors = CorsLayer::new()
            .allow_methods(Any)
            .allow_headers(Any)
            .allow_origin(Any);

        // Create the Axum app with rspc middleware
        let app = AxumRouter::new()
            .route("/", get(|| async { "Hello from Cove!" }))
            // .nest(
            //     "/rspc",
            //     rspc_axum::endpoint(router, move || Ctx {
            //         // registry: registry.clone(),
            //     }),
            // )
            .layer(cors);

        info!("   - Local:     http://localhost:{}", addr.port());
        // Get the local IP address for network access
        if let Ok(local_ip) = local_ip_address::local_ip() {
            info!("   - Network:   http://{}:{}", local_ip, addr.port());
        }

        let listener = TcpListener::bind(addr).await.map_err(|e| {
            // let err = Error::Protocol(ProtocolError::ConnectionFailed {
            //     protocol: Protocol::WiFi,
            //     related: vec![Error::Io(Arc::new(e))],
            // });
            error!("Failed to bind TCP listener: {:?}", e);
            let err: Report = ServerError(e).into();
            err
        })?;

        match axum::serve(listener, app).await {
            Ok(_) => Ok(()),
            Err(e) => {
                error!("API server error: {:?}", e);
                Err(miette::miette!("Server error: {}", e))
            }
        }
    }

    pub async fn stop(&self) -> Result<()> {
        // For now, return Ok since we don't have any cleanup needed
        Ok(())
    }
}

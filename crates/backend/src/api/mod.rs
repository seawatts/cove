mod router;

use axum::{routing::get, Router as AxumRouter};
use miette::Result;
use std::{net::SocketAddr, sync::Arc};
use tokio::net::TcpListener;
use tower_http::cors::{Any, CorsLayer};
use tracing::{error, info};

use crate::{
    device::DeviceRegistry,
    error::{Error, ProtocolError},
    types::Protocol,
};

use self::router::Ctx;

pub struct Api {
    registry: Arc<DeviceRegistry>,
    addr: SocketAddr,
}

impl Api {
    pub fn new(registry: Arc<DeviceRegistry>, addr: SocketAddr) -> Self {
        Self { registry, addr }
    }

    pub async fn start(&self) -> Result<()> {
        // Create the rspc router
        let (router, _) = router::new().build().unwrap();
        let registry = self.registry.clone();

        // Configure CORS
        let cors = CorsLayer::new()
            .allow_methods(Any)
            .allow_headers(Any)
            .allow_origin(Any);

        // Create the Axum app with rspc middleware
        let app = AxumRouter::new()
            .route("/", get(|| async { "Hello from Cove!" }))
            .nest(
                "/rspc",
                rspc_axum::endpoint(router, move || Ctx {
                    registry: registry.clone(),
                }),
            )
            .layer(cors);

        info!("Starting API server on {}", self.addr);

        let listener = TcpListener::bind(self.addr).await.map_err(|e| {
            let err = Error::Protocol(ProtocolError::ConnectionFailed {
                protocol: Protocol::WiFi,
                related: vec![Error::Io(Arc::new(e))],
            });
            error!("Failed to bind TCP listener: {:?}", err);
            err
        })?;

        match axum::serve(listener, app).await {
            Ok(_) => Ok(()),
            Err(e) => {
                let err = Error::Protocol(ProtocolError::ConnectionFailed {
                    protocol: Protocol::WiFi,
                    related: vec![Error::Io(Arc::new(e))],
                });
                error!("API server error: {:?}", err);
                Err(err.into())
            }
        }
    }
}

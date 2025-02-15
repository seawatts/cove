mod router;

use axum::{routing::get, Router as AxumRouter};
use mdns_sd::{ServiceDaemon, ServiceInfo};
use miette::Result;
use std::{net::SocketAddr, sync::Arc};
use tokio::net::TcpListener;
use tower_http::cors::{Any, CorsLayer};
use tracing::{error, info};

use crate::{
    config::ServiceAdvertisementConfig,
    device::DeviceRegistry,
    error::{Error, ProtocolError},
    types::Protocol,
};

use self::router::Ctx;

pub struct Api {
    registry: Arc<DeviceRegistry>,
    addr: SocketAddr,
    mdns: Option<ServiceDaemon>,
}

impl Api {
    pub fn new(registry: Arc<DeviceRegistry>, addr: SocketAddr) -> Self {
        Self {
            registry,
            addr,
            mdns: None,
        }
    }

    pub fn start_mdns_advertisement(&mut self, config: &ServiceAdvertisementConfig) -> Result<()> {
        let mdns = ServiceDaemon::new().expect("Failed to create mDNS daemon");

        // Create the service info
        let host_name = hostname::get()
            .map(|h| h.to_string_lossy().to_string())
            .unwrap_or_else(|_| "cove-server".to_string())
            + ".local.";

        let service_type = &config.service_type;
        let instance_name = format!("Cove - {}", host_name.trim_end_matches(".local."));

        let mut service_info = ServiceInfo::new(
            &service_type,
            &instance_name,
            &host_name,
            "",
            self.addr.port(),
            config.txt_records.clone(),
        )
        .expect("Failed to create service info");

        // Register the service
        mdns.register(service_info)
            .expect("Failed to register mDNS service");

        self.mdns = Some(mdns);
        info!("Registered mDNS service: {}", instance_name);

        Ok(())
    }

    pub async fn start(&mut self) -> Result<()> {
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

impl Drop for Api {
    fn drop(&mut self) {
        if let Some(mdns) = self.mdns.take() {
            mdns.shutdown().ok();
        }
    }
}

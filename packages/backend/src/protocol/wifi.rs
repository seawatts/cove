use std::{collections::HashSet, net::IpAddr, sync::Arc, time::Duration};

use chrono::Utc;
use mdns_sd::{ServiceDaemon, ServiceEvent, TxtProperty};
use miette::{Report, Result};
use serde_json::json;
use tracing::{debug, error, info, warn};

use crate::{
    error::{DiscoveryError, Error, ProtocolError},
    types::{
        BaseDevice, DeviceCapabilities, DeviceCategory, DeviceMetadata, DeviceStatus, Location,
        NetworkInfo, Protocol, WiFiDevice,
    },
};

// Common mDNS service types for various devices
const MDNS_SERVICE_TYPES: &[&str] = &[
    "_googlecast._tcp.local.",       // Chromecast devices
    "_airplay._tcp.local.",          // AirPlay devices
    "_spotify-connect._tcp.local.",  // Spotify devices
    "_sonos._tcp.local.",            // Sonos speakers
    "_hue._tcp.local.",              // Philips Hue
    "_matter._tcp.local.",           // Matter devices
    "_raop._tcp.local.",             // AirPlay speakers
    "_smartthings-hedge._tcp.local", // SmartThings
    "_dyson_mqtt._tcp.local",        // Dyson devices
];

const DEFAULT_TIMEOUT: Duration = Duration::from_secs(15);

pub struct WiFiProtocol {
    timeout: Duration,
}

impl WiFiProtocol {
    pub fn new() -> Self {
        Self {
            timeout: DEFAULT_TIMEOUT,
        }
    }

    pub fn with_timeout(timeout: Duration) -> Self {
        Self { timeout }
    }

    pub async fn discover(&self) -> Result<Vec<WiFiDevice>> {
        let mdns = ServiceDaemon::new().map_err(|e| {
            let err = DiscoveryError::Failed {
                protocol: Protocol::WiFi,
                span: (0..1).into(),
                related: vec![Error::Protocol(ProtocolError::Mdns(Arc::new(e)))],
            };
            error!("{:?}", Report::new(err.clone()));
            err
        })?;
        let mut devices = Vec::new();
        let mut browse_handles = Vec::new();

        // Browse for each service type
        for &service_type in MDNS_SERVICE_TYPES {
            let browse_handle = mdns.browse(service_type).map_err(|e| {
                let err = DiscoveryError::Failed {
                    protocol: Protocol::WiFi,
                    span: (0..1).into(),
                    related: vec![Error::Protocol(ProtocolError::Mdns(Arc::new(e)))],
                };
                error!("{:?}", Report::new(err.clone()));
                err
            })?;
            browse_handles.push((service_type, browse_handle));
        }

        // Process events for a while
        let start = std::time::Instant::now();
        while start.elapsed() < self.timeout {
            for (service_type, browse_handle) in &browse_handles {
                if let Ok(event) = browse_handle.recv_timeout(Duration::from_millis(100)) {
                    match event {
                        ServiceEvent::ServiceResolved(info) => {
                            debug!("Resolved service: {:?}", info);

                            let addresses: HashSet<IpAddr> =
                                info.get_addresses().iter().cloned().collect();
                            let primary_address = addresses.iter().next().cloned();

                            let device = WiFiDevice {
                                base: BaseDevice {
                                    id: format!("wifi_{}", info.get_fullname()),
                                    r#type: info.get_type().to_string(),
                                    friendly_name: info.get_fullname().to_string(),
                                    description: format!("WiFi device: {}", info.get_fullname()),
                                    protocol: Protocol::WiFi,
                                    status: DeviceStatus::Online,
                                    categories: vec![DeviceCategory::Unknown],
                                    capabilities: DeviceCapabilities::default(),
                                    location: Location {
                                        room: None,
                                        floor: None,
                                        zone: None,
                                    },
                                    metadata: DeviceMetadata {
                                        manufacturer: None,
                                        model: None,
                                        firmware_version: None,
                                        hardware_version: None,
                                        icon_url: None,
                                    },
                                    network_info: Some(NetworkInfo {
                                        addresses: addresses
                                            .iter()
                                            .map(|addr| addr.to_string())
                                            .collect(),
                                        primary_address: primary_address
                                            .map(|addr| addr.to_string()),
                                        port: Some(info.get_port()),
                                        hostname: Some(info.get_hostname().to_string()),
                                        mac_address: None,
                                    }),
                                    created: Utc::now(),
                                    updated: Utc::now(),
                                    last_online: Some(Utc::now()),
                                    raw_details: json!({
                                        "service_type": service_type,
                                        "fullname": info.get_fullname(),
                                        "hostname": info.get_hostname(),
                                        "port": info.get_port(),
                                        "addresses": addresses,
                                    }),
                                },
                                mdns_service_type: service_type.to_string(),
                                mdns_properties: info
                                    .get_properties()
                                    .iter()
                                    .map(|prop: &TxtProperty| {
                                        (prop.key().to_string(), prop.val_str().to_string())
                                    })
                                    .collect(),
                            };

                            devices.push(device);
                        }
                        ServiceEvent::ServiceFound(service_type, fullname) => {
                            debug!("Found service: {} (type: {})", fullname, service_type);
                        }
                        ServiceEvent::SearchStarted(service_type) => {
                            debug!("Search started: {}", service_type);
                        }
                        ServiceEvent::SearchStopped(service_type) => {
                            debug!("Search stopped: {}", service_type);
                        }
                        ServiceEvent::ServiceRemoved(service_type, fullname) => {
                            debug!("Service removed: {} (type: {})", fullname, service_type);
                        }
                    }
                }
            }
            tokio::time::sleep(Duration::from_millis(100)).await;
        }

        if devices.is_empty() {
            warn!("No WiFi devices found");
        } else {
            info!("Found {} WiFi devices", devices.len());
        }

        Ok(devices)
    }
}

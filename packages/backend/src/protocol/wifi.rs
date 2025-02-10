use std::{
    collections::{HashMap, HashSet},
    net::IpAddr,
    sync::Arc,
    time::Duration,
};

use async_trait::async_trait;
use chrono::Utc;
use mdns_sd::{Receiver, ServiceDaemon, ServiceEvent, TxtProperty};
use miette::{Report, Result};
use once_cell::sync::Lazy;
use serde_json::json;
use tokio::sync::{broadcast, RwLock};
use tracing::{debug, error, info};

use crate::{
    discovery::{error::DiscoveryError, DeviceProtocol},
    error::{Error, ProtocolError},
    types::{
        BaseDevice, DeviceCapabilities, DeviceCategory, DeviceEvent, DeviceMetadata, DeviceStatus,
        Location, NetworkInfo, Protocol, WiFiDevice,
    },
};

// Common mDNS service types for various devices
const MDNS_SERVICE_TYPES: &[&str] = &[
    // Media and Entertainment
    "_airplay._tcp.local.",         // AirPlay devices
    "_spotify-connect._tcp.local.", // Spotify devices
    "_sonos._tcp.local.",           // Sonos speakers
    "_raop._tcp.local.",            // AirPlay speakers
    "_roku._tcp.local.",            // Roku devices
    "_plex._tcp.local.",            // Plex media servers
    "_nvstream._tcp.local.",        // NVIDIA Shield/GameStream
    "_steam._tcp.local.",           // Steam Link/Steam devices
    "_kodi._tcp.local.",            // Kodi media centers
    // Smart Home Hubs and Protocols
    "_hue._tcp.local.",           // Philips Hue
    "_matter._tcp.local.",        // Matter devices
    "_smartthings._tcp.local.",   // SmartThings hub
    "_homekit._tcp.local.",       // HomeKit devices
    "_hap._tcp.local.",           // HomeKit Accessory Protocol
    "_homeassistant._tcp.local.", // Home Assistant
    "_openhab._tcp.local.",       // OpenHAB
    "_mqtt._tcp.local.",          // MQTT brokers
    "_zigbee._tcp.local.",        // Zigbee gateways
    // Smart Home Devices
    "_nanoleaf._tcp.local.",   // Nanoleaf lights
    "_lifx._tcp.local.",       // LIFX lights
    "_wemo._tcp.local.",       // Wemo devices
    "_tplink._tcp.local.",     // TP-Link smart devices
    "_tuya._tcp.local.",       // Tuya devices
    "_yeelight._tcp.local.",   // Yeelight devices
    "_dyson_mqtt._tcp.local.", // Dyson devices
    "_nest._tcp.local.",       // Nest devices
    "_ring._tcp.local.",       // Ring devices
    "_arlo._tcp.local.",       // Arlo cameras
    "_axis._tcp.local.",       // Axis cameras
    "_insteon._tcp.local.",    // Insteon devices
    "_lutron._tcp.local.",     // Lutron devices
    "_ecobee._tcp.local.",     // Ecobee thermostats
    "_nest-cam._tcp.local.",   // Nest cameras
    // Apple Devices
    "_flametouch._tcp.local.",                        // Flametouch devices
    "_companion-link._tcp.local.",                    // iOS devices (Handoff, Universal Clipboard)
    "_apple-mobdev2._tcp.local.",                     // iOS devices
    "_apple-mobdev._tcp.local.",                      // iOS devices (older)
    "_apple-pairable._tcp.local.",                    // iOS pairing
    "_sleep-proxy._udp.local.",                       // Apple devices (sleep proxy)
    "_touch-able._tcp.local.",                        // iOS Remote app
    "_airport._tcp.local.",                           // AirPort base stations
    "_afpovertcp._tcp.local.",                        // Apple File Sharing
    "_airdrop._tcp.local.",                           // AirDrop
    "_adisk._tcp.local.",                             // Time Machine
    "_device-info._tcp.local.",                       // Apple device info
    "_apple-continuity._tcp.local.",                  // Continuity service
    "_apple-mobdev2._sub._apple-mobdev._tcp.local.",  // Modern iOS devices
    "_services._dns-sd._udp.local.",                  // DNS Service Discovery
    "_ipheth-control._tcp.local.",                    // iPhone USB Ethernet
    "_apple-midi._udp.local.",                        // Apple MIDI
    "_apple-midi._tcp.local.",                        // Apple MIDI
    "_apple-mobdev._sub._apple-mobdev._tcp.local.",   // iOS device sub-type
    "_apple-mobdev2._sub._apple-mobdev2._tcp.local.", // Modern iOS device sub-type
    "_apple-mobdev._sub._apple-mobdev2._tcp.local.",  // iOS device alternative sub-type
    "_apple-iphone._tcp.local.",                      // iPhone specific
    "_apple-iphone._udp.local.",                      // iPhone specific (UDP)
    "_apple-ios._tcp.local.",                         // iOS devices
    "_apple-ios._udp.local.",                         // iOS devices (UDP)
    "_apple-remotedevice._tcp.local.",                // Remote device management
    "_apple-sync._tcp.local.",                        // Apple sync service
    "_apple-findmy._tcp.local.",                      // Find My service
    "_apple-findmy._udp.local.",                      // Find My service (UDP)
    // Android Devices
    "_adb._tcp.local.",               // Android Debug Bridge
    "_androidtvremote._tcp.local.",   // Android TV Remote
    "_googlerpc._tcp.local.",         // Google RPC (used by various Google/Android apps)
    "_googlezone._tcp.local.",        // Google Cast zones
    "_androidtvremote2._tcp.local.",  // Android TV Remote v2
    "_androidtvremote3._tcp.local.",  // Android TV Remote v3
    "_android._tcp.local.",           // General Android devices
    "_androidphone._tcp.local.",      // Android phones
    "_androidtablet._tcp.local.",     // Android tablets
    "_wear._tcp.local.",              // Android Wear/WearOS devices
    "_tizen._tcp.local.",             // Samsung Tizen devices
    "_miio._udp.local.",              // Xiaomi/MIUI devices
    "_googlechrome._tcp.local.",      // Chrome/Chromium browsers
    "_googlecast._tcp.local.",        // Chromecast devices
    "_googlecast-remote._tcp.local.", // Google Cast Remote
    "_googledevices._tcp.local.",     // Google devices (Pixel, etc)
    // Network and Printing
    "_ipp._tcp.local.",            // Internet Printing Protocol
    "_ipps._tcp.local.",           // Secure Internet Printing Protocol
    "_scanner._tcp.local.",        // Network Scanners
    "_pdl-datastream._tcp.local.", // Printer Page Description Language
    "_printer._tcp.local.",        // Network Printers
    "_ftp._tcp.local.",            // FTP servers
    "_sftp-ssh._tcp.local.",       // SFTP servers
    "_smb._tcp.local.",            // Samba/Windows File Sharing
    "_ssh._tcp.local.",            // SSH servers
    "_rfb._tcp.local.",            // VNC servers
    "_rdp._tcp.local.",            // Remote Desktop Protocol
    "_http._tcp.local.",           // HTTP servers
    "_https._tcp.local.",          // HTTPS servers
    // Gaming
    "_minecraft._tcp.local.",       // Minecraft servers
    "_ps4._tcp.local.",             // PlayStation 4
    "_ps5._tcp.local.",             // PlayStation 5
    "_xboxone._tcp.local.",         // Xbox One
    "_xbox._tcp.local.",            // Xbox Series X/S
    "_nintendo-switch._tcp.local.", // Nintendo Switch
    // Voice Assistants
    "_alexa._tcp.local.",      // Amazon Alexa devices
    "_googlehome._tcp.local.", // Google Home devices
    "_siri._tcp.local.",       // Siri devices
    // Misc IoT
    "_esphome._tcp.local.", // ESPHome devices
    "_tasmota._tcp.local.", // Tasmota devices
    "_shelly._tcp.local.",  // Shelly devices
    "_xiaomi._tcp.local.",  // Xiaomi devices
];

pub static INSTANCE: Lazy<Arc<WiFiProtocol>> =
    Lazy::new(|| Arc::new(WiFiProtocol::new().expect("Failed to initialize WiFiProtocol")));

#[derive(Clone)]
pub struct WiFiProtocol {
    browse_handles: Arc<RwLock<HashMap<String, Receiver<ServiceEvent>>>>,
}

impl WiFiProtocol {
    pub fn new() -> Result<Self> {
        Self::create_mdns_service()
    }

    pub fn get_instance() -> Arc<WiFiProtocol> {
        INSTANCE.clone()
    }

    fn create_mdns_service() -> Result<Self> {
        let daemon = ServiceDaemon::new().map_err(|e| {
            let err = DiscoveryError::Failed {
                protocol: Protocol::WiFi,
                span: (0..1).into(),
                related: vec![Error::Protocol(ProtocolError::Mdns(Arc::new(e)))],
            };

            error!("{:?}", Report::new(err.clone()));
            err
        })?;

        let mut browse_handles = HashMap::new();
        for &service_type in MDNS_SERVICE_TYPES {
            let handle = daemon.browse(service_type).map_err(|e| {
                let err = DiscoveryError::Failed {
                    protocol: Protocol::WiFi,
                    span: (0..1).into(),
                    related: vec![Error::Protocol(ProtocolError::Mdns(Arc::new(e)))],
                };
                error!("{:?}", Report::new(err.clone()));
                err
            })?;

            browse_handles.insert(service_type.to_string(), handle);
        }
        Ok(Self {
            browse_handles: Arc::new(RwLock::new(browse_handles)),
        })
    }

    async fn handle_mdns_event(
        event: ServiceEvent,
        service_type: &str,
        device_tx: &broadcast::Sender<DeviceEvent>,
    ) {
        match event {
            ServiceEvent::ServiceResolved(info) => {
                debug!("Resolved service: {:?}", info);
                let addresses: HashSet<IpAddr> = info.get_addresses().iter().cloned().collect();
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
                            addresses: addresses.iter().map(|addr| addr.to_string()).collect(),
                            primary_address: primary_address.map(|addr| addr.to_string()),
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

                let _ = device_tx.send(DeviceEvent::DeviceUpdated(device.into()));
            }
            ServiceEvent::ServiceRemoved(_, fullname) => {
                debug!("Service removed: {} (type: {})", fullname, service_type);
                let device_id = format!("wifi_{}", fullname);
                let _ = device_tx.send(DeviceEvent::DeviceRemoved(device_id));
            }
            ServiceEvent::ServiceFound(_, fullname) => {
                debug!("Found service: {} (type: {})", fullname, service_type);
            }
            ServiceEvent::SearchStarted(_) => {
                debug!("Search started for type: {}", service_type);
            }
            ServiceEvent::SearchStopped(_) => {
                debug!("Search stopped for type: {}", service_type);
            }
        }
    }

    async fn monitor_mdns(&self, device_tx: broadcast::Sender<DeviceEvent>) {
        info!("Starting WiFi device monitoring...");

        loop {
            // Create a task for each service type
            let mut handles = Vec::new();
            let browse_handles = self.browse_handles.read().await;
            for (service_type, browse_handle) in browse_handles.iter() {
                let device_tx = device_tx.clone();
                let service_type = service_type.clone();
                let browse_handle = browse_handle.clone();

                let handle = tokio::spawn(async move {
                    loop {
                        match browse_handle.recv_async().await {
                            Ok(event) => {
                                Self::handle_mdns_event(event, &service_type, &device_tx).await;
                            }
                            Err(e) => {
                                error!("mDNS receive error for {}: {}", service_type, e);
                                break; // Break on error to allow service restart
                            }
                        }
                    }
                });

                handles.push(handle);
            }
            drop(browse_handles);

            // Wait for any task to complete (which indicates an error)
            let (result, _, remaining) = futures::future::select_all(handles).await;
            if let Err(e) = result {
                error!("mDNS monitoring task failed: {}", e);
            }

            // Cleanup remaining tasks
            for handle in remaining {
                handle.abort();
            }

            // Mark all devices as offline since we lost connectivity
            let _ = device_tx.send(DeviceEvent::NetworkOffline);

            // Wait before trying to restart
            info!("Network connectivity issue detected, waiting before restart...");
            tokio::time::sleep(Duration::from_secs(5)).await;

            // Try to recreate the mDNS service
            match Self::create_mdns_service() {
                Ok(new_service) => {
                    info!("Successfully recreated mDNS service");
                    *self.browse_handles.write().await =
                        new_service.browse_handles.write().await.clone();
                }
                Err(e) => {
                    error!("Failed to recreate mDNS service: {:?}", e);
                    tokio::time::sleep(Duration::from_secs(5)).await;
                    continue;
                }
            }
        }
    }
}

#[async_trait]
impl DeviceProtocol for WiFiProtocol {
    fn protocol_name(&self) -> &'static str {
        "WiFi"
    }

    fn get_instance() -> Arc<Self> {
        INSTANCE.clone()
    }

    async fn start_discovery(&self, device_events: broadcast::Sender<DeviceEvent>) -> Result<()> {
        // Start the monitoring in the background
        tokio::spawn({
            let this = self.clone();
            async move {
                this.monitor_mdns(device_events).await;
            }
        });

        Ok(())
    }
}

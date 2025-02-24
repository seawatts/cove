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
use types::{
    devices::{Device, DeviceKind},
    BusEvent,
};

use crate::protocol::error::ProtocolError;
use crate::service::DeviceProtocol;
use bus::EventBus;

#[derive(Debug, Clone)]
pub struct DiscoveryError {
    pub message: String,
}

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

pub static INSTANCE: Lazy<Arc<MdnsProtocol>> = Lazy::new(|| {
    let event_bus = Arc::new(EventBus::new());
    Arc::new(MdnsProtocol::new(event_bus).expect("Failed to initialize MdnsProtocol"))
});

#[derive(Clone)]
pub struct MdnsProtocol {
    browse_handles: Arc<RwLock<HashMap<String, Receiver<ServiceEvent>>>>,
    shutdown: broadcast::Sender<()>,
    daemon: Arc<ServiceDaemon>,
    event_bus: Arc<EventBus>,
}

impl MdnsProtocol {
    pub fn new(event_bus: Arc<EventBus>) -> Result<Self> {
        let (shutdown_tx, _) = broadcast::channel(1);
        let daemon = ServiceDaemon::new()
            .map_err(|e| Report::msg(format!("Failed to create mDNS daemon: {}", e)))?;
        let daemon = Arc::new(daemon);

        let mut browse_handles = HashMap::new();
        for &service_type in MDNS_SERVICE_TYPES {
            match daemon.browse(service_type) {
                Ok(handle) => {
                    browse_handles.insert(service_type.to_string(), handle);
                }
                Err(e) => {
                    error!("Failed to browse service type {}: {}", service_type, e);
                    continue;
                }
            }
        }

        Ok(Self {
            browse_handles: Arc::new(RwLock::new(browse_handles)),
            shutdown: shutdown_tx,
            daemon,
            event_bus,
        })
    }

    pub fn get_instance() -> Arc<MdnsProtocol> {
        INSTANCE.clone()
    }

    async fn handle_mdns_event(event: ServiceEvent, service_type: &str, event_bus: &EventBus) {
        match event {
            ServiceEvent::ServiceResolved(info) => {
                debug!("Resolved service: {:?}", info);
                let addresses: HashSet<IpAddr> = info.get_addresses().iter().cloned().collect();
                let primary_address = addresses.iter().next().cloned();

                debug!(
                    "Publishing DeviceDiscovered event for resolved service: {}",
                    info.get_fullname()
                );
                if let Err(e) = event_bus
                    .publish(BusEvent::DeviceDiscovered {
                        id: format!("wifi_{}", info.get_fullname()),
                        device_type: info.get_type().to_string(),
                        metadata: info
                            .get_properties()
                            .iter()
                            .map(|prop| (prop.key().to_string(), prop.val_str().to_string()))
                            .collect(),
                    })
                    .await
                {
                    error!("Failed to publish DeviceDiscovered event: {}", e);
                } else {
                    debug!(
                        "Successfully published DeviceDiscovered event for: {}",
                        info.get_fullname()
                    );
                }
            }
            ServiceEvent::ServiceRemoved(_, fullname) => {
                info!("Service removed: {} (type: {})", fullname, service_type);
                let device_id = format!("wifi_{}", fullname);
                // let _ = device_tx.send(DeviceEvent::DeviceRemoved(device_id));
            }
            ServiceEvent::ServiceFound(_, fullname) => {
                info!("Found service: {} (type: {})", fullname, service_type);
                if let Err(e) = event_bus
                    .publish(BusEvent::DeviceDiscovered {
                        id: format!("wifi_{}", fullname),
                        device_type: service_type.to_string(),
                        metadata: HashMap::new(),
                    })
                    .await
                {
                    error!("Failed to publish DeviceDiscovered event: {}", e);
                } else {
                    debug!(
                        "Successfully published DeviceDiscovered event for: {}",
                        fullname
                    );
                }
            }
            ServiceEvent::SearchStarted(_) => {
                // info!("Search started for type: {}", service_type);
            }
            ServiceEvent::SearchStopped(_) => {
                // info!("Search stopped for type: {}", service_type);
            }
        }
    }

    async fn monitor_mdns(&self) {
        info!("Starting WiFi device monitoring...");
        let mut shutdown_rx = self.shutdown.subscribe();
        let browse_handles = self.browse_handles.read().await;

        if browse_handles.is_empty() {
            error!("No mDNS browse handles available");
            return;
        }

        let mut join_set = tokio::task::JoinSet::new();

        // Start a monitoring task for each service type
        for (service_type, browse_handle) in browse_handles.iter() {
            let service_type = service_type.clone();
            let browse_handle = browse_handle.clone();
            let mut shutdown = shutdown_rx.resubscribe();
            let event_bus = self.event_bus.clone();

            join_set.spawn(async move {
                loop {
                    tokio::select! {
                        result = browse_handle.recv_async() => {
                            match result {
                                Ok(event) => {
                                    // info!("Received mDNS event: {:?}", event);
                                    Self::handle_mdns_event(event, &service_type, &event_bus).await;
                                }
                                Err(e) => {
                                    error!("mDNS receive error for {}: {}", service_type, e);
                                    break;
                                }
                            }
                        }
                        _ = shutdown.recv() => {
                            info!("Shutting down mDNS monitoring for {}", service_type);
                            break;
                        }
                    }
                }
            });
        }
        drop(browse_handles);

        // Wait for shutdown signal or all tasks to complete
        tokio::select! {
            _ = shutdown_rx.recv() => {
                info!("Received shutdown signal, stopping WiFi monitoring");
                join_set.abort_all();
            }
            _ = async {
                while join_set.join_next().await.is_some() {}
            } => {
                info!("All mDNS monitoring tasks completed");
            }
        }

        info!("WiFi device monitoring stopped");
    }
}

#[async_trait]
impl DeviceProtocol for MdnsProtocol {
    fn protocol_name(&self) -> &'static str {
        "mDNS"
    }

    fn get_instance() -> Arc<Self> {
        INSTANCE.clone()
    }

    async fn start_discovery(&self, _event_bus: EventBus) -> Result<()> {
        tokio::spawn({
            let this = self.clone();
            async move {
                this.monitor_mdns().await;
            }
        });

        Ok(())
    }

    async fn stop_discovery(&self) -> Result<()> {
        // Send shutdown signal
        let _ = self.shutdown.send(());

        // Clean up mDNS daemon
        let mut handles = self.browse_handles.write().await;
        handles.clear();

        Ok(())
    }
}

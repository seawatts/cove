use strum_macros::Display;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Display)]
pub enum Protocol {
    Bluetooth,
    Generic,
    Matter,
    MQTT,
    WiFi,
    Zigbee,
    Usb,
    SSE,
    ESPHome,
}

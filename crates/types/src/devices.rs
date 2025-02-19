pub enum DeviceKind {
    Light,    // Any device whose primary function is lighting
    Switch,   // Any device whose primary function is switching things on/off
    Sensor,   // Any device whose primary function is sensing/measuring
    Media,    // Media playback devices
    Speaker,  // Audio output devices
    Display,  // Visual output devices
    Climate,  // Climate control devices
    Camera,   // Imaging devices
    Security, // Security-related devices
    Other,    // Fallback for uncategorized devices
}

pub struct Device {
    pub id: String,
    pub kind: DeviceKind,
    pub capabilities: Vec<Capability>,
    pub protocol: Protocol,
}

pub trait Device: std::any::Any {
    fn as_any(&self) -> &dyn std::any::Any;
    fn send_command(&self, command: String) -> Result<(), Error>;
    fn authenticate(&self) -> Result<(), Error>;
}

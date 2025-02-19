#[derive(Debug, Clone, PartialEq)]
pub enum Capability {
    // Sensor capabilities
    Temperature,
    Humidity,
    CO2,
    Motion,
    Light,
    AirQuality,
    Noise,
    Pressure,

    // Control capabilities
    OnOff,
    Brightness,
    ColorTemperature,
    RGB,

    // Climate capabilities
    Heating,
    Cooling,
    Fan,

    // Media capabilities
    PlayPause,
    Volume,
    MediaInfo,

    // Other capabilities
    Other(String),
}

pub trait Capability {
    fn as_any(&self) -> &dyn std::any::Any;
}

pub trait Temperature: Capability {
    fn set(&self, temperature: f32);
    fn get(&self) -> f32;
}

pub trait Humidity: Capability {
    fn set(&self, humidity: f32);
    fn get(&self) -> f32;
}

pub trait CO2: Capability {
    fn set(&self, co2: f32);
    fn get(&self) -> f32;
}

pub trait Motion: Capability {
    fn set(&self, motion: bool);
    fn get(&self) -> bool;
}

pub trait Light: Capability {
    fn set(&self, light: bool);
    fn get(&self) -> bool;
}

pub trait AirQuality: Capability {
    fn set(&self, air_quality: f32);
    fn get(&self) -> f32;
}

pub trait Noise: Capability {
    fn set(&self, noise: f32);
    fn get(&self) -> f32;
}

pub trait Pressure: Capability {
    fn set(&self, pressure: f32);
    fn get(&self) -> f32;
}

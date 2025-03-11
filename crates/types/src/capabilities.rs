use async_trait::async_trait;
use chrono::{DateTime, Utc};
use miette::Result;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::any::Any;

// Keep existing enum for backwards compatibility
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
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

// New trait-based system
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum CapabilityType {
    Sensor(SensorType),
    Switch,
    Button,
    Light(LightType),
    Climate(ClimateType),
    Fan(FanType),
    Display,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum SensorType {
    Temperature,
    Humidity,
    AirQuality(AirQualityMetric),
    Motion,
    Light,
    Pressure,
    CO2,
    VOC,
    Noise,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum AirQualityMetric {
    PM25,
    PM10,
    AQI,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum LightType {
    OnOff,
    Dimmable,
    Color,
    ColorTemperature,
    Strobe,
    Pattern,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum ClimateType {
    Thermostat,
    AirConditioner,
    Heater,
    Fan,
    Dehumidifier,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum FanType {
    OnOff,
    Speed,
    Direction,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CapabilityState {
    pub timestamp: DateTime<Utc>,
    pub value: Value,
}

#[async_trait]
pub trait DeviceCapability: Send + Sync {
    fn id(&self) -> &str;
    fn name(&self) -> &str;
    fn capability_type(&self) -> CapabilityType;
    async fn get_state(&self) -> Result<CapabilityState>;

    // Allow downcasting to concrete types
    fn as_any(&self) -> &dyn Any;
}

// Sensor-specific traits
#[async_trait]
pub trait TemperatureSensor: DeviceCapability {
    async fn get_temperature(&self) -> Result<f64>;
    fn get_temperature_unit(&self) -> &str;
}

#[async_trait]
pub trait HumiditySensor: DeviceCapability {
    async fn get_humidity(&self) -> Result<f64>;
}

#[async_trait]
pub trait AirQualitySensor: DeviceCapability {
    async fn get_pm25(&self) -> Result<f64>;
    async fn get_pm10(&self) -> Result<f64>;
    async fn get_aqi(&self) -> Result<f64>;
}

#[async_trait]
pub trait CO2Sensor: DeviceCapability {
    async fn get_co2(&self) -> Result<f64>;
}

// Switch/Control traits
#[async_trait]
pub trait Switchable: DeviceCapability {
    async fn turn_on(&self) -> Result<()>;
    async fn turn_off(&self) -> Result<()>;
    async fn get_state(&self) -> Result<bool>;
}

#[async_trait]
pub trait Dimmable: DeviceCapability {
    async fn set_brightness(&self, level: u8) -> Result<()>;
    async fn get_brightness(&self) -> Result<u8>;
}

// Fan control traits
#[async_trait]
pub trait FanControl: DeviceCapability {
    async fn set_speed(&self, speed: u8) -> Result<()>;
    async fn get_speed(&self) -> Result<u8>;
    async fn set_direction(&self, clockwise: bool) -> Result<()>;
    async fn get_direction(&self) -> Result<bool>;
}

// Events for capability state changes
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CapabilityEvent {
    StateChanged {
        device_id: String,
        capability_id: String,
        capability_type: CapabilityType,
        state: CapabilityState,
    },
    Error {
        device_id: String,
        capability_id: String,
        error: String,
    },
}

// pub trait Temperature: Capability {
//     fn set(&self, temperature: f32);
//     fn get(&self) -> f32;
// }

// pub trait Humidity: Capability {
//     fn set(&self, humidity: f32);
//     fn get(&self) -> f32;
// }

// pub trait CO2: Capability {
//     fn set(&self, co2: f32);
//     fn get(&self) -> f32;
// }

// pub trait Motion: Capability {
//     fn set(&self, motion: bool);
//     fn get(&self) -> bool;
// }

// pub trait Light: Capability {
//     fn set(&self, light: bool);
//     fn get(&self) -> bool;
// }

// pub trait AirQuality: Capability {
//     fn set(&self, air_quality: f32);
//     fn get(&self) -> f32;
// }

// pub trait Noise: Capability {
//     fn set(&self, noise: f32);
//     fn get(&self) -> f32;
// }

// pub trait Pressure: Capability {
//     fn set(&self, pressure: f32);
//     fn get(&self) -> f32;
// }

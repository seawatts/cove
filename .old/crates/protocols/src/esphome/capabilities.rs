use async_trait::async_trait;
use miette::Result;
use serde_json::json;
use std::sync::Arc;
use tokio::sync::RwLock;
use types::capabilities::{
    AirQualityMetric, AirQualitySensor, CapabilityState, CapabilityType, DeviceCapability,
    HumiditySensor, SensorType, TemperatureSensor,
};

pub struct ESPHomeSensor {
    id: String,
    name: String,
    sensor_type: SensorType,
    unit: String,
    state: Arc<RwLock<Option<f64>>>,
}

impl ESPHomeSensor {
    pub fn new(id: String, name: String, sensor_type: SensorType, unit: String) -> Self {
        Self {
            id,
            name,
            sensor_type,
            unit,
            state: Arc::new(RwLock::new(None)),
        }
    }

    pub async fn update_value(&self, value: f64) -> Result<()> {
        let mut state = self.state.write().await;
        *state = Some(value);
        Ok(())
    }
}

#[async_trait]
impl DeviceCapability for ESPHomeSensor {
    fn id(&self) -> &str {
        &self.id
    }

    fn name(&self) -> &str {
        &self.name
    }

    fn capability_type(&self) -> CapabilityType {
        CapabilityType::Sensor(self.sensor_type.clone())
    }

    async fn get_state(&self) -> Result<CapabilityState> {
        let state = *self.state.read().await;
        Ok(CapabilityState {
            timestamp: chrono::Utc::now(),
            value: json!({
                "value": state,
                "unit": self.unit,
            }),
        })
    }

    fn as_any(&self) -> &dyn std::any::Any {
        self
    }
}

#[async_trait]
impl TemperatureSensor for ESPHomeSensor {
    async fn get_temperature(&self) -> Result<f64> {
        match self.sensor_type {
            SensorType::Temperature => {
                let state = self.state.read().await;
                state.ok_or_else(|| miette::miette!("No temperature reading available"))
            }
            _ => Err(miette::miette!("Not a temperature sensor")),
        }
    }

    fn get_temperature_unit(&self) -> &str {
        &self.unit
    }
}

#[async_trait]
impl HumiditySensor for ESPHomeSensor {
    async fn get_humidity(&self) -> Result<f64> {
        match self.sensor_type {
            SensorType::Humidity => {
                let state = self.state.read().await;
                state.ok_or_else(|| miette::miette!("No humidity reading available"))
            }
            _ => Err(miette::miette!("Not a humidity sensor")),
        }
    }
}

#[async_trait]
impl AirQualitySensor for ESPHomeSensor {
    async fn get_pm25(&self) -> Result<f64> {
        match &self.sensor_type {
            SensorType::AirQuality(metric) => match metric {
                AirQualityMetric::PM25 => {
                    let state = self.state.read().await;
                    state.ok_or_else(|| miette::miette!("No PM2.5 reading available"))
                }
                _ => Err(miette::miette!("Not a PM2.5 sensor")),
            },
            _ => Err(miette::miette!("Not an air quality sensor")),
        }
    }

    async fn get_pm10(&self) -> Result<f64> {
        match &self.sensor_type {
            SensorType::AirQuality(metric) => match metric {
                AirQualityMetric::PM10 => {
                    let state = self.state.read().await;
                    state.ok_or_else(|| miette::miette!("No PM10 reading available"))
                }
                _ => Err(miette::miette!("Not a PM10 sensor")),
            },
            _ => Err(miette::miette!("Not an air quality sensor")),
        }
    }

    async fn get_aqi(&self) -> Result<f64> {
        match &self.sensor_type {
            SensorType::AirQuality(metric) => match metric {
                AirQualityMetric::AQI => {
                    let state = self.state.read().await;
                    state.ok_or_else(|| miette::miette!("No AQI reading available"))
                }
                _ => Err(miette::miette!("Not an AQI sensor")),
            },
            _ => Err(miette::miette!("Not an air quality sensor")),
        }
    }
}

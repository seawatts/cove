use serde::{Deserialize, Serialize};
use specta::Type;
use strum_macros::{Display, EnumString};

use crate::characteristics::Characteristic;

/// Represents a service type that an accessory can provide
#[derive(Debug, Clone, Serialize, Deserialize, Display, EnumString, PartialEq, Type)]
#[serde(rename_all = "snake_case")]
pub enum ServiceType {
    // Lighting
    Lightbulb,
    LightStrip,
    LightGroup,

    // Switches and Outlets
    Switch,
    Outlet,

    // Security & Safety
    MotionSensor,
    ContactSensor,
    SmokeSensor,
    CarbonMonoxideSensor,
    SecuritySystem,
    Lock,
    Camera,

    // Climate
    Thermostat,
    TemperatureSensor,
    HumiditySensor,
    AirQualitySensor,
    Fan,
    Heater,
    AirPurifier,
    AirConditioner,

    // Entertainment
    Television,
    Speaker,
    MediaPlayer,

    // Energy
    Battery,
    PowerMeter,

    // Window Coverings
    WindowCovering,
    Window,

    // Garage
    GarageDoorOpener,

    // Other
    Bridge,
    Unknown,
}

/// Represents a service that an accessory provides
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct Service {
    /// Unique identifier for the service
    pub id: String,

    /// The type of service
    pub type_: String,

    /// User-friendly name of the service
    pub name: String,

    /// The characteristics this service provides
    pub characteristics: Vec<Characteristic>,

    /// IDs of services that are linked to this one
    pub linked_services: Vec<String>,

    /// Whether this is a primary service
    pub primary: bool,

    /// Whether this service is currently hidden
    pub hidden: bool,
}

impl Service {
    /// Creates a new service with the given type
    pub fn new(id: String, type_: ServiceType, name: String) -> Self {
        Self {
            id,
            type_: type_.to_string(),
            name,
            characteristics: Vec::new(),
            linked_services: Vec::new(),
            primary: false,
            hidden: false,
        }
    }

    /// Adds a characteristic to this service
    pub fn add_characteristic(&mut self, characteristic: Characteristic) {
        self.characteristics.push(characteristic);
    }

    /// Links another service to this one
    pub fn link_service(&mut self, service_id: String) {
        if !self.linked_services.contains(&service_id) {
            self.linked_services.push(service_id);
        }
    }

    /// Gets a characteristic by its type
    pub fn get_characteristic(&self, characteristic_type: &str) -> Option<&Characteristic> {
        self.characteristics
            .iter()
            .find(|c| c.type_ == characteristic_type)
    }

    /// Gets a mutable reference to a characteristic by its type
    pub fn get_characteristic_mut(
        &mut self,
        characteristic_type: &str,
    ) -> Option<&mut Characteristic> {
        self.characteristics
            .iter_mut()
            .find(|c| c.type_ == characteristic_type)
    }

    /// Sets whether this is a primary service
    pub fn set_primary(&mut self, primary: bool) -> &mut Self {
        self.primary = primary;
        self
    }

    /// Sets whether this service is hidden
    pub fn set_hidden(&mut self, hidden: bool) -> &mut Self {
        self.hidden = hidden;
        self
    }
}

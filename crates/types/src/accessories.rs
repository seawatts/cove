use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::protocols::Protocol;
use crate::services::Service;

/// Represents a physical device that can provide one or more services
///
/// # Example
///
/// ```rust
/// use types::{
///     Accessory, Service, ServiceType, Characteristic, CharacteristicType,
///     Format, Permissions, Protocol, Unit,
/// };
/// use serde_json::json;
///
/// // Create a new Philips Hue light bulb accessory
/// let mut light = Accessory::new(
///     "hue_light_1".to_string(),
///     "Living Room Light".to_string(),
///     Protocol::Zigbee,
/// );
///
/// // Add manufacturer details
/// light.manufacturer = Some("Philips".to_string());
/// light.model = Some("Hue White and Color".to_string());
///
/// // Create a lightbulb service
/// let mut lightbulb_service = Service::new(
///     "main_light".to_string(),
///     ServiceType::Lightbulb,
///     "Main Light".to_string(),
/// );
///
/// // Add power characteristic
/// lightbulb_service.add_characteristic(
///     Characteristic::new(
///         "power".to_string(),
///         CharacteristicType::On,
///         Format::Bool,
///     )
///     .with_permissions(Permissions {
///         readable: true,
///         writable: true,
///         notify: true,
///     })
///     .with_value(json!(false))
/// );
///
/// // Add brightness characteristic
/// lightbulb_service.add_characteristic(
///     Characteristic::new(
///         "brightness".to_string(),
///         CharacteristicType::Brightness,
///         Format::Uint8,
///     )
///     .with_permissions(Permissions {
///         readable: true,
///         writable: true,
///         notify: true,
///     })
///     .with_unit(Unit::Percentage)
///     .with_value(json!(100))
///     .with_min_value(json!(0))
///     .with_max_value(json!(100))
///     .with_step_value(json!(1))
/// );
///
/// // Add color temperature characteristic
/// lightbulb_service.add_characteristic(
///     Characteristic::new(
///         "color_temp".to_string(),
///         CharacteristicType::ColorTemperature,
///         Format::Uint16,
///     )
///     .with_permissions(Permissions {
///         readable: true,
///         writable: true,
///         notify: true,
///     })
///     .with_value(json!(2700))
///     .with_min_value(json!(2700))
///     .with_max_value(json!(6500))
///     .with_step_value(json!(100))
/// );
///
/// // Add the service to the accessory
/// light.add_service(lightbulb_service);
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Accessory {
    /// Unique identifier for the accessory
    pub id: String,

    /// User-friendly name of the accessory
    pub name: String,

    /// Manufacturer of the accessory
    pub manufacturer: Option<String>,

    /// Model identifier of the accessory
    pub model: Option<String>,

    /// Firmware version of the accessory
    pub firmware_version: Option<String>,

    /// Hardware version of the accessory
    pub hardware_version: Option<String>,

    /// Serial number of the accessory
    pub serial_number: Option<String>,

    /// The services this accessory provides
    pub services: Vec<Service>,

    /// The protocol used to communicate with this accessory
    pub protocol: Protocol,

    /// When the accessory was first discovered/added
    pub created_at: DateTime<Utc>,

    /// When the accessory was last updated
    pub updated_at: DateTime<Utc>,

    /// When the accessory was last seen online
    pub last_seen: Option<DateTime<Utc>>,

    /// Location information for the accessory
    pub location: Location,
}

/// Represents the physical location of an accessory
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Location {
    /// The room where the accessory is located
    pub room: Option<String>,

    /// The floor where the accessory is located
    pub floor: Option<String>,

    /// The zone/area where the accessory is located
    pub zone: Option<String>,
}

impl Default for Location {
    fn default() -> Self {
        Self {
            room: None,
            floor: None,
            zone: None,
        }
    }
}

impl Accessory {
    /// Creates a new accessory with the given ID and name
    pub fn new(id: String, name: String, protocol: Protocol) -> Self {
        Self {
            id,
            name,
            manufacturer: None,
            model: None,
            firmware_version: None,
            hardware_version: None,
            serial_number: None,
            services: Vec::new(),
            protocol,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            last_seen: Some(Utc::now()),
            location: Location::default(),
        }
    }

    /// Adds a service to this accessory
    pub fn add_service(&mut self, service: Service) {
        self.services.push(service);
    }

    /// Updates the last seen timestamp
    pub fn update_last_seen(&mut self) {
        self.last_seen = Some(Utc::now());
        self.updated_at = Utc::now();
    }

    /// Gets a service by its type
    pub fn get_service(&self, service_type: &str) -> Option<&Service> {
        self.services.iter().find(|s| s.type_ == service_type)
    }

    /// Gets a mutable reference to a service by its type
    pub fn get_service_mut(&mut self, service_type: &str) -> Option<&mut Service> {
        self.services.iter_mut().find(|s| s.type_ == service_type)
    }
}

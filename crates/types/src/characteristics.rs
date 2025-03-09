use serde::{Deserialize, Serialize};
use serde_json::Value;
use specta::Type;
use strum_macros::{Display, EnumString};

/// Represents the format of a characteristic's value
#[derive(Debug, Clone, Serialize, Deserialize, Display, EnumString, PartialEq, Type)]
#[serde(rename_all = "snake_case")]
pub enum Format {
    Bool,
    Int,
    Float,
    String,
    Uint8,
    Uint16,
    Uint32,
    Uint64,
    Data,
    Tlv8,
}

/// Represents the unit of measurement for a characteristic
#[derive(Debug, Clone, Serialize, Deserialize, Display, EnumString, PartialEq, Type)]
#[serde(rename_all = "snake_case")]
pub enum Unit {
    // Temperature
    Celsius,
    Fahrenheit,

    // Percentage
    Percentage,

    // Light
    Lux,

    // Air Quality
    Ppm,  // Parts per million
    Mgm3, // Milligrams per cubic meter

    // Power/Energy
    Watts,
    KilowattHours,
    Volts,
    Amperes,

    // Pressure
    Hectopascals,

    // Time
    Seconds,

    // Angle
    Degrees,

    // Distance
    Meters,
}

/// Represents the permissions for a characteristic
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct Permissions {
    /// Whether the characteristic can be read
    pub readable: bool,

    /// Whether the characteristic can be written
    pub writable: bool,

    /// Whether the characteristic supports notifications
    pub notify: bool,
}

impl Default for Permissions {
    fn default() -> Self {
        Self {
            readable: true,
            writable: false,
            notify: false,
        }
    }
}

/// Represents a characteristic type
#[derive(Debug, Clone, Serialize, Deserialize, Display, EnumString, PartialEq, Type)]
#[serde(rename_all = "snake_case")]
pub enum CharacteristicType {
    // Power
    On,
    OutletInUse,

    // Lighting
    Brightness,
    Hue,
    Saturation,
    ColorTemperature,

    // Security & Safety
    MotionDetected,
    ContactSensorState,
    SmokeDetected,
    CarbonMonoxideDetected,
    SecuritySystemCurrentState,
    SecuritySystemTargetState,
    LockCurrentState,
    LockTargetState,

    // Climate
    CurrentTemperature,
    TargetTemperature,
    CurrentRelativeHumidity,
    TargetRelativeHumidity,
    CurrentHeatingCoolingState,
    TargetHeatingCoolingState,
    TemperatureDisplayUnits,
    CoolingThresholdTemperature,
    HeatingThresholdTemperature,

    // Air Quality
    AirQuality,
    CarbonDioxideLevel,
    CarbonDioxidePeakLevel,
    AirPurifierState,
    FilterLifeLevel,
    FilterChangeIndication,

    // Battery
    BatteryLevel,
    ChargingState,
    StatusLowBattery,

    // Window Coverings
    CurrentPosition,
    TargetPosition,
    PositionState,

    // Garage Door
    CurrentDoorState,
    TargetDoorState,
    ObstructionDetected,

    // Media
    Mute,
    Volume,
    PlaybackState,

    // Other
    Name,
    Manufacturer,
    Model,
    SerialNumber,
    FirmwareRevision,
    HardwareRevision,

    // Custom
    Custom(String),
}

/// Represents a characteristic of a service
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct Characteristic {
    /// Unique identifier for the characteristic
    pub id: String,

    /// The type of characteristic
    pub type_: String,

    /// The format of the characteristic's value
    pub format: Format,

    /// The unit of measurement (if applicable)
    pub unit: Option<Unit>,

    /// The permissions for this characteristic
    pub permissions: Permissions,

    /// The current value of the characteristic
    pub value: Option<Value>,

    /// The minimum allowed value (if applicable)
    pub min_value: Option<Value>,

    /// The maximum allowed value (if applicable)
    pub max_value: Option<Value>,

    /// The step size for value changes (if applicable)
    pub step_value: Option<Value>,

    /// Valid values for this characteristic (if applicable)
    pub valid_values: Option<Vec<Value>>,
}

impl Characteristic {
    /// Creates a new characteristic with the given type
    pub fn new(id: String, type_: CharacteristicType, format: Format) -> Self {
        Self {
            id,
            type_: type_.to_string(),
            format,
            unit: None,
            permissions: Permissions::default(),
            value: None,
            min_value: None,
            max_value: None,
            step_value: None,
            valid_values: None,
        }
    }

    /// Sets the unit for this characteristic
    pub fn with_unit(mut self, unit: Unit) -> Self {
        self.unit = Some(unit);
        self
    }

    /// Sets the permissions for this characteristic
    pub fn with_permissions(mut self, permissions: Permissions) -> Self {
        self.permissions = permissions;
        self
    }

    /// Sets the value for this characteristic
    pub fn with_value(mut self, value: Value) -> Self {
        self.value = Some(value);
        self
    }

    /// Sets the minimum value for this characteristic
    pub fn with_min_value(mut self, min_value: Value) -> Self {
        self.min_value = Some(min_value);
        self
    }

    /// Sets the maximum value for this characteristic
    pub fn with_max_value(mut self, max_value: Value) -> Self {
        self.max_value = Some(max_value);
        self
    }

    /// Sets the step value for this characteristic
    pub fn with_step_value(mut self, step_value: Value) -> Self {
        self.step_value = Some(step_value);
        self
    }

    /// Sets the valid values for this characteristic
    pub fn with_valid_values(mut self, valid_values: Vec<Value>) -> Self {
        self.valid_values = Some(valid_values);
        self
    }
}

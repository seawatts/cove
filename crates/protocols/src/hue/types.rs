use serde::{Deserialize, Serialize};

/// Represents the state of a Hue light
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HueLightState {
    /// Whether the light is on
    pub on: bool,

    /// Brightness level (0-254)
    pub bri: Option<u8>,

    /// Hue value (0-65535)
    pub hue: Option<u16>,

    /// Saturation value (0-254)
    pub sat: Option<u8>,

    /// Color temperature in mireds (153-500)
    pub ct: Option<u16>,

    /// Alert effect ("none", "select", "lselect")
    pub alert: Option<String>,

    /// Effect ("none", "colorloop")
    pub effect: Option<String>,

    /// Color mode ("hs", "ct", "xy")
    pub colormode: Option<String>,

    /// Whether the light can be reached by the bridge
    pub reachable: bool,
}

/// Represents a Hue light
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HueLight {
    /// The light's unique identifier
    pub id: String,

    /// The light's current state
    pub state: HueLightState,

    /// The light's name
    pub name: String,

    /// The light's model identifier
    pub model_id: String,

    /// The light's manufacturer name
    pub manufacturer_name: String,

    /// The light's product name
    pub product_name: String,

    /// The light's unique identifier
    pub unique_id: String,

    /// The light's software version
    pub software_version: String,

    /// The light's type
    #[serde(rename = "type")]
    pub type_: String,
}

/// Represents a response from the Hue bridge when creating a new user
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateUserResponse {
    pub success: Option<CreateUserSuccess>,
    pub error: Option<HueError>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateUserSuccess {
    pub username: String,
}

/// Represents an error from the Hue bridge
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HueError {
    /// The error type
    #[serde(rename = "type")]
    pub type_: u16,

    /// The error address
    pub address: String,

    /// The error description
    pub description: String,
}

use serde::{Deserialize, Serialize};

/// Configuration for the Hue protocol
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HueConfig {
    /// The IP address of the Hue bridge
    pub bridge_ip: String,

    /// The username (API key) for the Hue bridge
    pub username: Option<String>,

    /// The polling interval for state updates (in seconds)
    pub poll_interval: u64,

    /// Whether to automatically retry failed commands
    pub auto_retry: bool,

    /// Maximum number of retries for failed commands
    pub max_retries: u32,
}

impl Default for HueConfig {
    fn default() -> Self {
        Self {
            bridge_ip: String::new(),
            username: None,
            poll_interval: 1,
            auto_retry: true,
            max_retries: 3,
        }
    }
}

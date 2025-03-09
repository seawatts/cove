use serde::{Deserialize, Serialize};

/// Configuration for the Aqara protocol
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AqaraConfig {
    /// The cloud API key for authentication
    pub cloud_key: String,

    /// The device ID of the lock
    pub device_id: String,

    /// The polling interval for state updates (in seconds)
    pub poll_interval: u64,

    /// Whether to automatically retry failed commands
    pub auto_retry: bool,

    /// Maximum number of retries for failed commands
    pub max_retries: u32,

    /// The session token for the current session
    pub session_token: Option<String>,
}

impl Default for AqaraConfig {
    fn default() -> Self {
        Self {
            cloud_key: String::new(),
            device_id: String::new(),
            poll_interval: 5,
            auto_retry: true,
            max_retries: 3,
            session_token: None,
        }
    }
}

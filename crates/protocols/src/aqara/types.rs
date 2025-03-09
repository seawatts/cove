use serde::{Deserialize, Serialize};

/// Represents the state of an Aqara lock
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AqaraLockState {
    /// Whether the lock is locked
    pub locked: bool,

    /// The target state (0 = unlocked, 1 = locked)
    pub target_state: u8,

    /// Battery level (0-100)
    pub battery_level: u8,

    /// Whether the door is open
    pub door_state: bool,

    /// Whether child lock is enabled
    pub child_lock: bool,

    /// Whether auto-lock is enabled
    pub auto_lock: bool,
}

/// Represents an Aqara lock
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AqaraLock {
    /// The lock's unique identifier
    pub id: String,

    /// The lock's current state
    pub state: AqaraLockState,

    /// The lock's name
    pub name: String,

    /// The lock's model identifier
    pub model_id: String,

    /// The lock's firmware version
    pub firmware_version: String,

    /// The lock's unique identifier
    pub unique_id: String,
}

/// Represents a response from the Aqara cloud when creating a new session
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateSessionResponse {
    pub success: bool,
    pub session_token: Option<String>,
    pub error: Option<AqaraError>,
}

/// Represents an error from the Aqara cloud
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AqaraError {
    /// The error code
    pub code: u16,

    /// The error message
    pub message: String,
}

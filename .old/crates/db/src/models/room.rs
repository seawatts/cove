use serde::{Deserialize, Serialize};

use crate::model::Model;

/// Model for a room in the Cove home automation platform
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Room {
    /// Unique identifier for the room
    pub id: String,

    /// Name of the room (user-friendly)
    pub name: String,

    /// Optional longer description of the room
    pub description: Option<String>,

    /// Floor number (0 = ground floor, 1 = first floor, etc.)
    pub floor: Option<i32>,

    /// Whether this room is used for automations
    pub automations_enabled: bool,

    /// Optional parent room (for nested rooms like "Master Bathroom" in "Master Bedroom")
    pub parent_room_id: Option<String>,

    /// When the room was created
    pub created_at: chrono::DateTime<chrono::Utc>,

    /// When the room was last updated
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

impl Model for Room {
    fn table_name() -> &'static str {
        "rooms"
    }

    fn id(&self) -> String {
        self.id.clone()
    }

    fn set_id(&mut self, id: String) {
        self.id = id;
    }
}

impl Room {
    /// Create a new room with minimal information
    pub fn new(name: &str) -> Self {
        let now = chrono::Utc::now();
        Room {
            id: String::new(), // Will be set by Db::create
            name: name.to_string(),
            description: None,
            floor: None,
            automations_enabled: true,
            parent_room_id: None,
            created_at: now,
            updated_at: now,
        }
    }

    /// Set the description for this room
    pub fn with_description(mut self, description: &str) -> Self {
        self.description = Some(description.to_string());
        self
    }

    /// Set the floor for this room
    pub fn on_floor(mut self, floor: i32) -> Self {
        self.floor = Some(floor);
        self
    }

    /// Set the parent room for nested rooms
    pub fn in_room(mut self, parent_room_id: &str) -> Self {
        self.parent_room_id = Some(parent_room_id.to_string());
        self
    }

    /// Enable or disable automations for this room
    pub fn set_automations_enabled(&mut self, enabled: bool) {
        self.automations_enabled = enabled;
        self.updated_at = chrono::Utc::now();
    }
}

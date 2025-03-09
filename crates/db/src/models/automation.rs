use serde::{Deserialize, Serialize};

use crate::model::Model;

/// Types of triggers that can cause an automation to run
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AutomationTrigger {
    /// Trigger when a device's state changes
    DeviceState {
        device_id: String,
        property: String,
        condition: String, // e.g., "==", ">", "<", "contains"
        value: serde_json::Value,
    },

    /// Trigger at a specific time
    Schedule {
        cron: String, // Cron expression (e.g., "0 0 * * *" for daily at midnight)
        timezone: Option<String>,
    },

    /// Trigger when a user enters or leaves a location
    Location {
        user_id: String,
        location_type: String,   // e.g., "home", "away", "zone"
        zone_id: Option<String>, // Optional zone identifier
        event: String,           // e.g., "enter", "leave"
    },

    /// Trigger when the sun rises or sets
    Sun {
        event: String,       // e.g., "sunrise", "sunset"
        offset_minutes: i32, // Offset in minutes (negative for before, positive for after)
    },

    /// Trigger when a specific event occurs
    Event {
        event_type: String,
        event_data: Option<serde_json::Value>,
    },
}

/// Action that an automation can perform
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AutomationAction {
    /// Control a device
    DeviceControl {
        device_id: String,
        command: String,
        parameters: serde_json::Value,
    },

    /// Send a notification
    Notification {
        user_ids: Vec<String>, // Empty for all users
        title: String,
        message: String,
        priority: Option<String>, // e.g., "high", "normal", "low"
    },

    /// Run a scene
    Scene { scene_id: String },

    /// Delay execution for a period of time
    Delay { seconds: u64 },

    /// Make an HTTP request
    HttpRequest {
        url: String,
        method: String, // e.g., "GET", "POST"
        headers: Option<serde_json::Value>,
        body: Option<String>,
    },

    /// Run a script or command
    Script {
        script: String,
        arguments: Vec<String>,
    },
}

/// Model for an automation in the Cove home automation platform
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Automation {
    /// Unique identifier for the automation
    pub id: String,

    /// Name of the automation (user-friendly)
    pub name: String,

    /// Optional description of what the automation does
    pub description: Option<String>,

    /// Triggers that can cause this automation to run
    pub triggers: Vec<AutomationTrigger>,

    /// Conditions that must be true for the automation to execute
    pub conditions: Option<Vec<serde_json::Value>>,

    /// Actions to perform when the automation is triggered
    pub actions: Vec<AutomationAction>,

    /// Whether the automation is currently enabled
    pub enabled: bool,

    /// Whether the automation is running
    pub running: bool,

    /// When the automation was created
    pub created_at: chrono::DateTime<chrono::Utc>,

    /// When the automation was last updated
    pub updated_at: chrono::DateTime<chrono::Utc>,

    /// When the automation was last triggered
    pub last_triggered: Option<chrono::DateTime<chrono::Utc>>,
}

impl Model for Automation {
    fn table_name() -> &'static str {
        "automations"
    }

    fn id(&self) -> String {
        self.id.clone()
    }

    fn set_id(&mut self, id: String) {
        self.id = id;
    }
}

impl Automation {
    /// Create a new automation with minimal information
    pub fn new(name: &str) -> Self {
        let now = chrono::Utc::now();
        Automation {
            id: String::new(), // Will be set by Db::create
            name: name.to_string(),
            description: None,
            triggers: Vec::new(),
            conditions: None,
            actions: Vec::new(),
            enabled: true,
            running: false,
            created_at: now,
            updated_at: now,
            last_triggered: None,
        }
    }

    /// Add a trigger to this automation
    pub fn with_trigger(mut self, trigger: AutomationTrigger) -> Self {
        self.triggers.push(trigger);
        self
    }

    /// Add an action to this automation
    pub fn with_action(mut self, action: AutomationAction) -> Self {
        self.actions.push(action);
        self
    }

    /// Set the description for this automation
    pub fn with_description(mut self, description: &str) -> Self {
        self.description = Some(description.to_string());
        self
    }

    /// Enable or disable this automation
    pub fn set_enabled(&mut self, enabled: bool) {
        self.enabled = enabled;
        self.updated_at = chrono::Utc::now();
    }

    /// Mark the automation as triggered
    pub fn mark_triggered(&mut self) {
        self.last_triggered = Some(chrono::Utc::now());
        self.updated_at = chrono::Utc::now();
    }

    /// Set the running state of the automation
    pub fn set_running(&mut self, running: bool) {
        self.running = running;
        self.updated_at = chrono::Utc::now();
    }
}

use serde::{Deserialize, Serialize};

use crate::model::Model;

/// Log levels for the Cove platform
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum LogLevel {
    Error,
    Warning,
    Info,
    Debug,
    Trace,
}

/// Types of logs for the Cove platform
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum LogType {
    System,
    Device,
    Automation,
    User,
    Security,
    Api,
    Discovery,
}

/// Model for a log entry in the Cove home automation platform
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Log {
    /// Unique identifier for the log entry
    pub id: String,

    /// Log level
    pub level: LogLevel,

    /// Type of log
    pub log_type: LogType,

    /// Log message
    pub message: String,

    /// Source of the log (component name)
    pub source: String,

    /// Optional related entity ID (device_id, user_id, etc.)
    pub entity_id: Option<String>,

    /// Optional additional data as JSON
    pub data: Option<serde_json::Value>,

    /// When the log was created
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

impl Model for Log {
    fn table_name() -> &'static str {
        "logs"
    }

    fn id(&self) -> String {
        self.id.clone()
    }

    fn set_id(&mut self, id: String) {
        self.id = id;
    }
}

impl Log {
    /// Create a new log entry
    pub fn new(level: LogLevel, log_type: LogType, message: &str, source: &str) -> Self {
        Log {
            id: String::new(), // Will be set by Db::create
            level,
            log_type,
            message: message.to_string(),
            source: source.to_string(),
            entity_id: None,
            data: None,
            timestamp: chrono::Utc::now(),
        }
    }

    /// Set the entity ID for this log
    pub fn with_entity(mut self, entity_id: &str) -> Self {
        self.entity_id = Some(entity_id.to_string());
        self
    }

    /// Set additional data for this log
    pub fn with_data(mut self, data: serde_json::Value) -> Self {
        self.data = Some(data);
        self
    }

    /// Create a new error log
    pub fn error(log_type: LogType, message: &str, source: &str) -> Self {
        Self::new(LogLevel::Error, log_type, message, source)
    }

    /// Create a new warning log
    pub fn warning(log_type: LogType, message: &str, source: &str) -> Self {
        Self::new(LogLevel::Warning, log_type, message, source)
    }

    /// Create a new info log
    pub fn info(log_type: LogType, message: &str, source: &str) -> Self {
        Self::new(LogLevel::Info, log_type, message, source)
    }

    /// Create a new debug log
    pub fn debug(log_type: LogType, message: &str, source: &str) -> Self {
        Self::new(LogLevel::Debug, log_type, message, source)
    }
}

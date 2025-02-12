use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use tracing::Level;

use super::utils::ConfigFile;

#[derive(Debug, Serialize, Deserialize, Clone, JsonSchema)]
pub enum LogLevel {
    TRACE,
    DEBUG,
    INFO,
    WARN,
    ERROR,
}

impl From<LogLevel> for Level {
    fn from(level: LogLevel) -> Self {
        match level {
            LogLevel::TRACE => Level::TRACE,
            LogLevel::DEBUG => Level::DEBUG,
            LogLevel::INFO => Level::INFO,
            LogLevel::WARN => Level::WARN,
            LogLevel::ERROR => Level::ERROR,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, JsonSchema)]
pub struct Logging {
    pub level: Option<LogLevel>,
}

impl ConfigFile for Logging {}

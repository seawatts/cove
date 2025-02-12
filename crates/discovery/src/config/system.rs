use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

use super::utils::ConfigFile;

/// Main configuration structure for the Cove system
#[derive(Debug, Serialize, Deserialize, Clone, JsonSchema)]
pub struct System {
    pub name: String,
}

impl ConfigFile for System {}

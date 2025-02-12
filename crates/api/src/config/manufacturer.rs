use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

use super::utils::ConfigFile;

/// Manufacturer configuration structure
#[derive(Debug, Serialize, Deserialize, Clone, JsonSchema)]
pub struct Manufacturer {
    pub name: String,
    pub website: Option<String>,
    pub description: Option<String>,
}

impl ConfigFile for Manufacturer {}

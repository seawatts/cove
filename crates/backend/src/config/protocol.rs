use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use super::utils::ConfigFile;

#[derive(Debug, Serialize, Deserialize, Clone, JsonSchema)]
pub struct ProtocolConfig {
    pub enabled: bool,
    pub discovery_timeout: u64,
    pub discovery_interval: u64,
    pub discovery_retries: u32,
    pub discovery_retry_delay: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone, JsonSchema)]
pub struct Protocol {
    #[serde(flatten)]
    pub name: HashMap<String, ProtocolConfig>,
}

#[derive(Debug, Serialize, Deserialize, Clone, JsonSchema)]
pub struct Discovery {
    pub protocols: Option<Vec<Protocol>>,
}

impl ConfigFile for Discovery {}

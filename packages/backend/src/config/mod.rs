mod device;
pub mod error;
mod logging;
mod manufacturer;
mod protocol;
mod system;
mod utils;

pub use device::{Device, DeviceCapabilities, DeviceCommands};
pub use error::ConfigError;
pub use logging::{LogLevel, Logging};
pub use manufacturer::Manufacturer;
pub use protocol::{Discovery, Protocol, ProtocolConfig};
pub use system::System;
pub use utils::ConfigFile;

use miette::{Diagnostic, IntoDiagnostic, Report, Result};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::{
    path::{Path, PathBuf},
    sync::Arc,
};
use tokio::fs;
use tracing::{error, info};

#[derive(Debug, Serialize, Deserialize, Clone, JsonSchema)]
pub struct Config {
    pub system: System,
    pub logging: Logging,
    pub discovery: Discovery,
}

impl Config {
    /// Load configuration from a YAML file
    pub async fn from_file<P: AsRef<Path>>(path: P) -> Result<Self, ConfigError> {
        let path = path.as_ref().to_path_buf();
        let contents = tokio::fs::read_to_string(&path).await.map_err(|e| {
            let err = ConfigError::LoadFailed {
                path: path.clone(),
                source: Arc::new(e),
            };
            error!("{}", Report::new(err.clone()));
            err
        })?;

        let config = serde_yaml::from_str::<Config>(&contents).map_err(|e| {
            let span_start = e.location().map(|loc| loc.index()).unwrap_or(0);
            let span_end = e
                .location()
                .map(|loc| loc.index() + 1)
                .unwrap_or(contents.len());
            let err = ConfigError::InvalidFormat {
                path: path.clone(),
                details: e.to_string(),
                content: contents.clone(),
                span: (span_start..span_end).into(),
                schema_path: Path::new("./config/schemas").join("cove.schema.json"),
                schema_span: None,
            };

            error!("{:?}", Report::new(err.clone()));
            err
        })?;

        config.validate()?;

        info!("Configuration loaded successfully");
        Ok(config)
    }

    pub async fn generate_schema() -> miette::Result<()> {
        // Generate all schemas
        utils::generate_schema::<Config>("cove").await?;
        utils::generate_schema::<Manufacturer>("manufacturer").await?;
        utils::generate_schema::<Device>("device").await?;

        Ok(())
    }

    /// Validate the configuration
    fn validate(&self) -> Result<(), ConfigError> {
        Ok(())
    }
}

/// Represents all configurations loaded from disk
#[derive(Debug)]
pub struct LoadedConfigs {
    pub system: Config,
    pub manufacturers: Vec<(String, Manufacturer)>,
    pub devices: Vec<(String, String, Device)>, // (manufacturer, model, device)
}

impl LoadedConfigs {
    /// Load all configurations from disk
    pub async fn load_all() -> Result<Self, ConfigError> {
        // Load main system config
        let system = Config::from_file("./config/cove.yaml").await?;

        // Load manufacturer configs
        let mut manufacturers = Vec::new();
        let mut devices = Vec::new();

        // Read manufacturer directories
        let mut manufacturer_entries = Vec::new();
        let mut dir =
            fs::read_dir("./config/manufacturers")
                .await
                .map_err(|e| ConfigError::LoadFailed {
                    path: PathBuf::from("./config/manufacturers"),
                    source: Arc::new(e),
                })?;

        // Collect manufacturer entries first
        while let Ok(Some(entry)) = dir.next_entry().await {
            let ft = entry
                .file_type()
                .await
                .map_err(|e| ConfigError::LoadFailed {
                    path: entry.path(),
                    source: Arc::new(e),
                })?;

            if ft.is_dir() {
                manufacturer_entries.push(entry);
            }
        }

        // Process each manufacturer
        for manufacturer_entry in manufacturer_entries {
            let manufacturer_name = manufacturer_entry.file_name();
            let manufacturer_name = manufacturer_name.to_string_lossy();

            // Load manufacturer config
            let manufacturer_config_path = manufacturer_entry.path().join("manufacturer.yaml");
            if manufacturer_config_path.exists() {
                let manufacturer = Manufacturer::from_file(&manufacturer_config_path).await?;
                manufacturers.push((manufacturer_name.to_string(), manufacturer));

                // Load device configs for this manufacturer
                let mut device_dir =
                    fs::read_dir(manufacturer_entry.path()).await.map_err(|e| {
                        ConfigError::LoadFailed {
                            path: manufacturer_entry.path(),
                            source: Arc::new(e),
                        }
                    })?;

                while let Ok(Some(device_entry)) = device_dir.next_entry().await {
                    let ft =
                        device_entry
                            .file_type()
                            .await
                            .map_err(|e| ConfigError::LoadFailed {
                                path: device_entry.path(),
                                source: Arc::new(e),
                            })?;

                    if ft.is_dir() {
                        let device_name = device_entry.file_name();
                        let device_name = device_name.to_string_lossy();

                        let device_config_path = device_entry.path().join("device.yaml");
                        if device_config_path.exists() {
                            let device = Device::from_file(&device_config_path).await?;
                            devices.push((
                                manufacturer_name.to_string(),
                                device_name.to_string(),
                                device,
                            ));
                        }
                    }
                }
            }
        }

        Ok(LoadedConfigs {
            system,
            manufacturers,
            devices,
        })
    }

    /// Validate all loaded configurations
    pub async fn validate(&self) -> Result<(), ConfigError> {
        // Load schemas
        let cove_schema = utils::load_schema("cove").await?;
        let manufacturer_schema = utils::load_schema("manufacturer").await?;
        let device_schema = utils::load_schema("device").await?;

        // Validate system config
        let system_yaml =
            serde_yaml::to_string(&self.system).map_err(|e| ConfigError::InvalidFormat {
                path: PathBuf::from("./config/cove.yaml"),
                details: e.to_string(),
                content: String::new(),
                span: (0..1).into(),
                schema_path: Path::new("./config/schemas").join("cove.schema.json"),
                schema_span: None,
            })?;
        utils::validate_yaml(&cove_schema, &system_yaml, "system config")?;

        // Validate manufacturer configs
        for (name, manufacturer) in &self.manufacturers {
            let manufacturer_yaml =
                serde_yaml::to_string(manufacturer).map_err(|e| ConfigError::InvalidFormat {
                    path: PathBuf::from(format!(
                        "./config/manufacturers/{}/manufacturer.yaml",
                        name
                    )),
                    details: e.to_string(),
                    content: String::new(),
                    span: (0..1).into(),
                    schema_path: Path::new("./config/schemas").join("manufacturer.schema.json"),
                    schema_span: None,
                })?;
            utils::validate_yaml(
                &manufacturer_schema,
                &manufacturer_yaml,
                &format!("manufacturer {}", name),
            )?;
        }

        // Validate device configs
        for (manufacturer, model, device) in &self.devices {
            let device_yaml =
                serde_yaml::to_string(device).map_err(|e| ConfigError::InvalidFormat {
                    path: PathBuf::from(format!(
                        "./config/manufacturers/{}/{}/device.yaml",
                        manufacturer, model
                    )),
                    details: e.to_string(),
                    content: String::new(),
                    span: (0..1).into(),
                    schema_path: Path::new("./config/schemas").join("device.schema.json"),
                    schema_span: None,
                })?;
            utils::validate_yaml(
                &device_schema,
                &device_yaml,
                &format!("device {}/{}", manufacturer, model),
            )?;
        }

        // Additional cross-config validations
        self.validate_cross_references()?;

        Ok(())
    }

    /// Validate cross-references between configurations
    fn validate_cross_references(&self) -> Result<(), ConfigError> {
        // Create a set of valid manufacturer names
        let manufacturer_names: std::collections::HashSet<_> = self
            .manufacturers
            .iter()
            .map(|(name, _)| name.as_str())
            .collect();

        // Verify all devices reference valid manufacturers
        for (manufacturer, model, _) in &self.devices {
            if !manufacturer_names.contains(manufacturer.as_str()) {
                return Err(ConfigError::InvalidCrossReference {
                    details: format!(
                        "Device {}/{} references non-existent manufacturer {}",
                        manufacturer, model, manufacturer
                    ),
                    related: vec![],
                });
            }
        }
        Ok(())
    }
}

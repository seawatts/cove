use jsonschema;
use miette::Result;
use schemars::JsonSchema;
use serde::de::DeserializeOwned;
use serde_json::Value;
use std::{path::Path, sync::Arc};
use tokio::fs::File;

use crate::config::error::ConfigError;

/// Shared trait for configuration types
pub trait ConfigFile: DeserializeOwned + JsonSchema {
    /// Load configuration from a YAML file
    fn from_file<P: AsRef<Path>>(
        path: P,
    ) -> impl std::future::Future<Output = Result<Self, ConfigError>> + Send
    where
        Self: Sized,
    {
        let path_buf = path.as_ref().to_path_buf();
        async move {
            let contents = tokio::fs::read_to_string(&path_buf).await.map_err(|e| {
                ConfigError::LoadFailed {
                    path: path_buf.clone(),
                    source: Arc::new(e),
                }
            })?;

            serde_yaml::from_str(&contents).map_err(|e| {
                let span_start = e.location().map(|loc| loc.index()).unwrap_or(0);
                let span_end = e.location().map(|loc| loc.index() + 1).unwrap_or(1);
                let schema_name = std::any::type_name::<Self>()
                    .split("::")
                    .last()
                    .unwrap_or("unknown")
                    .to_lowercase();

                ConfigError::InvalidFormat {
                    path: path_buf,
                    details: e.to_string(),
                    content: contents,
                    span: (span_start..span_end).into(),
                    schema_path: Path::new("./config/schemas")
                        .join(format!("{}.schema.json", schema_name)),
                    schema_span: None,
                }
            })
        }
    }
}

/// Generate JSON schema for a type
pub async fn generate_schema<T: JsonSchema>(name: &str) -> Result<(), ConfigError> {
    let schema = schemars::schema_for!(T);
    let schema_str =
        serde_json::to_string_pretty(&schema).map_err(|e| ConfigError::InvalidFormat {
            path: Path::new("./config/schemas").join(format!("{}.schema.json", name)),
            details: e.to_string(),
            content: "".to_string(),
            span: (0..1).into(),
            schema_path: Path::new("./config/schemas").join(format!("{}.schema.json", name)),
            schema_span: None,
        })?;
    let schema_path = Path::new("./config/schemas").join(format!("{}.schema.json", name));
    let mut file = File::create(&schema_path)
        .await
        .map_err(|e| ConfigError::LoadFailed {
            path: schema_path.clone(),
            source: Arc::new(e),
        })?;
    tokio::io::AsyncWriteExt::write_all(&mut file, schema_str.as_bytes())
        .await
        .map_err(|e| ConfigError::LoadFailed {
            path: schema_path,
            source: Arc::new(e),
        })?;
    Ok(())
}

/// Load a JSON Schema from disk
pub async fn load_schema(name: &str) -> Result<schemars::schema::RootSchema, ConfigError> {
    let schema_path = Path::new("./config/schemas").join(format!("{}.schema.json", name));
    let schema_str =
        tokio::fs::read_to_string(&schema_path)
            .await
            .map_err(|e| ConfigError::LoadFailed {
                path: schema_path.clone(),
                source: Arc::new(e),
            })?;

    serde_json::from_str(&schema_str).map_err(|e| ConfigError::SchemaCompile {
        details: e.to_string(),
        schema_path: schema_path,
        schema: schema_str,
    })
}

/// Validate YAML content against a JSON Schema
pub fn validate_yaml(
    schema: &schemars::schema::RootSchema,
    yaml_str: &str,
    context: &str,
) -> Result<(), ConfigError> {
    let yaml_value: Value =
        serde_yaml::from_str(yaml_str).map_err(|e| ConfigError::InvalidFormat {
            path: Path::new("./config/schemas").join(format!("{}.schema.json", context)),
            details: e.to_string(),
            content: yaml_str.to_string(),
            span: (0..1).into(),
            schema_path: Path::new("./config/schemas").join(format!("{}.schema.json", context)),
            schema_span: None,
        })?;

    let schema_value = serde_json::to_value(schema).map_err(|e| ConfigError::SchemaCompile {
        details: e.to_string(),
        schema_path: Path::new("./config/schemas").join(format!("{}.schema.json", context)),
        schema: yaml_str.to_string(),
    })?;

    let compiled = jsonschema::is_valid(&schema_value, &yaml_value);

    if !compiled {
        return Err(ConfigError::SchemaValidation {
            details: "Schema validation failed".to_string(),
            content: yaml_str.to_string(),
            path: None,
            schema_path: Path::new("./config/schemas").join(format!(
                "{}.schema.json",
                context.split_whitespace().next().unwrap_or("unknown")
            )),
            schema_span: Some((0..1).into()),
        });
    }
    Ok(())
}

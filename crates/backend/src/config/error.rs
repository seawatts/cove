use std::io;
use std::path::PathBuf;
use std::sync::Arc;

use miette::{Diagnostic, SourceSpan};
use thiserror::Error;
use tracing::error;

use crate::error::Error;

#[derive(Error, Diagnostic, Debug, Clone)]
#[error("Failed to load config file: {path}")]
pub enum ConfigError {
    #[error("Failed to load config file: {path}")]
    #[diagnostic(
        code(cove::config::load_failed),
        help("Check if the file exists and has correct permissions")
    )]
    LoadFailed {
        path: PathBuf,
        #[source]
        source: Arc<io::Error>,
    },

    #[error("Invalid config format in {path}: {details}")]
    #[diagnostic(
        code(cove::config::invalid_format),
        help("Check the YAML syntax and ensure values match the schema at {}", .schema_path.display())
    )]
    InvalidFormat {
        path: PathBuf,
        details: String,
        #[source_code]
        content: String,
        #[label("Error occurred here")]
        span: SourceSpan,
        schema_path: PathBuf,
        #[label("Relevant schema definition")]
        schema_span: Option<SourceSpan>,
    },

    #[error("Missing required config file: {path}")]
    #[diagnostic(
        code(cove::config::missing),
        help("Create the required configuration file")
    )]
    MissingConfig { path: PathBuf },

    #[error("Schema validation error in {}", .path.as_ref().map(|p| p.display().to_string()).unwrap_or_else(|| "config".to_string()))]
    #[diagnostic(
        code(cove::config::schema::validation),
        help("Update the configuration to match the schema at {}", .schema_path.display())
    )]
    SchemaValidation {
        details: String,
        #[source_code]
        content: String,
        path: Option<PathBuf>,
        schema_path: PathBuf,
        #[label("Relevant schema definition")]
        schema_span: Option<SourceSpan>,
    },

    #[error("Failed to compile schema at {}: {details}", .schema_path.display())]
    #[diagnostic(
        code(cove::config::schema::compile),
        help("Check if the schema is valid JSON Schema")
    )]
    SchemaCompile {
        details: String,
        schema_path: PathBuf,
        #[source_code]
        schema: String,
    },

    #[error("Invalid cross-reference: {details}")]
    #[diagnostic(
        code(cove::config::cross_ref),
        help("Ensure all referenced entities exist")
    )]
    InvalidCrossReference {
        details: String,
        #[related]
        related: Vec<Error>,
    },

    #[error("Duplicate configuration: {details}")]
    #[diagnostic(
        code(cove::config::duplicate),
        help("Remove or rename duplicate configurations")
    )]
    DuplicateConfig {
        details: String,
        paths: Vec<PathBuf>,
    },

    #[error("Invalid directory structure: {details}")]
    #[diagnostic(
        code(cove::config::structure),
        help("Follow the required directory structure")
    )]
    InvalidStructure { details: String, path: PathBuf },
}

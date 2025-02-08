pub mod error;
pub mod logging;

use miette::{Diagnostic, Report, Result};
use thiserror::Error;
use tracing::{error, info, warn};

use miette::SourceSpan;
use std::io;
use std::path::PathBuf;

#[derive(Error, Debug, Diagnostic)]
#[error("Failed to load config file: {path}")]
#[diagnostic(
    code(cove::config::load_failed),
    help("Check if the file exists and has the correct permissions")
)]
pub enum ConfigError {
    // This variant indicates that an I/O error was the underlying cause.
    LoadFailed {
        path: PathBuf,
        #[source] // This makes the I/O error part of the error chain.
        source: io::Error,
        // Suppose you have some extra context you want to show (for example, a schema validation error)
        #[related] // This will be shown in the “Related Errors” section.
        validation: Option<ValidationError>,
    },
}

#[derive(Error, Debug, Diagnostic)]
#[error("Schema validation failed: {reason}")]
#[diagnostic(
    code(cove::config::invalid_format),
    help("Check the configuration syntax")
)]
pub struct ValidationError {
    reason: String,
    #[label("This part seems problematic")]
    span: SourceSpan,
}

#[derive(Error, Diagnostic, Debug, Clone)]
pub enum MyError {
    #[error("my error")]
    #[diagnostic(code(my_error::failed), help("try again"))]
    Failed {
        prop: String,
        #[source_code]
        schema: String,
        #[label("this bit here")]
        span: miette::SourceSpan,
    },
}

fn bar() -> Result<(), MyError> {
    Err(MyError::Failed {
        prop: "test".to_string(),
        schema: "test".to_string(),
        span: (0, 4).into(),
    })
}

fn foo() -> Result<(), MyError> {
    match bar() {
        Ok(_) => Ok(()),
        Err(e) => {
            error!("{:?}", Report::new(e.clone()));
            Err(e)
        }
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    // Setup tracing and miette
    logging::setup_tracing()?;
    logging::setup_miette()?;

    let simulated_io_err = io::Error::new(io::ErrorKind::NotFound, "config file not found");
    let simulated_validation_err = ValidationError {
        reason: "Unexpected token".into(),
        span: (10, 5).into(),
    };

    let err = ConfigError::LoadFailed {
        path: PathBuf::from("config.yaml"),
        source: simulated_io_err,
        validation: Some(simulated_validation_err),
    };

    // Wrapping the error with Report::new produces miette's rich formatting,
    // including the full cause chain and any related errors.
    eprintln!("{:?}", Report::new(err));

    // Generate schemas
    match foo() {
        Ok(_) => info!("✅ Schema generation completed"),
        Err(e) => {
            warn!(error = ?e, "Schema generation failed but continuing");
        }
    }

    Ok(())
}

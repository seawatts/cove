use thiserror::Error;

/// Database error types
#[derive(Error, Debug)]
pub enum DbError {
    #[error("SQLite error: {0}")]
    Sqlite(#[from] rusqlite::Error),

    #[error("Connection not initialized")]
    ConnectionNotInitialized,

    #[error("Field not found: {0}")]
    FieldNotFound(String),

    #[error("Invalid schema definition")]
    InvalidSchema,

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
}

/// Result type for database operations
pub type DbResult<T> = std::result::Result<T, DbError>;

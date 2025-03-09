use thiserror::Error;

/// Timeseries database error types
#[derive(Error, Debug)]
pub enum TsError {
    #[error("QuestDB client error: {0}")]
    QuestDbClient(#[from] questdb::Error),

    #[error("Connection not initialized")]
    ConnectionNotInitialized,

    #[error("Field not found: {0}")]
    FieldNotFound(String),

    #[error("Invalid schema definition")]
    InvalidSchema,

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("Invalid time range")]
    InvalidTimeRange,

    #[error("Connection failed: {0}")]
    ConnectionFailed(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Query error: {0}")]
    Query(String),

    #[error("Invalid data type: {0}")]
    InvalidDataType(String),
}

/// Result type for timeseries database operations
pub type TsResult<T> = std::result::Result<T, TsError>;

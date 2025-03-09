use rusqlite::Connection;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use crate::error::{DbError, DbResult};

/// Global database path
static DB_PATH: OnceLock<PathBuf> = OnceLock::new();

/// Initialize the database connection
pub fn initialize_db<P: AsRef<Path>>(path: P) -> DbResult<()> {
    // Test that we can open the database
    let _test_conn = Connection::open(&path)?;

    // Store the path for future connections
    DB_PATH.get_or_init(|| path.as_ref().to_path_buf());

    Ok(())
}

/// Get a new database connection
pub fn get_conn() -> DbResult<Connection> {
    match DB_PATH.get() {
        Some(path) => Ok(Connection::open(path)?),
        None => Err(DbError::ConnectionNotInitialized),
    }
}

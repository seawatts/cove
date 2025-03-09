/// SQLite database library for Cove
///
/// A lightweight, type-safe SQLite wrapper with a Drizzle-like API.
mod connection;
mod error;
mod model;
pub mod models;
mod query;
mod schema;

use async_trait::async_trait;
use miette::Result;
use std::path::{Path, PathBuf};
use tracing::info;
use types::system_service::{Service, ServiceHandle};

// Re-export public items
pub use connection::{get_conn, initialize_db};
pub use error::{DbError, DbResult};
pub use model::{Db, Model};
pub use models::*;
pub use query::{Delete, Insert, Select, Update};
pub use schema::{column, create_json_table, Column, ColumnExt, ColumnType, Table};

/// Initialize a fresh database with all required tables
fn initialize_database<P: AsRef<Path>>(path: P) -> DbResult<()> {
    // First initialize the database connection
    initialize_db(path)?;

    // Create all required tables
    create_json_table("devices")?;
    create_json_table("rooms")?;
    create_json_table("automations")?;
    create_json_table("users")?;
    create_json_table("logs")?;

    // Add any other initialization steps here

    Ok(())
}

/// Database service for the Cove system
pub struct DbService {
    db_path: PathBuf,
    handle: ServiceHandle,
}

impl DbService {
    /// Create a new database service
    pub fn new(db_path: impl AsRef<Path>) -> Self {
        Self {
            db_path: db_path.as_ref().to_path_buf(),
            handle: ServiceHandle::new(),
        }
    }
}

#[async_trait]
impl Service for DbService {
    async fn init(&self) -> Result<()> {
        info!("Initializing database service");
        Ok(())
    }

    async fn run(&self) -> Result<()> {
        info!("Starting database service");

        // Ensure the directory exists
        if let Some(parent) = self.db_path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| miette::miette!("Failed to create database directory: {}", e))?;
        }

        // Initialize the database
        initialize_database(&self.db_path)
            .map_err(|e| miette::miette!("Failed to initialize database: {}", e))?;

        info!("Database initialized at {}", self.db_path.display());

        Ok(())
    }

    fn handle(&self) -> Option<&ServiceHandle> {
        Some(&self.handle)
    }
}

impl Clone for DbService {
    fn clone(&self) -> Self {
        Self {
            db_path: self.db_path.clone(),
            handle: self.handle.clone(),
        }
    }
}

/// Example usage
#[cfg(test)]
mod tests {
    use super::*;
    use serde::{Deserialize, Serialize};

    #[derive(Debug, Serialize, Deserialize)]
    struct Device {
        id: String,
        name: String,
        device_type: String,
        room: Option<String>,
    }

    impl Model for Device {
        fn table_name() -> &'static str {
            "devices"
        }

        fn id(&self) -> String {
            self.id.clone()
        }

        fn set_id(&mut self, id: String) {
            self.id = id;
        }
    }

    #[test]
    fn test_crud_operations() {
        // Initialize in-memory database
        initialize_db(":memory:").unwrap();

        // Create the devices table
        create_json_table("devices").unwrap();

        // Create a device
        let device = Device {
            id: String::new(), // Will be set by Db::create
            name: "Living Room Light".to_string(),
            device_type: "light".to_string(),
            room: Some("Living Room".to_string()),
        };

        let created = Db::create(device).unwrap();

        // Find the device
        let found = Db::find::<Device>(&created.id).unwrap().unwrap();
        assert_eq!(found.name, "Living Room Light");

        // Update the device
        let mut updated = found;
        updated.name = "Kitchen Light".to_string();
        updated.room = Some("Kitchen".to_string());

        let updated = Db::update(updated).unwrap();
        assert_eq!(updated.name, "Kitchen Light");

        // Delete the device
        let deleted = Db::delete::<Device>(&updated.id).unwrap();
        assert_eq!(deleted, 1);

        // Should not find the device anymore
        let not_found = Db::find::<Device>(&updated.id).unwrap();
        assert!(not_found.is_none());
    }
}

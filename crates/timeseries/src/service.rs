use async_trait::async_trait;
use miette::Result;
use std::net::IpAddr;
use tracing::info;
use types::system_service::{Service, ServiceHandle};

use crate::connection::initialize_client;
use crate::db::QuestDb;
use crate::model::TimeSeriesModel;
use crate::models::{DeviceStateReading, LogReading, SensorReading};
use crate::EventReading;

/// TimeseriesDB service for the Cove system
pub struct TimeseriesDbService {
    host: Option<IpAddr>,
    ilp_port: Option<u16>,
    http_port: Option<u16>,
    handle: ServiceHandle,
}

impl TimeseriesDbService {
    /// Create a new timeseries database service with default connection settings
    pub fn new() -> Self {
        Self {
            host: None,
            ilp_port: None,
            http_port: None,
            handle: ServiceHandle::new(),
        }
    }

    /// Set the host for QuestDB
    pub fn with_host(mut self, host: IpAddr) -> Self {
        self.host = Some(host);
        self
    }

    /// Set the InfluxDB line protocol port
    pub fn with_ilp_port(mut self, port: u16) -> Self {
        self.ilp_port = Some(port);
        self
    }

    /// Set the HTTP API port
    pub fn with_http_port(mut self, port: u16) -> Self {
        self.http_port = Some(port);
        self
    }

    /// Get a QuestDB client
    pub fn db_client(&self) -> QuestDb {
        QuestDb::new()
    }
}

#[async_trait]
impl Service for TimeseriesDbService {
    async fn init(&self) -> Result<()> {
        info!("Initializing timeseries database service");

        // Initialize the QuestDB client
        initialize_client(self.host, self.ilp_port, self.http_port)
            .await
            .map_err(|e| miette::miette!("Failed to initialize QuestDB client: {}", e))?;

        Ok(())
    }

    async fn run(&self) -> Result<()> {
        info!("Starting timeseries database service");

        // Get the database client
        let db = self.db_client();

        // Create the sensor_readings table using the schema defined in the model
        db.create_table(
            SensorReading::table_name(),
            &SensorReading::schema().as_slice(),
            SensorReading::timestamp_field(),
        )
        .await
        .map_err(|e| miette::miette!("Failed to create sensor_readings table: {}", e))?;

        // Create the device_states table using the schema defined in the model
        db.create_table(
            DeviceStateReading::table_name(),
            &DeviceStateReading::schema().as_slice(),
            DeviceStateReading::timestamp_field(),
        )
        .await
        .map_err(|e| miette::miette!("Failed to create device_states table: {}", e))?;

        // Create the logs table using the schema defined in the model
        db.create_table(
            LogReading::table_name(),
            &LogReading::schema().as_slice(),
            LogReading::timestamp_field(),
        )
        .await
        .map_err(|e| miette::miette!("Failed to create logs table: {}", e))?;

        // Create the events table using the schema defined in the model
        db.create_table(
            EventReading::table_name(),
            &EventReading::schema().as_slice(),
            EventReading::timestamp_field(),
        )
        .await
        .map_err(|e| miette::miette!("Failed to create events table: {}", e))?;

        info!("Timeseries database service initialized");

        Ok(())
    }

    fn handle(&self) -> Option<&ServiceHandle> {
        Some(&self.handle)
    }
}

impl Clone for TimeseriesDbService {
    fn clone(&self) -> Self {
        Self {
            host: self.host,
            ilp_port: self.ilp_port,
            http_port: self.http_port,
            handle: self.handle.clone(),
        }
    }
}

/// Default implementation for ease of use
impl Default for TimeseriesDbService {
    fn default() -> Self {
        Self::new()
    }
}

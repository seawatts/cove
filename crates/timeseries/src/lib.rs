/// Timeseries database library for Cove
///
/// A high-performance time series database client for IoT data using QuestDB.
/// Provides optimized data ingestion and querying via the official QuestDB client.
mod connection;
mod db;
mod error;
mod model;
pub mod models;
mod service;
mod types;

use chrono::{DateTime, Utc};
use questdb::ingress::Buffer;
use questdb::ingress::Sender;
use questdb::ingress::TimestampNanos;

// Re-export public items
pub use connection::{create_sender, initialize_client};
pub use db::QuestDb;
pub use error::{TsError, TsResult};
pub use model::{Order, TimeSeriesDb, TimeSeriesModel, TimeSeriesQuery};
pub use models::*;
pub use service::TimeseriesDbService;

/// Alias to TimeSeriesDb for common operations
pub struct Ts;

impl Ts {
    /// Create a new timeseries record
    pub async fn create<T: TimeSeriesModel + Send + Sync + 'static>(model: T) -> TsResult<()> {
        let db = QuestDb::new();
        db.create(model).await
    }

    /// Query timeseries data
    pub async fn query<T: TimeSeriesModel + Send + Sync + 'static>(
        query: TimeSeriesQuery<T>,
    ) -> TsResult<Vec<T>> {
        let db = QuestDb::new();
        db.query(query).await
    }

    /// Get the latest record
    pub async fn latest<T: TimeSeriesModel + Send + Sync + 'static>() -> TsResult<Option<T>> {
        let db = QuestDb::new();
        db.latest().await
    }

    /// Delete records in a time range
    pub async fn delete_range<T: TimeSeriesModel + Send + Sync + 'static>(
        start: DateTime<Utc>,
        end: DateTime<Utc>,
    ) -> TsResult<usize> {
        // Create a QuestDb instance to access the database
        let db = QuestDb::new();

        // We need to call delete_range with the right TimeSeriesDb<T> implementation
        // so we add an explicit type hint
        let db_for_type: &dyn TimeSeriesDb<T> = &db;
        db_for_type.delete_range(start, end).await
    }

    /// Create a query builder
    pub fn builder<T: TimeSeriesModel>() -> TimeSeriesQuery<T> {
        TimeSeriesQuery::new()
    }

    /// Execute a raw SQL query
    pub async fn execute_sql(
        sql: &str,
    ) -> TsResult<Vec<std::collections::HashMap<String, serde_json::Value>>> {
        let db = QuestDb::new();
        db.execute_sql(sql).await
    }

    /// Get a buffer for manual data entry
    pub fn get_buffer() -> TsResult<Buffer> {
        QuestDb::get_buffer()
    }

    /// Get a sender for manual data entry
    pub fn get_sender() -> TsResult<Sender> {
        QuestDb::get_sender()
    }
}

/// Example usage
#[cfg(test)]
mod tests {
    use std::time::Duration;

    use super::*;
    use chrono::Utc;

    // Example test showcasing how to use the timeseries database
    #[tokio::test]
    async fn test_sensor_readings() {
        // This is just an example and won't actually run unless QuestDB is configured

        // Initialize the QuestDB client (normally done by the service)
        initialize_client(None, None, None).await.unwrap();

        // Create a QuestDB client
        let db = QuestDb::new();

        // Create the sensor_readings table
        db.create_table(
            SensorReading::table_name(),
            &SensorReading::schema(),
            SensorReading::timestamp_field(),
        )
        .await
        .unwrap();

        // Create a sensor reading
        let reading = SensorReading {
            ts: Utc::now(),
            device_id: "device_123".to_string(),
            sensor_id: "temperature".to_string(),
            value: 22.5,
            unit: Some("celsius".to_string()),
            room: Some("living_room".to_string()),
        };

        // Insert the reading
        Ts::create(reading).await.unwrap();

        // Query with time range and downsampling
        let one_hour_ago = Utc::now() - Duration::from_secs(3600);
        let results = Ts::query(
            Ts::builder::<SensorReading>()
                .start(one_hour_ago)
                .end(Utc::now())
                .sample_by(Duration::from_secs(60)) // 1 minute intervals
                .filter("room = 'living_room'".to_string())
                .limit(100),
        )
        .await
        .unwrap();

        println!("Found {} readings", results.len());

        // Get latest reading
        if let Some(latest) = Ts::latest::<SensorReading>().await.unwrap() {
            println!(
                "Latest reading: {} {}",
                latest.value,
                latest.unit.unwrap_or_default()
            );
        }

        // Raw SQL query
        let results = Ts::execute_sql(
            "SELECT * FROM sensor_readings WHERE device_id = 'device_123' LIMIT 10",
        )
        .await
        .unwrap();

        println!("SQL query found {} results", results.len());

        // Using a buffer directly for bulk inserts
        let mut buffer = Ts::get_buffer().unwrap();
        buffer
            .table(SensorReading::table_name())
            .unwrap()
            .symbol("device_id", "device_456")
            .unwrap()
            .symbol("sensor", "humidity")
            .unwrap()
            .column_f64("value", 45.2)
            .unwrap()
            .symbol("unit", "percent")
            .unwrap()
            .symbol("room", "bedroom")
            .unwrap();

        // Convert chrono DateTime to TimestampNanos
        let ts_nanos = TimestampNanos::from_datetime(Utc::now()).unwrap();
        buffer.at(ts_nanos).unwrap();

        // Create a new sender and flush the buffer
        let mut sender = QuestDb::get_sender().unwrap();
        // Uncomment to actually send data
        // sender.flush(&mut buffer).unwrap();
    }
}

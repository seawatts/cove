use crate::types::ColumnType;
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use questdb::ingress::{Buffer, Sender};
use std::collections::HashMap;

use crate::connection::create_sender;
use crate::model::{Order, TimeSeriesDb, TimeSeriesModel, TimeSeriesQuery};
use miette::Result;

/// QuestDB client for time series operations
#[derive(Debug)]
pub struct QuestDb;

impl QuestDb {
    /// Create a new QuestDB client instance
    pub fn new() -> Self {
        Self {}
    }

    /// Execute a SQL query directly
    pub async fn execute_sql(&self, sql: &str) -> Result<Vec<HashMap<String, serde_json::Value>>> {
        // We would need to implement HTTP requests to QuestDB's REST API
        // For example, using reqwest or ureq to make a POST request to:
        // http://localhost:9000/exec?query=SELECT+*+FROM+mytable

        // This would require adding more dependencies to implement properly
        tracing::warn!("QuestDB HTTP API not fully implemented. SQL: {}", sql);
        Ok(Vec::new()) // Return empty results for now
    }

    /// Get a buffer for data ingestion
    pub fn get_buffer() -> Result<Buffer> {
        // Create a new buffer directly - this follows the documentation example
        // Buffer is designed to be reused between operations
        Ok(Buffer::new())
    }

    /// Get a sender for data ingestion
    pub fn get_sender() -> Result<Sender> {
        // Create a new sender instance using the connection string
        // This follows the latest QuestDB pattern
        create_sender()
    }

    /// Create a table with the given schema
    pub async fn create_table(
        &self,
        table_name: &str,
        schema: &[(&str, ColumnType)],
        timestamp_column: &str,
    ) -> Result<()> {
        // Build CREATE TABLE SQL
        let sql = self.build_create_table_sql(table_name, schema, timestamp_column);

        // QuestDB auto-creates tables as needed, so we don't have to explicitly create them
        // We'll just log that we attempted to create it
        tracing::info!(
            "QuestDB tables are auto-created on write. SQL would be: {}",
            sql
        );

        Ok(())
    }

    fn build_create_table_sql(
        &self,
        table_name: &str,
        schema: &[(&str, ColumnType)],
        timestamp_column: &str,
    ) -> String {
        // Build the CREATE TABLE statement
        let mut sql = format!("CREATE TABLE IF NOT EXISTS {} (", table_name);

        for (i, (column, column_type)) in schema.iter().enumerate() {
            if i > 0 {
                sql.push_str(", ");
            }

            // Map Rust types to QuestDB column types
            let type_str = match column_type {
                ColumnType::Bool => "BOOLEAN",
                ColumnType::Long => "LONG",
                ColumnType::Int => "INT",
                ColumnType::Short => "SHORT",
                ColumnType::Byte => "BYTE",
                ColumnType::Float => "FLOAT",
                ColumnType::Double => "DOUBLE",
                ColumnType::String => "STRING",
                ColumnType::Symbol => "SYMBOL",
                ColumnType::Timestamp => "TIMESTAMP",
            };

            sql.push_str(&format!("{} {}", column, type_str));
        }

        // Add timestamp column designation
        sql.push_str(&format!(") TIMESTAMP({})", timestamp_column));

        sql
    }
}

#[async_trait]
impl<T: TimeSeriesModel + Send + Sync + 'static> TimeSeriesDb<T> for QuestDb {
    async fn create(&self, model: T) -> Result<()> {
        // Create a new mutable sender instance
        let mut sender = create_sender()?;
        // Create a new buffer to add our model
        let mut buffer = Buffer::new();

        // Add the model to the buffer, relying on the model's implementation to fill in fields
        model.add_to_buffer(&mut buffer)?;

        // Now we have a mutable sender and can call flush with a mutable buffer
        // This follows the pattern from the QuestDB documentation
        sender.flush(&mut buffer);

        Ok(())
    }

    async fn query(&self, query: TimeSeriesQuery<T>) -> Result<Vec<T>> {
        let sql = query.build_sql();
        let results = self.execute_sql(&sql).await?;

        // Convert the results to the model type
        let models = results
            .into_iter()
            .map(|row| T::from_row(row))
            .collect::<Result<Vec<_>, _>>()?;

        Ok(models)
    }

    async fn latest(&self) -> Result<Option<T>> {
        let query = TimeSeriesQuery::<T>::new().order(Order::Desc).limit(1);

        let results = self.query(query).await?;
        Ok(results.into_iter().next())
    }

    async fn delete_range(&self, start: DateTime<Utc>, end: DateTime<Utc>) -> Result<usize> {
        // For now, just warn and return 0
        // In a real implementation, we'd need to send a DELETE SQL query via HTTP
        tracing::warn!(
            "Delete range not implemented for table {}: QuestDB HTTP API support would be needed",
            T::table_name()
        );
        Ok(0)
    }
}

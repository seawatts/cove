use async_trait::async_trait;
use chrono::{DateTime, Utc};
use questdb::ingress::Buffer;
use serde::{de::DeserializeOwned, Serialize};
use std::collections::HashMap;
use std::time::Duration;

use crate::types::ColumnType;
use miette::Result;

/// Base trait for time series models
pub trait TimeSeriesModel: Send + Sync {
    /// Get the name of the table
    fn table_name() -> &'static str;

    /// Get the timestamp field name
    fn timestamp_field() -> &'static str {
        "ts"
    }

    /// Get the designated timestamp for this record
    fn timestamp(&self) -> DateTime<Utc>;

    /// Add this model to a QuestDB buffer
    fn add_to_buffer(&self, buffer: &mut Buffer) -> Result<()>;

    /// Create a model from a row of data
    fn from_row(row: HashMap<String, serde_json::Value>) -> Result<Self>
    where
        Self: Sized;

    /// Get the schema for this model
    fn schema() -> Vec<(&'static str, ColumnType)>;
}

/// Trait for models that can be written using SQL
pub trait SqlTimeSeriesModel: TimeSeriesModel + Serialize + DeserializeOwned {
    /// Get the SQL schema for creating this table
    fn create_table_sql() -> String;

    /// Get the SQL for inserting data
    fn insert_sql() -> String;
}

/// Trait for models that can be written using the InfluxDB line protocol
pub trait LineProtocolModel: TimeSeriesModel {
    /// Get the measurement name for InfluxDB line protocol
    fn measurement() -> &'static str {
        Self::table_name()
    }

    /// Convert to InfluxDB line protocol format
    fn to_line_protocol(&self) -> String;

    /// Get the tags for this record
    fn tags(&self) -> Vec<(&str, String)>;

    /// Get the fields for this record
    fn fields(&self) -> Vec<(&str, String)>;
}

/// A query builder for retrieving time series data
#[derive(Debug, Clone)]
pub struct TimeSeriesQuery<T: TimeSeriesModel> {
    /// The table/measurement name
    table: &'static str,
    /// Start time for the query
    start_time: Option<DateTime<Utc>>,
    /// End time for the query
    end_time: Option<DateTime<Utc>>,
    /// Sample interval for downsampling
    sample_interval: Option<Duration>,
    /// Additional filter conditions
    filters: Vec<String>,
    /// Fields to select
    fields: Vec<String>,
    /// Max number of records to return
    limit: Option<usize>,
    /// Order direction
    order: Order,
    /// Phantom type for the model
    _phantom: std::marker::PhantomData<T>,
}

/// Order direction for query results
#[derive(Debug, Clone, Copy)]
pub enum Order {
    /// Ascending order (oldest first)
    Asc,
    /// Descending order (newest first)
    Desc,
}

impl<T: TimeSeriesModel> TimeSeriesQuery<T> {
    /// Create a new query for the given model
    pub fn new() -> Self {
        Self {
            table: T::table_name(),
            start_time: None,
            end_time: None,
            sample_interval: None,
            filters: Vec::new(),
            fields: Vec::new(),
            limit: None,
            order: Order::Desc,
            _phantom: std::marker::PhantomData,
        }
    }

    /// Set the start time for the query
    pub fn start(mut self, time: DateTime<Utc>) -> Self {
        self.start_time = Some(time);
        self
    }

    /// Set the end time for the query
    pub fn end(mut self, time: DateTime<Utc>) -> Self {
        self.end_time = Some(time);
        self
    }

    /// Set the sample interval for downsampling
    pub fn sample_by(mut self, interval: Duration) -> Self {
        self.sample_interval = Some(interval);
        self
    }

    /// Add a filter condition
    pub fn filter(mut self, condition: String) -> Self {
        self.filters.push(condition);
        self
    }

    /// Set the fields to select
    pub fn select_fields(mut self, fields: Vec<String>) -> Self {
        self.fields = fields;
        self
    }

    /// Set the limit for the number of records
    pub fn limit(mut self, limit: usize) -> Self {
        self.limit = Some(limit);
        self
    }

    /// Set the order direction
    pub fn order(mut self, order: Order) -> Self {
        self.order = order;
        self
    }

    /// Build the SQL query for QuestDB
    pub fn build_sql(&self) -> String {
        let mut sql = String::from("SELECT ");

        // Add fields or * if no fields specified
        if self.fields.is_empty() {
            sql.push('*');
        } else {
            sql.push_str(&self.fields.join(", "));
        }

        // Add table
        sql.push_str(" FROM ");
        sql.push_str(self.table);

        // Add time range filters
        let mut where_clauses = Vec::new();

        if let Some(start) = self.start_time {
            where_clauses.push(format!(
                "{} >= '{}'",
                T::timestamp_field(),
                start.to_rfc3339()
            ));
        }

        if let Some(end) = self.end_time {
            where_clauses.push(format!(
                "{} <= '{}'",
                T::timestamp_field(),
                end.to_rfc3339()
            ));
        }

        // Add custom filters
        where_clauses.extend(self.filters.clone());

        // Build WHERE clause
        if !where_clauses.is_empty() {
            sql.push_str(" WHERE ");
            sql.push_str(&where_clauses.join(" AND "));
        }

        // Add SAMPLE BY for downsampling if specified
        if let Some(interval) = self.sample_interval {
            let millis = interval.as_millis();
            sql.push_str(&format!(" SAMPLE BY {}ms", millis));
        }

        // Add ORDER BY
        sql.push_str(&format!(
            " ORDER BY {} {}",
            T::timestamp_field(),
            match self.order {
                Order::Asc => "ASC",
                Order::Desc => "DESC",
            }
        ));

        // Add LIMIT
        if let Some(limit) = self.limit {
            sql.push_str(&format!(" LIMIT {}", limit));
        }

        sql
    }
}

/// Base DB operations for time series data
#[async_trait]
pub trait TimeSeriesDb<T: TimeSeriesModel> {
    /// Create a new time series record
    async fn create(&self, model: T) -> Result<()>;

    /// Query time series data
    async fn query(&self, query: TimeSeriesQuery<T>) -> Result<Vec<T>>;

    /// Get the latest record
    async fn latest(&self) -> Result<Option<T>>;

    /// Delete records by time range
    async fn delete_range(&self, start: DateTime<Utc>, end: DateTime<Utc>) -> Result<usize>;
}

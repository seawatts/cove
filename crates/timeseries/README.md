# Cove Timeseries Database Client

A high-performance time series database client for the Cove home automation platform using QuestDB. This client provides a simple and efficient way to store and query time series data from IoT devices.

## Features

- Uses the official QuestDB Rust client for optimal performance
- High-throughput data ingestion with automatic batching
- Flexible SQL querying with QuestDB extensions like SAMPLE BY
- Type-safe Rust interface with trait-based abstractions
- Integration with the Cove system service architecture
- Built-in support for common IoT data patterns

## Usage

### Setting up the service

```rust
use timeseries::TimeseriesDbService;
use types::system_service::Service;

// Create the service
let service = TimeseriesDbService::new()
    .with_host("127.0.0.1".parse().unwrap())
    .with_ilp_port(9009)    // InfluxDB Line Protocol port
    .with_http_port(9000);  // HTTP API port

// Initialize the service
service.init().await?;
service.run().await?;
```

### Creating and querying data

```rust
use timeseries::{Ts, SensorReading};
use chrono::Utc;

// Create a sensor reading
let reading = SensorReading {
    ts: Utc::now(),
    device_id: "device_123".to_string(),
    sensor: "temperature".to_string(),
    value: 22.5,
    unit: Some("celsius".to_string()),
    room: Some("living_room".to_string()),
};

// Insert the reading
Ts::create(reading).await?;

// Query with time range and downsampling
let one_hour_ago = Utc::now() - chrono::Duration::hours(1);
let results = Ts::query(
    Ts::builder::<SensorReading>()
        .start(one_hour_ago)
        .end(Utc::now())
        .sample_by(std::time::Duration::from_secs(60))  // 1 minute intervals
        .filter("room = 'living_room'".to_string())
        .limit(100)
).await?;

// Get the latest reading
let latest = Ts::latest::<SensorReading>().await?;

// Execute a raw SQL query
let results = Ts::execute_sql(
    "SELECT * FROM sensor_readings WHERE device_id = 'device_123' LIMIT 10"
).await?;
```

### Efficient bulk inserts with buffers

```rust
// Get a buffer for manual data entry
let mut buffer = Ts::get_buffer()?;

// Add multiple readings efficiently
buffer.table("sensor_readings");
buffer.symbol("device_id", "device_456");
buffer.symbol("sensor", "humidity");
buffer.column_f64("value", 45.2);
buffer.symbol("unit", "percent");
buffer.symbol("room", "bedroom");
buffer.at(Utc::now());

// Add another reading to the same buffer
buffer.table("sensor_readings");
buffer.symbol("device_id", "device_789");
buffer.symbol("sensor", "pressure");
buffer.column_f64("value", 1013.25);
buffer.symbol("unit", "hPa");
buffer.symbol("room", "outside");
buffer.at(Utc::now());

// Flush the buffer to send all readings at once
buffer.flush().await?;
```

## Requirements

- QuestDB server running locally or accessible on the network
- ILP port (default: 9009) for data ingestion
- HTTP API port (default: 9000) for SQL operations

## Installation

### Setting up QuestDB

1. Install QuestDB with Docker:

```bash
docker run -p 9000:9000 -p 9009:9009 -p 8812:8812 questdb/questdb
```

2. Access the QuestDB web console at http://localhost:9000

## Architecture

- **Connection**: Handles QuestDB client connectivity
- **Models**: Type-safe schema definitions for time series data
- **Query**: Builder pattern for creating efficient queries
- **Service**: Integration with the Cove system service architecture

## License

See the project's main license file.
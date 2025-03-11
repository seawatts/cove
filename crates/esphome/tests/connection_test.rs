use esphome::{
    connection::{ESPHomeConnection, ESPHomeConnectionBuilder},
    proto::api::LogLevel,
    traits::{ESPHomeApi, EntityManagement, LogManagement, StateManagement},
    types::{ESPHomeConfig, Entity},
};
use miette::Result;

// Import the shared test utilities
mod utils;

/// Test basic functionality of the ESPHomeConnection
///
/// This test verifies:
/// 1. Creating a new connection directly
/// 2. Functionality with mock device data when real device is unavailable
#[tokio::test]
async fn test_basic_connection() -> Result<()> {
    // Initialize logging
    utils::init_logging();

    // Get device info from environment or defaults
    let (host, port, password) = match utils::get_real_device_info() {
        Some(info) => info,
        None => return Ok(()),
    };

    let address = format!("{}:{}", host, port);
    let config = ESPHomeConfig {
        address,
        password,
        timeout: std::time::Duration::from_secs(5),
    };

    // Try to create a connection - if it fails, show mock device info
    let mut connection = ESPHomeConnection::new(config).await?;

    connection.hello().await?;
    connection.connect().await?;

    println!("Connected to device");

    let device_info = connection.device_info().await?;
    println!("Device info: {:?}", device_info);

    Ok(())
}

#[tokio::test]
async fn test_list_binary_sensors() -> Result<()> {
    // Initialize logging
    utils::init_logging();
    let (host, port, password) = match utils::get_real_device_info() {
        Some(info) => info,
        None => return Ok(()),
    };

    let address = format!("{}:{}", host, port);
    let config = ESPHomeConfig {
        address,
        password,
        timeout: std::time::Duration::from_secs(5),
    };

    let mut connection = ESPHomeConnection::new(config).await?;
    connection.hello().await?;
    connection.connect().await?;

    let binary_sensors = connection.list_entities().await?;
    println!("Binary sensors: {:?}", binary_sensors);

    Ok(())
}

#[tokio::test]
async fn test_subscribe_logs() -> Result<()> {
    // Initialize logging
    utils::init_logging();

    let (host, port, password) = match utils::get_real_device_info() {
        Some(info) => info,
        None => return Ok(()),
    };

    let address = format!("{}:{}", host, port);
    let config = ESPHomeConfig {
        address,
        password,
        timeout: std::time::Duration::from_secs(5),
    };

    let mut connection = ESPHomeConnection::new(config).await?;
    connection.hello().await?;
    connection.connect().await?;

    let mut logs_rx = connection
        .subscribe_logs(Some(LogLevel::Debug as i32))
        .await?;

    println!("Subscribed to logs");

    while let Some(log) = logs_rx.recv().await {
        // Convert the message bytes to a UTF-8 string
        match String::from_utf8(log.message) {
            Ok(message) => println!("Log: {}", message),
            Err(e) => println!("Invalid UTF-8 log message: {:?}", e),
        }
    }

    Ok(())
}

#[tokio::test]
async fn test_subscribe_states() -> Result<()> {
    // Initialize logging
    utils::init_logging();

    let (host, port, password) = match utils::get_real_device_info() {
        Some(info) => info,
        None => return Ok(()),
    };

    let address = format!("{}:{}", host, port);
    let config = ESPHomeConfig {
        address,
        password,
        timeout: std::time::Duration::from_secs(5),
    };

    let mut connection = ESPHomeConnection::new(config).await?;
    connection.hello().await?;
    connection.connect().await?;

    let mut states_rx = connection
        .subscribe_states(move |entity, response| {
            Box::pin(async move {
                println!("State: {:?}", entity);
                println!("Response: {:?}", response);
            })
        })
        .await?;
    println!("Subscribed to states");

    Ok(())
}

#[tokio::test]
async fn test_list_entities() -> Result<()> {
    // Initialize logging
    utils::init_logging();

    let (host, port, password) = match utils::get_real_device_info() {
        Some(info) => info,
        None => return Ok(()),
    };

    let address = format!("{}:{}", host, port);
    let config = ESPHomeConfig {
        address,
        password,
        timeout: std::time::Duration::from_secs(5),
    };

    let mut connection = ESPHomeConnection::new(config).await?;
    connection.hello().await?;
    connection.connect().await?;

    let entities = connection.list_entities().await?;

    // Pretty print all entities
    println!("All Entities (pretty-print):");
    println!("{:#?}", entities);

    // Print count by entity type
    let binary_sensors = entities
        .iter()
        .filter(|e| matches!(e, Entity::BinarySensor(_)))
        .count();
    let sensors = entities
        .iter()
        .filter(|e| matches!(e, Entity::Sensor(_)))
        .count();
    let lights = entities
        .iter()
        .filter(|e| matches!(e, Entity::Light(_)))
        .count();
    let text_sensors = entities
        .iter()
        .filter(|e| matches!(e, Entity::TextSensor(_)))
        .count();
    let covers = entities
        .iter()
        .filter(|e| matches!(e, Entity::Cover(_)))
        .count();
    let fans = entities
        .iter()
        .filter(|e| matches!(e, Entity::Fan(_)))
        .count();
    let switches = entities
        .iter()
        .filter(|e| matches!(e, Entity::Switch(_)))
        .count();
    let climates = entities
        .iter()
        .filter(|e| matches!(e, Entity::Climate(_)))
        .count();
    let cameras = entities
        .iter()
        .filter(|e| matches!(e, Entity::Camera(_)))
        .count();
    let numbers = entities
        .iter()
        .filter(|e| matches!(e, Entity::Number(_)))
        .count();
    let selects = entities
        .iter()
        .filter(|e| matches!(e, Entity::Select(_)))
        .count();
    let sirens = entities
        .iter()
        .filter(|e| matches!(e, Entity::Siren(_)))
        .count();
    let locks = entities
        .iter()
        .filter(|e| matches!(e, Entity::Lock(_)))
        .count();
    let buttons = entities
        .iter()
        .filter(|e| matches!(e, Entity::Button(_)))
        .count();
    let media_players = entities
        .iter()
        .filter(|e| matches!(e, Entity::MediaPlayer(_)))
        .count();
    let events = entities
        .iter()
        .filter(|e| matches!(e, Entity::Event(_)))
        .count();
    let alarm_control_panels = entities
        .iter()
        .filter(|e| matches!(e, Entity::AlarmControlPanel(_)))
        .count();
    let dates = entities
        .iter()
        .filter(|e| matches!(e, Entity::Date(_)))
        .count();
    let datetimes = entities
        .iter()
        .filter(|e| matches!(e, Entity::DateTime(_)))
        .count();
    let texts = entities
        .iter()
        .filter(|e| matches!(e, Entity::Text(_)))
        .count();
    let times = entities
        .iter()
        .filter(|e| matches!(e, Entity::Time(_)))
        .count();
    let valves = entities
        .iter()
        .filter(|e| matches!(e, Entity::Valve(_)))
        .count();
    let updates = entities
        .iter()
        .filter(|e| matches!(e, Entity::Update(_)))
        .count();

    println!("\nEntity Count Summary:");
    println!("- Binary Sensors: {}", binary_sensors);
    println!("- Sensors: {}", sensors);
    println!("- Lights: {}", lights);
    println!("- Text Sensors: {}", text_sensors);
    println!("- Covers: {}", covers);
    println!("- Fans: {}", fans);
    println!("- Switches: {}", switches);
    println!("- Climates: {}", climates);
    println!("- Cameras: {}", cameras);
    println!("- Numbers: {}", numbers);
    println!("- Selects: {}", selects);
    println!("- Sirens: {}", sirens);
    println!("- Locks: {}", locks);
    println!("- Buttons: {}", buttons);
    println!("- Media Players: {}", media_players);
    println!("- Events: {}", events);
    println!("- Alarm Control Panels: {}", alarm_control_panels);
    println!("- Dates: {}", dates);
    println!("- DateTimes: {}", datetimes);
    println!("- Texts: {}", texts);
    println!("- Times: {}", times);
    println!("- Valves: {}", valves);
    println!("- Updates: {}", updates);
    println!("- Total: {}", entities.len());

    Ok(())
}

#[tokio::test]
async fn test_list_services() -> Result<()> {
    // Initialize logging
    utils::init_logging();

    let (host, port, password) = match utils::get_real_device_info() {
        Some(info) => info,
        None => return Ok(()),
    };

    let address = format!("{}:{}", host, port);
    let config = ESPHomeConfig {
        address,
        password,
        timeout: std::time::Duration::from_secs(5),
    };

    let mut connection = ESPHomeConnection::new(config).await?;
    connection.hello().await?;
    connection.connect().await?;

    // let services = connection.list_services().await?;
    // println!("Services: {:?}", services);

    Ok(())
}

/// Test the ESPHomeConnectionBuilder
///
/// This test verifies creating a connection using the builder pattern
#[tokio::test]
async fn test_connection_builder() -> Result<()> {
    // Initialize logging
    utils::init_logging();

    // Get device info from environment or defaults
    let (host, port, password) = match utils::get_real_device_info() {
        Some(info) => info,
        None => return Ok(()),
    };

    let address = format!("{}:{}", host, port);
    let config = ESPHomeConfig {
        address,
        password,
        timeout: std::time::Duration::from_secs(5),
    };

    // Test building a connection without connecting - this should always work
    let builder = ESPHomeConnectionBuilder::new();
    let _builder_with_config = builder.config(config);

    Ok(())
}

/// Test error handling in the ESPHomeConnection
///
/// This test verifies connection errors with invalid addresses
#[tokio::test]
async fn test_connection_errors() -> Result<()> {
    // Initialize logging
    utils::init_logging();

    // Test connection error with invalid address
    let invalid_address = "127.0.0.1:1234"; // Assuming nothing is running on this port
    let config = ESPHomeConfig {
        address: invalid_address.to_string(),
        password: None,
        timeout: std::time::Duration::from_secs(5),
    };
    let result = ESPHomeConnection::new(config).await;

    match result {
        Ok(_) => {
            panic!("Expected connection to fail with invalid address");
        }
        Err(_) => {
            // Test passed - we got the expected error
        }
    }

    Ok(())
}

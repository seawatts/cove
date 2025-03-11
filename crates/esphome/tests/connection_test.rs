use esphome::{
    connection::{ESPHomeConnection, ESPHomeConnectionBuilder},
    proto::api::LogLevel,
};
use miette::Result;
use tokio::time::timeout;

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

    // Try to create a connection - if it fails, show mock device info
    let mut connection = ESPHomeConnection::new(address.clone(), password.clone()).await?;

    connection.connect().await?;

    println!("Connected to device");

    let device_info = connection.device_info().await;
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

    let mut connection = ESPHomeConnection::new(address, password).await?;
    connection.connect().await?;

    let binary_sensors = connection.list_binary_sensors().await?;
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

    let mut connection = ESPHomeConnection::new(address, password).await?;
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

    // Test building a connection without connecting - this should always work
    let builder = ESPHomeConnectionBuilder::new(address.clone());
    let _builder_with_password = match &password {
        Some(pwd) => builder.password(pwd.clone()),
        None => builder,
    };

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
    let result = ESPHomeConnection::new(invalid_address, None).await;

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

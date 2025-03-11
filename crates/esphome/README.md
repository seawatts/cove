# ESPHome Client for Cove

A Rust library for communicating with ESPHome devices using Protocol Buffers.

## Overview

This library provides a client for interacting with ESPHome devices via the native API. It uses Protocol Buffers for efficient communication and provides a high-level API for controlling various types of devices including lights, switches, fans, and covers.

## Features

- **Protocol Buffer Communication**: Efficient binary communication with ESPHome devices
- **Device Discovery**: Simple API to discover ESPHome devices on the network
- **Device Registry**: Manage multiple devices with a simple registry
- **Typed API**: Strongly typed Rust API for interacting with devices
- **Async**: Fully asynchronous API using Tokio
- **Error Handling**: Comprehensive error handling
- **State Tracking**: Automatically track state changes of ESPHome entities
- **Unsolicited Message Handling**: Process standard ESPHome messages like ping and time requests automatically

## Supported Device Types

- Binary Sensors
- Sensors
- Text Sensors
- Switches
- Lights (with RGB, brightness, temperature support)
- Fans (with speed and oscillation control)
- Covers (with position and tilt control)

## Getting Started

```rust
use esphome::{ESPHomeClient, Result};

#[tokio::main]
async fn main() -> Result<()> {
    // Create a new client
    let client = ESPHomeClient::new();

    // Add a device
    let device_id = client.add_device("esp-device.local".to_string(), None, None).await?;

    // Connect to the device
    client.connect_device(&device_id).await?;

    // Get device info
    let info = client.get_device_info(&device_id).await?;
    println!("Connected to device: {} ({})", info.name, info.model);

    // Control a light
    client.set_light_state(
        &device_id,
        "light_id",
        true,                     // Turn on
        Some(255),                // Full brightness
        Some((255, 0, 0)),        // Red color
        None,                     // No temperature change
        None,                     // No effect
    ).await?;

    // Disconnect
    client.disconnect_device(&device_id).await?;

    Ok(())
}
```

## ESPHome API

This library implements the ESPHome native API protocol, which uses Protocol Buffers for communication. The API is documented in the [ESPHome documentation](https://esphome.io/components/api.html).

## Error Handling

All functions return a `Result<T, Error>` type, allowing for comprehensive error handling:

```rust
match client.connect_device(&device_id).await {
    Ok(_) => println!("Connected successfully!"),
    Err(e) => eprintln!("Failed to connect: {}", e),
}
```

## State Tracking

The library now supports automatic state tracking for ESPHome entities:

```rust
use esphome::{ESPHomeClient, Result, EntityState};
use esphome::connection::{Connection, ESPHomeConnection};

#[tokio::main]
async fn main() -> Result<()> {
    // Create a new client
    let client = ESPHomeClient::new();

    // Add a device
    let device_id = client.add_device("esp-device.local".to_string(), None, None).await?;

    // Connect to the device
    client.connect_device(&device_id).await?;

    // Get device info to create a direct connection
    let info = client.get_device_info(&device_id).await?;

    // Create a direct connection for state tracking
    let mut connection = ESPHomeConnection::new(
        info.address.host.clone(),
        info.address.port,
        None // password
    );

    // Connect the direct connection
    connection.connect().await?;

    // Register for state tracking
    let states = connection.register_state_tracking().await?;

    // Subscribe to states via the client
    client.subscribe_states(&device_id).await?;

    // Wait for state changes
    tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;

    // Get a sensor state by key
    if let Some(EntityState::Measurement(value)) = connection.get_entity_state(&states, 1234).await {
        println!("Sensor value: {}", value);
    }

    // Or use the states registry directly
    let states_guard = states.read().unwrap();
    for (key, state) in states_guard.iter() {
        match state {
            EntityState::Measurement(value) => println!("Sensor {}: {}", key, value),
            EntityState::Binary(value) => println!("Binary sensor {}: {}", key, value),
            EntityState::Text(value) => println!("Text sensor {}: {}", key, value),
            _ => println!("Other entity {}: {:?}", key, state),
        }
    }

    // Disconnect both connections
    connection.disconnect().await?;
    client.disconnect_device(&device_id).await?;

    Ok(())
}
```

## License

This library is part of the Cove project.
use axum::{
    extract::State,
    routing::{get, post},
    Json, Router,
};
use miette::Result;
use serde::{Deserialize, Serialize};
use tracing::info;
use types::homekit::{HomeKitDevice, HomeKitDeviceConfig};

use crate::AppState;

pub fn homekit_routes() -> Router<AppState> {
    Router::new()
        .route("/devices", get(get_devices))
        .route("/devices/:id", get(get_device))
        .route("/devices", post(add_device))
        .route("/devices/:id/remove", post(remove_device))
        .route("/pair", post(pair_device))
}

#[derive(Debug, Deserialize)]
pub struct PairDeviceRequest {
    /// The HomeKit setup code (format: XXX-XX-XXX)
    setup_code: String,
    /// The device model (e.g., "U100")
    model: String,
    /// User-assigned name for the device
    name: String,
    /// Device identifier (from QR code or manual input)
    device_id: String,
    /// Optional room assignment
    room: Option<String>,
    /// Device-specific configuration
    config: Option<serde_json::Value>,
}

#[derive(Debug, Serialize)]
pub struct PairDeviceResponse {
    success: bool,
    message: String,
    device: Option<HomeKitDevice>,
}

async fn pair_device(
    State(state): State<AppState>,
    Json(request): Json<PairDeviceRequest>,
) -> Result<Json<PairDeviceResponse>> {
    info!("Pairing HomeKit device: {}", request.name);

    // Validate setup code format (XXX-XX-XXX)
    if !request.setup_code.matches(r"^\d{3}-\d{2}-\d{3}$") {
        return Ok(Json(PairDeviceResponse {
            success: false,
            message: "Invalid setup code format".into(),
            device: None,
        }));
    }

    // Create device configuration
    let device_config = HomeKitDeviceConfig {
        name: request.name,
        room: request.room,
        auto_notify: true,
        service_configs: Default::default(), // Can be customized based on device type
    };

    // Add device through HomeKit protocol
    match state.homekit_protocol.add_device(device_config).await {
        Ok(device) => Ok(Json(PairDeviceResponse {
            success: true,
            message: "Device paired successfully".into(),
            device: Some(device),
        })),
        Err(e) => Ok(Json(PairDeviceResponse {
            success: false,
            message: format!("Failed to pair device: {}", e),
            device: None,
        })),
    }
}

async fn get_devices(State(state): State<AppState>) -> Result<Json<Vec<HomeKitDevice>>> {
    let devices = state.homekit_protocol.get_devices().await?;
    Ok(Json(devices))
}

async fn get_device(
    State(state): State<AppState>,
    axum::extract::Path(device_id): axum::extract::Path<String>,
) -> Result<Json<Option<HomeKitDevice>>> {
    let device = state.homekit_protocol.get_device(&device_id).await?;
    Ok(Json(device))
}

async fn remove_device(
    State(state): State<AppState>,
    axum::extract::Path(device_id): axum::extract::Path<String>,
) -> Result<Json<bool>> {
    state.homekit_protocol.remove_device(&device_id).await?;
    Ok(Json(true))
}

#[derive(Debug, Serialize)]
pub struct DeviceStateResponse {
    device: HomeKitDevice,
    services: Vec<ServiceState>,
}

#[derive(Debug, Serialize)]
pub struct ServiceState {
    id: String,
    name: String,
    characteristics: Vec<CharacteristicState>,
}

#[derive(Debug, Serialize)]
pub struct CharacteristicState {
    id: String,
    name: String,
    value: Option<serde_json::Value>,
    last_updated: chrono::DateTime<chrono::Utc>,
}

async fn get_device_state(
    State(state): State<AppState>,
    axum::extract::Path(device_id): axum::extract::Path<String>,
) -> Result<Json<DeviceStateResponse>> {
    let device = state
        .homekit_protocol
        .get_device(&device_id)
        .await?
        .ok_or_else(|| miette::miette!("Device not found"))?;

    let events = state.homekit_protocol.get_state(&device_id).await?;

    // Transform events into service states
    let mut services = Vec::new();
    // ... transform logic here ...

    Ok(Json(DeviceStateResponse { device, services }))
}

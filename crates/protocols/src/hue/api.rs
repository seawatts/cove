use std::collections::HashMap;

use miette::Result;
use reqwest::Client;
use serde_json::Value;
use url::Url;

use super::types::{CreateUserResponse, HueLight};
use crate::error::ProtocolError;

/// Client for interacting with the Hue bridge API
#[derive(Debug, Clone)]
pub struct HueApi {
    client: Client,
    base_url: Url,
    username: Option<String>,
}

impl HueApi {
    pub fn new(client: Client, base_url: Url, username: Option<String>) -> Self {
        Self {
            client,
            base_url,
            username,
        }
    }

    /// Creates a new user on the Hue bridge
    pub async fn create_user(&self, device_type: &str) -> Result<String> {
        let url = self
            .base_url
            .join("/api")
            .map_err(|e| ProtocolError::ConfigurationError(e.to_string()))?;
        let body = serde_json::json!({
            "devicetype": device_type,
        });

        let response = self
            .client
            .post(url)
            .json(&body)
            .send()
            .await
            .map_err(|e| ProtocolError::HttpError(e))?;

        let responses: Vec<CreateUserResponse> = response
            .json()
            .await
            .map_err(|e| ProtocolError::HttpError(e))?;

        // Get the first successful response
        let user_response = responses.first().ok_or_else(|| {
            ProtocolError::AuthenticationError("No response from bridge".to_string())
        })?;

        if let Some(error) = &user_response.error {
            return Err(ProtocolError::AuthenticationError(error.description.clone()).into());
        }

        let username = user_response
            .success
            .as_ref()
            .ok_or_else(|| ProtocolError::AuthenticationError("No success response".to_string()))?
            .username
            .clone();

        Ok(username)
    }

    /// Gets all lights from the bridge
    pub async fn get_lights(&self) -> Result<HashMap<String, HueLight>> {
        let username = self
            .username
            .as_ref()
            .ok_or_else(|| ProtocolError::AuthenticationError("Not authenticated".to_string()))?;

        let url = self
            .base_url
            .join(&format!("/api/{}/lights", username))
            .map_err(|e| ProtocolError::ConfigurationError(e.to_string()))?;

        let response = self
            .client
            .get(url)
            .send()
            .await
            .map_err(|e| ProtocolError::HttpError(e))?;

        let mut lights: HashMap<String, HueLight> = response
            .json()
            .await
            .map_err(|e| ProtocolError::HttpError(e))?;

        // Add the light ID to each light object
        for (id, light) in lights.iter_mut() {
            light.id = id.clone();
        }

        Ok(lights)
    }

    /// Gets a specific light from the bridge
    pub async fn get_light(&self, light_id: &str) -> Result<HueLight> {
        let username = self
            .username
            .as_ref()
            .ok_or_else(|| ProtocolError::AuthenticationError("Not authenticated".to_string()))?;

        let url = self
            .base_url
            .join(&format!("/api/{}/lights/{}", username, light_id))
            .map_err(|e| ProtocolError::ConfigurationError(e.to_string()))?;

        let mut light: HueLight = self
            .client
            .get(url)
            .send()
            .await
            .map_err(|e| ProtocolError::HttpError(e))?
            .json()
            .await
            .map_err(|e| ProtocolError::HttpError(e))?;

        // Add the light ID
        light.id = light_id.to_string();

        Ok(light)
    }

    /// Sets the state of a light
    pub async fn set_light_state(&self, light_id: &str, state: Value) -> Result<()> {
        let username = self
            .username
            .as_ref()
            .ok_or_else(|| ProtocolError::AuthenticationError("Not authenticated".to_string()))?;

        let url = self
            .base_url
            .join(&format!("/api/{}/lights/{}/state", username, light_id))
            .map_err(|e| ProtocolError::ConfigurationError(e.to_string()))?;

        let response = self
            .client
            .put(url)
            .json(&state)
            .send()
            .await
            .map_err(|e| ProtocolError::HttpError(e))?;

        if !response.status().is_success() {
            return Err(ProtocolError::CommandError(format!(
                "Failed to set light state: {}",
                response.status()
            ))
            .into());
        }

        Ok(())
    }
}

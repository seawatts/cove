use miette::Result;
use reqwest::Client;
use serde_json::json;

use super::types::{AqaraLock, CreateSessionResponse};
use crate::error::ProtocolError;

const AQARA_API_BASE: &str = "https://api.aqara.com/v3.0";

/// Client for interacting with the Aqara cloud API
#[derive(Debug, Clone)]
pub struct AqaraApi {
    client: Client,
    cloud_key: String,
    device_id: String,
    session_token: Option<String>,
}

impl AqaraApi {
    pub fn new(client: Client, cloud_key: String, device_id: String) -> Self {
        Self {
            client,
            cloud_key,
            device_id,
            session_token: None,
        }
    }

    /// Creates a new session with the Aqara cloud
    pub async fn create_session(&mut self) -> Result<String> {
        let url = format!("{}/open/account/token", AQARA_API_BASE);
        let body = json!({
            "key": self.cloud_key,
            "grant_type": "client_credentials",
        });

        let response = self
            .client
            .post(&url)
            .json(&body)
            .send()
            .await
            .map_err(|e| ProtocolError::HttpError(e))?;

        let session_response: CreateSessionResponse = response
            .json()
            .await
            .map_err(|e| ProtocolError::HttpError(e))?;

        if let Some(error) = session_response.error {
            return Err(ProtocolError::AuthenticationError(error.message).into());
        }

        let token = session_response
            .session_token
            .ok_or_else(|| ProtocolError::AuthenticationError("No session token".to_string()))?;

        self.session_token = Some(token.clone());
        Ok(token)
    }

    /// Gets the current state of the lock
    pub async fn get_lock(&self, lock_id: &str) -> Result<AqaraLock> {
        let token = self.ensure_session().await?;
        let url = format!("{}/open/device/info", AQARA_API_BASE);

        let response = self
            .client
            .get(&url)
            .header("Authorization", format!("Bearer {}", token))
            .query(&[("did", lock_id)])
            .send()
            .await
            .map_err(|e| ProtocolError::HttpError(e))?;

        let lock: AqaraLock = response
            .json()
            .await
            .map_err(|e| ProtocolError::HttpError(e))?;

        Ok(lock)
    }

    /// Sets the state of the lock
    pub async fn set_lock_state(&self, lock_id: &str, locked: bool) -> Result<()> {
        let token = self.ensure_session().await?;
        let url = format!("{}/open/device/control", AQARA_API_BASE);

        let body = json!({
            "did": lock_id,
            "command": if locked { "lock" } else { "unlock" },
        });

        let response = self
            .client
            .post(&url)
            .header("Authorization", format!("Bearer {}", token))
            .json(&body)
            .send()
            .await
            .map_err(|e| ProtocolError::HttpError(e))?;

        if !response.status().is_success() {
            return Err(ProtocolError::CommandError(format!(
                "Failed to set lock state: {}",
                response.status()
            ))
            .into());
        }

        Ok(())
    }

    /// Ensures we have a valid session token
    async fn ensure_session(&self) -> Result<String> {
        match &self.session_token {
            Some(token) => Ok(token.clone()),
            None => {
                // Clone self to get a mutable reference
                let mut this = self.clone();
                this.create_session().await
            }
        }
    }
}

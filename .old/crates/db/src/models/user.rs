use cuid2::create_id;
use serde::{Deserialize, Serialize};

use crate::model::Model;

/// User roles in the Cove platform
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum UserRole {
    Admin,
    User,
    Guest,
    ServiceAccount,
}

/// Model for a user in the Cove home automation platform
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    /// Unique identifier for the user
    pub id: String,

    /// Username for the user
    pub username: String,

    /// Display name for the user
    pub display_name: String,

    /// Email address for the user
    pub email: Option<String>,

    /// Hashed password (stored securely)
    #[serde(skip_serializing)]
    pub password_hash: Option<String>,

    /// User role for permission management
    pub role: UserRole,

    /// Whether the user is currently active
    pub active: bool,

    /// API token for automated access
    #[serde(skip_serializing)]
    pub api_token: Option<String>,

    /// User's preferences
    pub preferences: serde_json::Value,

    /// When the user was created
    pub created_at: chrono::DateTime<chrono::Utc>,

    /// When the user was last updated
    pub updated_at: chrono::DateTime<chrono::Utc>,

    /// When the user last logged in
    pub last_login: Option<chrono::DateTime<chrono::Utc>>,
}

impl Model for User {
    fn table_name() -> &'static str {
        "users"
    }

    fn id(&self) -> String {
        self.id.clone()
    }

    fn set_id(&mut self, id: String) {
        self.id = id;
    }
}

impl User {
    /// Create a new user with minimal information
    pub fn new(username: &str, display_name: &str, role: UserRole) -> Self {
        let now = chrono::Utc::now();
        User {
            id: String::new(), // Will be set by Db::create
            username: username.to_string(),
            display_name: display_name.to_string(),
            email: None,
            password_hash: None,
            role,
            active: true,
            api_token: None,
            preferences: serde_json::json!({}),
            created_at: now,
            updated_at: now,
            last_login: None,
        }
    }

    /// Set the email for this user
    pub fn with_email(mut self, email: &str) -> Self {
        self.email = Some(email.to_string());
        self
    }

    /// Set the password hash for this user
    pub fn with_password_hash(mut self, password_hash: &str) -> Self {
        self.password_hash = Some(password_hash.to_string());
        self
    }

    /// Record a user login
    pub fn record_login(&mut self) {
        let now = chrono::Utc::now();
        self.last_login = Some(now);
        self.updated_at = now;
    }

    /// Activate or deactivate the user
    pub fn set_active(&mut self, active: bool) {
        self.active = active;
        self.updated_at = chrono::Utc::now();
    }

    /// Generate a new API token for the user
    pub fn generate_api_token(&mut self) -> String {
        let token = create_id();
        self.api_token = Some(token.clone());
        self.updated_at = chrono::Utc::now();
        token
    }

    /// Add a preference value
    pub fn set_preference(&mut self, key: &str, value: serde_json::Value) {
        if let serde_json::Value::Object(ref mut map) = self.preferences {
            map.insert(key.to_string(), value);
            self.updated_at = chrono::Utc::now();
        }
    }
}

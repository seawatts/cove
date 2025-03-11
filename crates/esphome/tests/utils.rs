use logging;
use std::env;

/// Returns the host, port and password for a real ESPHome device from environment
/// variables or defaults to predefined values.
pub fn get_real_device_info() -> Option<(String, u16, Option<String>)> {
    // First try environment variables
    if let Ok(host) = env::var("ESPHOME_TEST_HOST") {
        let port = env::var("ESPHOME_TEST_PORT")
            .unwrap_or_else(|_| "6053".to_string())
            .parse::<u16>()
            .unwrap_or(6053);
        let password = env::var("ESPHOME_TEST_PASSWORD").ok();
        return Some((host, port, password));
    }

    // Use default values if no environment variables are set
    let default_host = "10.0.0.84".to_string();
    let default_port = 6053;
    let default_password = Some("".to_string());

    Some((default_host, default_port, default_password))
}

/// Initializes logging for tests
pub fn init_logging() {
    let _ = logging::setup_logging();
}

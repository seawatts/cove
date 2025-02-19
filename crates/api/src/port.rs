use miette::Result;
use owo_colors::OwoColorize;
use std::net::SocketAddr;
use tokio::net::TcpListener;
use tracing::warn;

/// Finds an available port starting from the given port number.
///
/// # Arguments
/// * `start_port` - The port number to start searching from
///
/// # Returns
/// * `Result<u16>` - The first available port number found
///
/// # Errors
/// Returns an error if no ports are available between start_port and 65535
pub async fn find_available_port(start_port: u16) -> Result<u16> {
    let mut port = start_port;
    loop {
        let addr = SocketAddr::from(([0, 0, 0, 0], port));
        match TcpListener::bind(addr).await {
            Ok(_) => {
                return Ok(port);
            }
            Err(_) => {
                warn!(
                    "   {} Port {} is in use, trying {} instead.",
                    "⚠".red(),
                    port,
                    port + 1
                );
                port += 1;
                if port == 0 {
                    return Err(miette::miette!("No available ports found"));
                }
            }
        }
    }
}

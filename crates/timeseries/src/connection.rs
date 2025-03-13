use questdb::ingress::Sender;
use std::net::{IpAddr, Ipv4Addr};
use std::sync::OnceLock;
use tracing::info;

use crate::error::TsError;
use miette::Result;

/// Default QuestDB connection settings
const DEFAULT_HOST: IpAddr = IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1));
const _DEFAULT_ILP_PORT: u16 = 9009; // QuestDB InfluxDB line protocol port
const DEFAULT_HTTP_PORT: u16 = 9000; // QuestDB HTTP API port

/// Global QuestDB client connection string
static DB_CONN_STR: OnceLock<String> = OnceLock::new();

/// Initialize the QuestDB client connection
pub async fn initialize_client(
    host: Option<IpAddr>,
    _ilp_port: Option<u16>,
    http_port: Option<u16>,
) -> Result<()> {
    let host_str = host.unwrap_or(DEFAULT_HOST).to_string();
    let http_port = http_port.unwrap_or(DEFAULT_HTTP_PORT);

    // Configure the QuestDB client using the recommended pattern for HTTP protocol
    let conn_str = format!("http::addr={}:{};", host_str, http_port);

    // Store the connection string for future use
    DB_CONN_STR.set(conn_str).map_err(|_| {
        TsError::ConnectionFailed("Failed to set global connection string".to_string())
    })?;

    Ok(())
}

/// Create a new QuestDB sender instance
/// This follows the recommended pattern from the QuestDB documentation
pub fn create_sender() -> Result<Sender> {
    // Get the connection string
    // let conn_str = DB_CONN_STR
    //     .get()
    //     .ok_or_else(|| TsError::ConnectionNotInitialized)?;
    let host_str = DEFAULT_HOST;
    let http_port = DEFAULT_HTTP_PORT;

    // Configure the QuestDB client using the recommended pattern for HTTP protocol
    let conn_str = format!("http::addr={}:{};", host_str, http_port);

    info!(
        "Creating QuestDB sender with connection string: {}",
        conn_str
    );
    // Create a new sender from the configuration string
    // Each call gives us a fresh instance that can be used with mut
    Sender::from_conf(conn_str).map_err(|e| {
        TsError::ConnectionFailed(format!("Failed to create QuestDB sender: {}", e)).into()
    })
}

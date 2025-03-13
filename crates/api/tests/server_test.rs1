use std::time::Duration;

use api::ApiService;
use miette::Result;
use reqwest::Client;
use tokio::spawn;
use tokio::time::sleep;

#[tokio::test]
async fn test_server_network_accessibility() -> Result<()> {
    // Start the API server in a separate task
    let server_handle = spawn(async { start_api().await });

    // Give the server a moment to start up
    sleep(Duration::from_millis(100)).await;

    // Create an HTTP client
    let client = Client::new();

    // Get the local network IP
    let local_ip = local_ip_address::local_ip().unwrap().to_string();
    let local_url = format!("http://{}:4000", local_ip);

    // Test cases for different network interfaces
    let test_cases = vec![
        ("localhost", "http://localhost:4000"),
        ("127.0.0.1", "http://127.0.0.1:4000"),
        ("local network", &local_url),
    ];

    // Test each endpoint
    for (interface_name, url) in test_cases {
        match client.get(url).send().await {
            Ok(response) => {
                assert!(
                    response.status().is_success(),
                    "Failed to get successful response from {} ({})",
                    interface_name,
                    url
                );

                let text = response.text().await.unwrap();
                assert_eq!(
                    text, "Hello from Cove!",
                    "Unexpected response from {} ({})",
                    interface_name, url
                );
            }
            Err(e) => {
                panic!(
                    "Failed to connect to server via {} ({}): {}",
                    interface_name, url, e
                );
            }
        }
    }

    // Clean up - send ctrl-c signal to shut down the server
    server_handle.abort();

    Ok(())
}

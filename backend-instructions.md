Create the complete Rust backend for Cove, a lightweight, type-safe home automation system that integrates MQTT-based smart home devices, YAML-based configuration with strict type validation, and real-time automation processing. The code should be organized into clear modules with inline comments explaining the design and functionality. Include the following requirements:
	1.	Async Runtime & Concurrency:
	•	Use Tokio as the asynchronous runtime to handle concurrent tasks.
	•	Structure the application to spawn asynchronous tasks for MQTT communication, automation processing, and WebSocket server operations.
	2.	Configuration Management:
	•	Parse a YAML-based configuration file using Serde YAML.
	•	Validate configuration IDs and enforce strict type constraints using Rust’s type system.
	•	Include error handling for invalid configuration values (using crates like thiserror or anyhow).
	3.	MQTT Integration:
	•	Use an asynchronous MQTT client (e.g., rumqttc) to subscribe to and publish messages for smart home devices.
	•	Optimize MQTT performance with proper QoS settings, persistent sessions, and backpressure handling.
	•	Modularize MQTT-related code so that it can be easily maintained and scaled.
	4.	Real-Time Automation Engine:
	•	Process automation rules and events in real time.
	•	Implement a mechanism to receive device status updates and trigger automations accordingly.
	•	Optionally include a placeholder for integrating AI-driven automation predictions (e.g., connecting to an external AI service via REST or gRPC).
	5.	WebSocket Server:
	•	Set up a WebSocket server (using a framework like warp or actix-web) to push live updates to the Next.js dashboard.
	•	Ensure that the WebSocket server runs concurrently with other services and supports real-time notifications.
	6.	Backend API & Scalability Considerations:
	•	Expose REST or WebSocket endpoints for dashboard communication and remote control actions.
	•	Structure the code to allow future scalability, with clear separation of concerns between configuration management, MQTT communication, automation processing, and API endpoints.
	7.	Error Handling & Logging:
	•	Implement robust error handling throughout the backend.
	•	Use a logging crate (e.g., env_logger or tracing) to log important events and errors.
	8.	Testing & Documentation:
	•	Include unit tests for configuration parsing and a sample automation workflow.
	•	Add inline comments to explain the purpose and functionality of each module and function.
	9.	Environment Configuration:
	•	Use environment variables or a configuration file to set parameters such as the MQTT broker address, WebSocket port, and file paths.

Generate all the necessary code (organizing it into modules if needed) in a single file or with clear module boundaries. Ensure the code is production-ready, with detailed inline comments describing the architecture, design choices, and backend-to-frontend integration points.”

This prompt should instruct your agentic AI code editor to produce a complete, well-documented Rust backend that meets the requirements for Cove.
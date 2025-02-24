use async_trait::async_trait;
use miette::Result;
use std::sync::Arc;
use tokio::sync::broadcast;
use tokio::sync::Mutex;
use tokio::time::{sleep, Duration};
use types::{
    events::BusEvent,
    system_service::{Service, ServiceHandle},
};

pub struct EventBus {
    tx: broadcast::Sender<BusEvent>,
    handle: ServiceHandle,
    // Keep a receiver alive to prevent channel from closing
    _keep_alive_rx: Arc<Mutex<Option<broadcast::Receiver<BusEvent>>>>,
}

impl EventBus {
    pub fn new() -> Self {
        let (tx, rx) = broadcast::channel(1000); // Increase buffer size to 1000 events
        Self {
            tx,
            handle: ServiceHandle::new(),
            _keep_alive_rx: Arc::new(Mutex::new(Some(rx))),
        }
    }

    pub async fn subscribe(&self) -> broadcast::Receiver<BusEvent> {
        self.tx.subscribe()
    }

    pub async fn publish(&self, event: BusEvent) -> Result<()> {
        match self.tx.send(event.clone()) {
            Ok(_) => Ok(()),
            Err(e) => {
                tracing::warn!("Failed to publish event (channel might be lagging): {}", e);
                // Try to resubscribe and publish again
                let _ = self._keep_alive_rx.lock().await.as_mut().map(|rx| {
                    *rx = self.tx.subscribe();
                });
                match self.tx.send(event) {
                    Ok(_) => Ok(()),
                    Err(e) => {
                        tracing::error!("Failed to publish event after resubscribe: {}", e);
                        Ok(()) // Still don't propagate errors to callers
                    }
                }
            }
        }
    }
}

#[async_trait]
impl Service for EventBus {
    async fn init(&self) -> Result<()> {
        Ok(())
    }

    async fn run(&self) -> Result<()> {
        loop {
            tokio::select! {
                _ = tokio::time::sleep(Duration::from_millis(100)) => {},
                _ = self.handle.wait_for_cancel() => {
                    break;
                }
            }
        }
        Ok(())
    }

    async fn cleanup(&self) -> Result<()> {
        // Clear the keep-alive receiver
        *self._keep_alive_rx.lock().await = None;
        Ok(())
    }

    fn handle(&self) -> Option<&ServiceHandle> {
        Some(&self.handle)
    }
}

impl Clone for EventBus {
    fn clone(&self) -> Self {
        Self {
            tx: self.tx.clone(),
            handle: self.handle.clone(),
            _keep_alive_rx: self._keep_alive_rx.clone(),
        }
    }
}

// Example usage in comments:
//
// // In the discovery service:
// let event_bus = EventBus::new();
// event_bus.publish(BusEvent::DeviceDiscovered {
//     id: "device1".to_string(),
//     device_type: "light".to_string(),
//     metadata: HashMap::new(),
// })?;
//
// // In the registry service:
// let mut rx = event_bus.subscribe();
// while let Ok(event) = rx.recv().await {
//     match event {
//         BusEvent::DeviceDiscovered { id, device_type, metadata } => {
//             // Handle new device
//         },
//         BusEvent::DeviceUpdated { id, metadata } => {
//             // Handle device update
//         },
//         BusEvent::DeviceRemoved { id } => {
//             // Handle device removal
//         },
//     }
// }

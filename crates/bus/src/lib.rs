use async_trait::async_trait;
use miette::Result;
use tokio::sync::broadcast;
use tokio::time::{sleep, Duration};
use types::{
    events::BusEvent,
    system_service::{Service, ServiceHandle},
};

pub struct EventBus {
    tx: broadcast::Sender<BusEvent>,
    handle: ServiceHandle,
}

impl EventBus {
    pub fn new() -> Self {
        let (tx, _) = broadcast::channel(100); // Buffer size of 100 events
        Self {
            tx,
            handle: ServiceHandle::new(),
        }
    }

    pub fn subscribe(&self) -> broadcast::Receiver<BusEvent> {
        self.tx.subscribe()
    }

    pub fn publish(&self, event: BusEvent) -> Result<()> {
        self.tx
            .send(event)
            .map_err(|e| miette::miette!("Failed to publish event: {}", e))?;
        Ok(())
    }
}

#[async_trait]
impl Service for EventBus {
    async fn init(&self) -> Result<()> {
        Ok(())
    }

    async fn run(&self) -> Result<()> {
        // The ServiceHandle will call this method in a loop while running is true
        // We just need to yield control back regularly to allow shutdown
        sleep(Duration::from_millis(100)).await;
        Ok(())
    }

    async fn cleanup(&self) -> Result<()> {
        // The tx will be dropped when the service is dropped
        // This will automatically close all receivers
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
            handle: ServiceHandle::new(),
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

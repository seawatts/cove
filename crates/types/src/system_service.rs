use async_trait::async_trait;
use miette::{miette, Result};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::task::JoinHandle;

#[async_trait]
pub trait Service: Send + Sync {
    /// Initialize the service. Called before start.
    async fn init(&self) -> Result<()> {
        Ok(())
    }

    /// The main service logic to run in a separate task.
    async fn run(&self) -> Result<()>;

    /// Cleanup when the service is stopped.
    async fn cleanup(&self) -> Result<()> {
        Ok(())
    }

    /// Start the service
    async fn start(self: Arc<Self>) -> Result<()>
    where
        Self: Sized + 'static,
    {
        let service = self.clone();
        let handle = match self.handle() {
            Some(h) => h,
            None => return Err(miette!("Service has no handle")),
        };

        handle.start(service).await
    }

    /// Stop the service
    async fn stop(&self) -> Result<()>
    where
        Self: Sized + 'static,
    {
        let handle = {
            match self.handle() {
                Some(h) => h,
                None => return Err(miette!("Service has no handle")),
            }
        };

        handle.stop(self).await
    }

    /// Get the service handle
    fn handle(&self) -> Option<&ServiceHandle> {
        None
    }
}

pub struct ServiceHandle {
    running: Arc<AtomicBool>,
    task_handle: Mutex<Option<JoinHandle<()>>>,
}

impl ServiceHandle {
    pub fn new() -> Self {
        Self {
            running: Arc::new(AtomicBool::new(false)),
            task_handle: Mutex::new(None),
        }
    }

    // Allow unsized service types by using `?Sized` and require 'static.
    pub async fn start<S: Service + ?Sized + 'static>(&self, service: Arc<S>) -> Result<()> {
        if self.running.load(Ordering::SeqCst) {
            return Ok(());
        }

        service.init().await?;
        self.running.store(true, Ordering::SeqCst);
        let running = self.running.clone();

        let handle = tokio::spawn(async move {
            while running.load(Ordering::SeqCst) {
                if let Err(e) = service.run().await {
                    tracing::error!("Service error: {}", e);
                    break;
                }
            }
        });

        let mut task_handle = self.task_handle.lock().await;
        *task_handle = Some(handle);

        Ok(())
    }

    // Relax the Sized bound here as well.
    pub async fn stop<S: Service + ?Sized>(&self, service: &S) -> Result<()> {
        if !self.running.load(Ordering::SeqCst) {
            return Ok(());
        }

        self.running.store(false, Ordering::SeqCst);

        let mut task_handle = self.task_handle.lock().await;
        if let Some(handle) = task_handle.take() {
            handle
                .await
                .map_err(|e| miette!("Failed to join service task: {}", e))?;
        }

        service.cleanup().await?;
        Ok(())
    }
}

impl Default for ServiceHandle {
    fn default() -> Self {
        Self::new()
    }
}

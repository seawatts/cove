use async_trait::async_trait;
use miette::{miette, Result};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Mutex;
use tokio::sync::Notify;
use tokio::{task::JoinHandle, time::timeout};

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
        let handle = match self.handle() {
            Some(h) => h,
            None => return Err(miette!("Service has no handle")),
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
    stopped: Arc<AtomicBool>,
    cancel: Arc<Notify>,
    task_handle: Mutex<Option<JoinHandle<()>>>,
}

impl ServiceHandle {
    pub fn new() -> Self {
        Self {
            running: Arc::new(AtomicBool::new(false)),
            stopped: Arc::new(AtomicBool::new(false)),
            cancel: Arc::new(Notify::new()),
            task_handle: Mutex::new(None),
        }
    }

    pub fn is_stopped(&self) -> bool {
        self.stopped.load(Ordering::SeqCst)
    }

    pub async fn wait_for_cancel(&self) {
        self.cancel.notified().await
    }

    pub async fn start<S: Service + ?Sized + 'static>(&self, service: Arc<S>) -> Result<()> {
        if self.running.load(Ordering::SeqCst) || self.is_stopped() {
            return Ok(());
        }

        service.init().await?;
        self.running.store(true, Ordering::SeqCst);
        let running = self.running.clone();
        let stopped = self.stopped.clone();

        let handle = tokio::spawn(async move {
            while running.load(Ordering::SeqCst) && !stopped.load(Ordering::SeqCst) {
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

    pub async fn stop<S: Service + ?Sized>(&self, service: &S) -> Result<()> {
        const SHUTDOWN_TIMEOUT: Duration = Duration::from_secs(3);

        // Signal the service to stop
        self.running.store(false, Ordering::SeqCst);
        self.stopped.store(true, Ordering::SeqCst);
        self.cancel.notify_waiters();

        // Get the task handle
        let mut lock = self.task_handle.lock().await;
        if let Some(handle) = lock.take() {
            // Release the lock before waiting
            drop(lock);

            // Wait for the task with timeout
            match timeout(SHUTDOWN_TIMEOUT, handle).await {
                Ok(Ok(_)) => {
                    tracing::debug!("Service stopped gracefully");
                }
                Ok(Err(e)) => {
                    tracing::warn!("Service task panicked during shutdown: {}", e);
                }
                Err(_) => {
                    tracing::warn!(
                        "Service shutdown timed out after {:?}, forcing abort",
                        SHUTDOWN_TIMEOUT
                    );
                }
            }
        }

        // Always attempt cleanup
        service.cleanup().await.map_err(|e| {
            tracing::error!("Service cleanup failed: {}", e);
            miette!("Cleanup failed: {}", e)
        })?;

        Ok(())
    }
}

impl Default for ServiceHandle {
    fn default() -> Self {
        Self::new()
    }
}

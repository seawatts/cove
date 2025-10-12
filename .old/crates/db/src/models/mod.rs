//! Models for the Cove home automation platform
//!
//! This module contains all database model definitions for the Cove platform.

mod automation;
mod device;
mod log;
mod room;
mod user;

pub use automation::{Automation, AutomationAction, AutomationTrigger};
pub use device::{Device, DeviceCapability, DeviceType};
pub use log::{Log, LogLevel, LogType};
pub use room::Room;
pub use user::{User, UserRole};

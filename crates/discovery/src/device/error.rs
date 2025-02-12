use miette::Diagnostic;
use thiserror::Error;

#[derive(Error, Diagnostic, Debug, Clone)]
pub enum DeviceError {
    #[error("Device {id} not found")]
    #[diagnostic(
        code(cove::device::not_found),
        help("Check if the device is still connected")
    )]
    NotFound { id: String },

    #[error("Device {id} not responding")]
    #[diagnostic(code(cove::device::not_responding), help("Check device connectivity"))]
    NotResponding {
        id: String,
        #[source_code]
        last_status: String,
    },
}

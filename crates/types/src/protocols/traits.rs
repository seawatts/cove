pub trait ProtocolClient: std::any::Any {
    fn as_any(&self) -> &dyn std::any::Any;
    fn authenticate(&self) -> Result<(), Error>;
    fn listen(&self) -> Result<(), Error>;
    fn request(&self, message: &str) -> Result<(), Error>;
}

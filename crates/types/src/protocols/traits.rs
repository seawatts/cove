use miette::Result;

pub trait ProtocolClient: std::any::Any {
    fn as_any(&self) -> &dyn std::any::Any;
    fn authenticate(&self) -> Result<()>;
    fn listen(&self) -> Result<()>;
    fn request(&self, message: &str) -> Result<()>;
}

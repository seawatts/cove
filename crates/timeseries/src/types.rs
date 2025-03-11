use crate::TsError;

// Define our own ColumnType enum since it's not available in questdb
#[derive(Debug, Clone, Copy)]
pub enum ColumnType {
    Bool,
    Long,
    Int,
    Short,
    Byte,
    Float,
    Double,
    String,
    Symbol,
    Timestamp,
}

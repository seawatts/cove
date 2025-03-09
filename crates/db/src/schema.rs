use crate::connection::get_conn;
use crate::error::DbResult;

/// Column types supported by the library
#[derive(Debug, Clone)]
pub enum ColumnType {
    Text,
    Integer,
    Real,
    Boolean,
    Blob,
}

impl ColumnType {
    pub fn to_sql_type(&self) -> &'static str {
        match self {
            ColumnType::Text => "TEXT",
            ColumnType::Integer => "INTEGER",
            ColumnType::Real => "REAL",
            ColumnType::Boolean => "INTEGER",
            ColumnType::Blob => "BLOB",
        }
    }
}

/// Column definition for a table
#[derive(Debug, Clone)]
pub struct Column {
    pub name: String,
    pub typ: ColumnType,
    pub primary_key: bool,
    pub not_null: bool,
    pub unique: bool,
    pub default_value: Option<String>,
}

/// Table definition
#[derive(Debug, Clone)]
pub struct Table {
    pub name: String,
    pub columns: Vec<Column>,
}

impl Table {
    pub fn new(name: &str) -> Self {
        Table {
            name: name.to_string(),
            columns: Vec::new(),
        }
    }

    pub fn add_column(mut self, column: Column) -> Self {
        self.columns.push(column);
        self
    }

    pub fn create(&self) -> DbResult<()> {
        let conn = get_conn()?;

        let mut sql = format!("CREATE TABLE IF NOT EXISTS {} (", self.name);

        let columns: Vec<String> = self
            .columns
            .iter()
            .map(|col| {
                let mut column_def = format!("{} {}", col.name, col.typ.to_sql_type());

                if col.primary_key {
                    column_def.push_str(" PRIMARY KEY");
                }

                if col.not_null {
                    column_def.push_str(" NOT NULL");
                }

                if col.unique {
                    column_def.push_str(" UNIQUE");
                }

                if let Some(default) = &col.default_value {
                    column_def.push_str(&format!(" DEFAULT {}", default));
                }

                column_def
            })
            .collect();

        sql.push_str(&columns.join(", "));
        sql.push_str(")");

        conn.execute(&sql, [])?;

        Ok(())
    }
}

/// Helper to create a column definition
pub fn column(name: &str, typ: ColumnType) -> Column {
    Column {
        name: name.to_string(),
        typ,
        primary_key: false,
        not_null: false,
        unique: false,
        default_value: None,
    }
}

// Column builder extensions
pub trait ColumnExt {
    fn primary_key(self) -> Self;
    fn not_null(self) -> Self;
    fn unique(self) -> Self;
    fn default_value(self, value: &str) -> Self;
}

impl ColumnExt for Column {
    fn primary_key(mut self) -> Self {
        self.primary_key = true;
        self
    }

    fn not_null(mut self) -> Self {
        self.not_null = true;
        self
    }

    fn unique(mut self) -> Self {
        self.unique = true;
        self
    }

    fn default_value(mut self, value: &str) -> Self {
        self.default_value = Some(value.to_string());
        self
    }
}

/// Helper method to create a JSON-backed table
pub fn create_json_table(name: &str) -> DbResult<()> {
    let table = Table::new(name)
        .add_column(column("id", ColumnType::Text).primary_key())
        .add_column(column("data", ColumnType::Text).not_null());

    table.create()
}

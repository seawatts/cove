use rusqlite::params;
use serde::Serialize;

use crate::connection::get_conn;
use crate::error::{DbError, DbResult};

/// Query builder for updating data
pub struct Update<'a, T: Serialize> {
    pub table: &'a str,
    pub item: T,
    pub id_column: &'a str,
    pub id_value: String,
}

impl<'a, T: Serialize> Update<'a, T> {
    pub fn new(table: &'a str, item: T, id_column: &'a str, id_value: &str) -> Self {
        Update {
            table,
            item,
            id_column,
            id_value: id_value.to_string(),
        }
    }

    pub fn execute(self) -> DbResult<()> {
        let conn = get_conn()?;

        let json = serde_json::to_string(&self.item).map_err(|e| DbError::Serialization(e))?;

        conn.execute(
            &format!(
                "UPDATE {} SET data = ? WHERE {} = ?",
                self.table, self.id_column
            ),
            params![json, self.id_value],
        )?;

        Ok(())
    }
}

use rusqlite::params;
use serde::Serialize;

use crate::connection::get_conn;
use crate::error::{DbError, DbResult};

/// Query builder for inserting data
pub struct Insert<'a, T: Serialize> {
    pub table: &'a str,
    pub item: T,
}

impl<'a, T: Serialize> Insert<'a, T> {
    pub fn new(table: &'a str, item: T) -> Self {
        Insert { table, item }
    }

    pub fn execute(self) -> DbResult<()> {
        let conn = get_conn()?;

        let json = serde_json::to_string(&self.item).map_err(|e| DbError::Serialization(e))?;

        conn.execute(
            &format!("INSERT INTO {} (id, data) VALUES (?, ?)", self.table),
            params![self.get_id_from_item()?, json],
        )?;

        Ok(())
    }

    fn get_id_from_item(&self) -> DbResult<String> {
        let value = serde_json::to_value(&self.item).map_err(|e| DbError::Serialization(e))?;

        match value.get("id") {
            Some(id) => {
                let id_str = id
                    .as_str()
                    .ok_or_else(|| DbError::FieldNotFound("id".to_string()))?;
                Ok(id_str.to_string())
            }
            None => Err(DbError::FieldNotFound("id".to_string())),
        }
    }
}

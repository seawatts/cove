use rusqlite::params_from_iter;

use crate::connection::get_conn;
use crate::error::DbResult;

/// Query builder for deleting data
pub struct Delete<'a> {
    pub table: &'a str,
    pub where_clauses: Vec<String>,
    pub params: Vec<String>,
}

impl<'a> Delete<'a> {
    pub fn new(table: &'a str) -> Self {
        Delete {
            table,
            where_clauses: Vec::new(),
            params: Vec::new(),
        }
    }

    pub fn where_eq(mut self, column: &str, value: &str) -> Self {
        self.where_clauses.push(format!("{} = ?", column));
        self.params.push(value.to_string());
        self
    }

    pub fn execute(self) -> DbResult<usize> {
        let conn = get_conn()?;

        let mut sql = format!("DELETE FROM {}", self.table);

        if !self.where_clauses.is_empty() {
            sql.push_str(" WHERE ");
            sql.push_str(&self.where_clauses.join(" AND "));
        }

        let param_refs: Vec<&str> = self.params.iter().map(|p| p.as_str()).collect();
        let params = params_from_iter(param_refs.iter());

        let rows_affected = conn.execute(&sql, params)?;

        Ok(rows_affected)
    }
}

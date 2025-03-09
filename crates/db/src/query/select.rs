use rusqlite::params_from_iter;
use serde::de::DeserializeOwned;
use std::marker::PhantomData;

use crate::connection::get_conn;
use crate::error::{DbError, DbResult};

/// Query builder for selecting data
pub struct Select<T> {
    pub table: String,
    pub columns: Vec<String>,
    pub where_clauses: Vec<String>,
    pub params: Vec<String>,
    pub limit: Option<usize>,
    pub offset: Option<usize>,
    pub _phantom: PhantomData<T>,
}

impl<T: DeserializeOwned> Select<T> {
    pub fn new(table: &str) -> Self {
        Select {
            table: table.to_string(),
            columns: vec!["*".to_string()],
            where_clauses: Vec::new(),
            params: Vec::new(),
            limit: None,
            offset: None,
            _phantom: PhantomData,
        }
    }

    pub fn columns(mut self, columns: &[&str]) -> Self {
        self.columns = columns.iter().map(|c| c.to_string()).collect();
        self
    }

    pub fn where_eq(mut self, column: &str, value: &str) -> Self {
        self.where_clauses.push(format!("{} = ?", column));
        self.params.push(value.to_string());
        self
    }

    pub fn where_like(mut self, column: &str, pattern: &str) -> Self {
        self.where_clauses.push(format!("{} LIKE ?", column));
        self.params.push(pattern.to_string());
        self
    }

    pub fn limit(mut self, limit: usize) -> Self {
        self.limit = Some(limit);
        self
    }

    pub fn offset(mut self, offset: usize) -> Self {
        self.offset = Some(offset);
        self
    }

    pub fn execute(self) -> DbResult<Vec<T>> {
        let conn = get_conn()?;

        let mut sql = format!("SELECT {} FROM {}", self.columns.join(", "), self.table);

        if !self.where_clauses.is_empty() {
            sql.push_str(" WHERE ");
            sql.push_str(&self.where_clauses.join(" AND "));
        }

        if let Some(limit) = self.limit {
            sql.push_str(&format!(" LIMIT {}", limit));
        }

        if let Some(offset) = self.offset {
            sql.push_str(&format!(" OFFSET {}", offset));
        }

        let param_refs: Vec<&str> = self.params.iter().map(|p| p.as_str()).collect();
        let params = params_from_iter(param_refs.iter());

        let mut stmt = conn.prepare(&sql)?;
        let rows = stmt.query_map(params, |row| {
            let json: String = row.get(0)?;
            let item = serde_json::from_str(&json).map_err(|e| {
                rusqlite::Error::FromSqlConversionFailure(
                    0,
                    rusqlite::types::Type::Text,
                    Box::new(e),
                )
            })?;
            Ok(item)
        })?;

        let mut results = Vec::new();
        for row in rows {
            results.push(row?);
        }

        Ok(results)
    }

    pub fn first(self) -> DbResult<Option<T>> {
        let mut results = self.limit(1).execute()?;
        Ok(results.pop())
    }
}

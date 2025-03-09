use cuid2::create_id;
use serde::{de::DeserializeOwned, Serialize};

use crate::error::DbResult;
use crate::query::{Delete, Insert, Select, Update};

/// Model trait for entities
pub trait Model: Serialize + DeserializeOwned {
    fn table_name() -> &'static str;
    fn id(&self) -> String;
    fn set_id(&mut self, id: String);
}

/// Basic CRUD operations for models
pub struct Db;

impl Db {
    pub fn create<T: Model>(mut item: T) -> DbResult<T> {
        let id = create_id();
        item.set_id(id);

        Insert::new(T::table_name(), &item).execute()?;

        Ok(item)
    }

    pub fn find<T: Model>(id: &str) -> DbResult<Option<T>> {
        Select::<T>::new(T::table_name()).where_eq("id", id).first()
    }

    pub fn all<T: Model>() -> DbResult<Vec<T>> {
        Select::<T>::new(T::table_name()).execute()
    }

    pub fn update<T: Model>(item: T) -> DbResult<T> {
        let id = item.id();
        Update::new(T::table_name(), &item, "id", &id).execute()?;

        Ok(item)
    }

    pub fn delete<T: Model>(id: &str) -> DbResult<usize> {
        Delete::new(T::table_name()).where_eq("id", id).execute()
    }
}

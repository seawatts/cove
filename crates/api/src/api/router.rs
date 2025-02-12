use std::{marker::PhantomData, time::Instant};

use crate::device::DeviceRegistry;
use rspc::{
    middleware::Middleware, Procedure, ProcedureBuilder, ResolverInput, ResolverOutput, Router,
};
use serde::{Deserialize, Serialize};
use specta::Type;
use std::sync::Arc;
use thiserror::Error;

#[derive(Clone, Serialize, Deserialize, Type)]
pub struct MySession {
    name: String,
}

// `Clone` is only required for usage with Websockets
#[derive(Clone)]
pub struct Ctx {
    pub registry: Arc<DeviceRegistry>,
}

#[derive(Serialize, Type)]
pub struct MyCustomType(String);

#[derive(Debug, Serialize, Type, Error)]
#[serde(tag = "type", content = "error")]
pub enum Error {
    // #[error("you made a mistake: {0}")]
    // Mistake(String),
}

impl rspc::Error for Error {
    fn into_procedure_error(self) -> rspc::ProcedureError {
        rspc::ResolverError::new(self, None::<std::io::Error>).into()
    }
}

pub struct BaseProcedure<TErr = Error>(PhantomData<TErr>);
impl<TErr> BaseProcedure<TErr> {
    pub fn builder<TInput, TResult>(
    ) -> ProcedureBuilder<TErr, Ctx, Ctx, TInput, TInput, TResult, TResult>
    where
        TErr: rspc::Error + Send + 'static,
        TInput: ResolverInput,
        TResult: ResolverOutput<TErr> + Send + Sync + 'static,
    {
        Procedure::builder().with(timing_middleware())
    }
}

pub fn new() -> Router<Ctx> {
    Router::new()
        .procedure("sendMsg", {
            <BaseProcedure>::builder().query(|_, msg: String| async move {
                println!("Got message from frontend: {msg}");
                Ok(msg)
            })
        })
        .procedure("version", {
            <BaseProcedure>::builder().query(|_, _: ()| async move { Ok("1.0.0") })
        })
        .procedure("devices", {
            <BaseProcedure>::builder().query(|ctx, _: ()| async move {
                let devices = ctx.registry.get_all_devices().await;
                Ok(devices)
            })
        })
}

pub fn timing_middleware<TError, TCtx, TInput, TResult>(
) -> Middleware<TError, TCtx, TInput, TResult, TCtx, TInput, TResult>
where
    TError: Send + 'static,
    TCtx: Send + 'static,
    TInput: Send + 'static,
    TResult: Send + Sync + 'static,
{
    Middleware::new(move |ctx: TCtx, input: TInput, next| async move {
        let instant = Instant::now();
        let result = next.exec(ctx, input).await?;
        tracing::info!("Request took: {:?}", instant.elapsed());
        Ok(result)
    })
}

#[cfg(test)]
mod tests {
    // It is highly recommended to unit test your rspc router by creating it
    // This will ensure it doesn't have any issues and also export updated Typescript types.

    use std::path::PathBuf;

    #[test]
    fn test_rspc_router() {
        let router = super::new().build();

        // let ts = rspc::Typescript::default();
        // ts.export_to(
        //     PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("./bindings.ts"),
        //     &router.unwrap(),
        // )
        // .unwrap();
        // let (_, _) = router.unwrap();
        // router
        //     .export_ts(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("./bindings.ts"))
        //     .unwrap();
    }
}

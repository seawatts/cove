use miette::{set_hook, GraphicalReportHandler, IntoDiagnostic, Result};
use tracing_error::ErrorLayer;
use tracing_subscriber::{
    filter::LevelFilter, layer::SubscriberExt, util::SubscriberInitExt, Layer, Registry,
};

pub fn setup_tracing() -> Result<()> {
    // Create a default subscriber with ErrorLayer
    let subscriber = Registry::default().with(ErrorLayer::default());

    // Console logging layer with pretty formatting and colors
    let fmt_layer = tracing_subscriber::fmt::layer()
        .with_thread_ids(true)
        .with_thread_names(true)
        .with_target(true)
        .with_file(true)
        .with_line_number(true)
        .with_level(true)
        .with_ansi(true)
        .pretty()
        .with_filter(LevelFilter::INFO);

    // File logging layer for debugging (no colors or pretty printing)
    let file_appender = tracing_appender::rolling::RollingFileAppender::new(
        tracing_appender::rolling::Rotation::DAILY,
        "logs",
        "app.log",
    );

    let file_layer = tracing_subscriber::fmt::layer()
        .with_thread_ids(true)
        .with_thread_names(true)
        .with_target(true)
        .with_file(true)
        .with_line_number(true)
        .with_writer(file_appender)
        .with_ansi(false)
        .with_filter(LevelFilter::DEBUG);

    // Initialize the subscriber with all layers
    subscriber
        .with(fmt_layer)
        .with(file_layer)
        .try_init()
        .into_diagnostic()?;

    Ok(())
}

pub fn setup_miette() -> Result<()> {
    set_hook(Box::new(|_| {
        Box::new(
            GraphicalReportHandler::new()
                .with_cause_chain()
                .with_context_lines(4)
                .with_links(true)
                .with_urls(true),
        )
    }))?;
    Ok(())
}

use std::io::Result;
use std::path::Path;

// Add tonic_build for protobuf and gRPC code generation
use tonic_build;

fn main() -> Result<()> {
    // Make sure to rerun if proto files change

    let base_path = "src/protos/";
    let api_proto = Path::new(base_path).join("api.proto");
    let api_options_proto = Path::new(base_path).join("api_options.proto");

    // Use tonic_build to generate the output files
    tonic_build::configure()
        .out_dir(std::env::var("OUT_DIR").unwrap())
        .build_server(false)
        .build_client(false)
        .emit_rerun_if_changed(false)
        .protoc_arg("--experimental_allow_proto3_optional")
        .compile_protos(
            &[
                api_options_proto.to_str().unwrap(),
                api_proto.to_str().unwrap(),
            ],
            &[base_path],
        )
        .map_err(|e| {
            std::io::Error::new(
                std::io::ErrorKind::Other,
                format!("Failed to compile protobufs: {}", e),
            )
        })?;

    Ok(())
}

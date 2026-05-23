FROM rust:slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    libsasl2-dev \
    libcurl4-openssl-dev \
    cmake \
    build-essential \
    && rm -rf /var/lib/apt/lists/*



# Copy the rust engine files
COPY rust-engine/Cargo.toml /app/
COPY rust-engine/src /app/src/

# Build the release binary
RUN cargo build --release

# Stage 2: Minimal Runtime Environment
FROM ubuntu:24.04

WORKDIR /app

# Install runtime dependencies for openssl and rdkafka
RUN apt-get update && apt-get install -y libssl3 libsasl2-2 ca-certificates && rm -rf /var/lib/apt/lists/*

# Copy the compiled binary from the builder stage
COPY --from=builder /app/target/release/rust-engine /app/rust-engine

# Copy the ONNX model from the training folder into the image
COPY training/models/isolation_forest.onnx /app/models/isolation_forest.onnx

# Set the environment variable so the engine knows where to find the model
ENV ONNX_MODEL_PATH=/app/models/isolation_forest.onnx

# Metrics endpoint
EXPOSE 9090

CMD ["/app/rust-engine"]

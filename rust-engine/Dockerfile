# ── Stage 1: Builder ─────────────────────────────────────────────────────────
# ubuntu:24.04 ships glibc 2.38, required by the ort crate's pre-built
# ONNX Runtime binaries. rust:slim (Debian bookworm) only has glibc 2.36.
FROM ubuntu:24.04 AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y \
    curl \
    pkg-config \
    libssl-dev \
    libsasl2-dev \
    libcurl4-openssl-dev \
    cmake \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy source and model before building so they are all in one layer
COPY rust-engine/Cargo.toml /app/Cargo.toml
COPY rust-engine/Cargo.lock /app/Cargo.lock
COPY rust-engine/src        /app/src/
COPY training/models/isolation_forest.onnx /app/models/isolation_forest.onnx

# Install rustup and build in a single RUN so that sourcing .cargo/env
# makes cargo visible to the subsequent build command.
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \
        | sh -s -- -y --default-toolchain stable \
    && . "$HOME/.cargo/env" \
    && cargo build --release

# ── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM ubuntu:24.04

WORKDIR /app

RUN apt-get update && apt-get install -y \
    libssl3 \
    libsasl2-2 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/rust-engine /app/rust-engine
COPY --from=builder /app/models                     /app/models

ENV ONNX_MODEL_PATH=/app/models/isolation_forest.onnx

EXPOSE 9090

CMD ["/app/rust-engine"]

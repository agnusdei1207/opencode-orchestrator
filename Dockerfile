# Build stage
FROM rust:1.98.1-bookworm AS builder

WORKDIR /app
COPY Cargo.toml Cargo.lock* ./
COPY crates ./crates

RUN cargo build --release

# Runtime stage
FROM debian:bookworm-slim

COPY --from=builder /app/target/release/orchestrator /usr/local/bin/

ENTRYPOINT ["orchestrator"]

# Build stage
FROM rust:1.92-bookworm AS builder

WORKDIR /app
COPY Cargo.toml Cargo.lock* ./
COPY crates ./crates

RUN cargo build --release

# Runtime stage
FROM debian:bookworm-slim

COPY --from=builder /app/target/release/orchestrator-mcp /usr/local/bin/

ENTRYPOINT ["orchestrator-mcp"]

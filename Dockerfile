# Build stage
FROM rust:1.98.1-bookworm AS builder

WORKDIR /app
COPY Cargo.toml Cargo.lock* ./
COPY crates ./crates

RUN cargo build --release --locked

# Runtime stage
FROM debian:bookworm-slim

# The tool server needs no privileges; run it as an unprivileged system user.
RUN useradd --system --uid 10001 --no-create-home orchestrator

COPY --from=builder /app/target/release/orchestrator /usr/local/bin/

USER orchestrator
ENTRYPOINT ["orchestrator"]

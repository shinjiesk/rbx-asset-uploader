#!/usr/bin/env bash
# Debug run: build with backtrace, run app, capture all output
# Use when verify fails and you need to inspect the panic

set -e
cd "$(dirname "$0")/.."

echo "==> Building (debug)..."
RUST_BACKTRACE=1 cargo build --manifest-path src-tauri/Cargo.toml

echo "==> Running (output to .debug.log)..."
RUST_BACKTRACE=1 ./src-tauri/target/debug/rbx-asset-uploader 2>&1 | tee .debug.log

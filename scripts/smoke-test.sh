#!/usr/bin/env bash
# Smoke test: build, start app, verify HTTP server responds
# Run with RUST_BACKTRACE=1 for panic backtraces

set -e
cd "$(dirname "$0")/.."
ROOT=$(pwd)
LOG="${ROOT}/.verify.log"

echo "==> Building..."
cargo build --manifest-path src-tauri/Cargo.toml

echo "==> Starting app (background)..."
./src-tauri/target/debug/rbx-asset-uploader >> "$LOG" 2>&1 &
APP_PID=$!

cleanup() {
  kill $APP_PID 2>/dev/null || true
  wait $APP_PID 2>/dev/null || true
}
trap cleanup EXIT

echo "==> Waiting for HTTP server on :58750..."
for i in $(seq 1 30); do
  if curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:58750/api/health 2>/dev/null | grep -q 200; then
    echo "OK: App started, health check passed"
    exit 0
  fi
  sleep 1
done

echo "FAIL: Health check timed out"
echo "Last 30 lines of .verify.log:"
tail -30 "$LOG"
exit 1

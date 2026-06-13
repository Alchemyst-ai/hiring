#!/usr/bin/env bash
# Close competing WebSocket clients on agent-server port 4747.
# The agent-server accepts only ONE client at a time.
set -euo pipefail

PORT="${1:-4747}"

echo "Checking port ${PORT}..."

# Kill non-server processes connected to the port (keep the LISTEN pid)
PIDS=$(lsof -ti :"${PORT}" 2>/dev/null || true)
if [ -z "${PIDS}" ]; then
  echo "Port ${PORT} is free."
  exit 0
fi

LISTEN_PID=$(lsof -ti :"${PORT}" -sTCP:LISTEN 2>/dev/null || true)

for pid in ${PIDS}; do
  if [ -n "${LISTEN_PID}" ] && [ "${pid}" = "${LISTEN_PID}" ]; then
    continue
  fi
  NAME=$(ps -p "${pid}" -o comm= 2>/dev/null || echo "unknown")
  echo "Killing client pid ${pid} (${NAME})"
  kill -9 "${pid}" 2>/dev/null || true
done

sleep 1
curl -s "http://localhost:${PORT}/reset" >/dev/null 2>&1 || true
echo "Done. Only the server listener should remain on :${PORT}."

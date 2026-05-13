#!/usr/bin/env bash
set -euo pipefail

docker build -t mcp-flights:local .
docker run --rm \
  -p 8000:8000 \
  -e SERPAPI_API_KEY \
  -e MCP_HOST=0.0.0.0 \
  -e MCP_PORT=8000 \
  -e MCP_PATH=/mcp \
  mcp-flights:local

# mcp-flights

A FastMCP server that exposes SerpAPI's Google Flights search as an MCP tool over streamable HTTP.

## Features

- `search_google_flights` MCP tool backed by SerpAPI's `engine=google_flights`
- `health_check` MCP tool for readiness checks
- SerpAPI key loaded from `SERPAPI_API_KEY`
- Local runtime via Python 3.11 virtual environment
- Container runtime via a non-root, multi-stage Docker image
- Streamable HTTP transport for local MCP clients

## Requirements

### Local Python runtime

- Python 3.11+
- `uv` (recommended)

### Docker runtime

- Docker CLI / Docker Desktop

## Environment variables

Copy `.env.example` to `.env` and set your real key:

```bash
cp .env.example .env
```

Required:

- `SERPAPI_API_KEY` — your SerpAPI key

Optional:

- `MCP_HOST` — bind host, default `127.0.0.1`
- `MCP_PORT` — bind port, default `8000`
- `MCP_PATH` — MCP HTTP path, default `/mcp`
- `MCP_STATELESS_HTTP` — `true` or `false`, default `false`

## Local run with uv / venv

```bash
cd /Users/miqui/development/mcp-flights
uv venv --python 3.11 .venv
source .venv/bin/activate
uv pip install -e '.[dev]'
export SERPAPI_API_KEY='your-real-key'
python run_server.py
```

Or use the helper script:

```bash
cd /Users/miqui/development/mcp-flights
export SERPAPI_API_KEY='your-real-key'
bash scripts/run-local.sh
```

The server will listen on:

- base URL: `http://127.0.0.1:8000`
- MCP endpoint: `http://127.0.0.1:8000/mcp`

## Run with Docker

```bash
cd /Users/miqui/development/mcp-flights
export SERPAPI_API_KEY='your-real-key'
bash scripts/run-docker.sh
```

Equivalent manual commands:

```bash
docker build -t mcp-flights:local .
docker run --rm \
  -p 8000:8000 \
  -e SERPAPI_API_KEY \
  -e MCP_HOST=0.0.0.0 \
  -e MCP_PORT=8000 \
  -e MCP_PATH=/mcp \
  mcp-flights:local
```

## Example SerpAPI-backed query

The MCP tool maps onto the same underlying search parameters as your original curl:

- `departure_id=PEK`
- `arrival_id=AUS`
- `outbound_date=2026-05-14`
- `return_date=2026-05-20`
- `currency=USD`
- `hl=en`

## Hermes / MCP client configuration example

If you want Hermes to consume this local MCP server over HTTP, add something like this to `~/.hermes/config.yaml`:

```yaml
mcp_servers:
  flights:
    url: "http://127.0.0.1:8000/mcp"
    timeout: 120
    connect_timeout: 30
```

Then restart Hermes.

## Tests

```bash
cd /Users/miqui/development/mcp-flights
source .venv/bin/activate
uv pip install -e '.[dev]'
pytest
```

## Notes

- Docker is not currently installed on this host, so the Docker path is scaffolded but not build-tested here.
- The repository intentionally does not hardcode the SerpAPI key.
- `raw` in the tool response includes the full SerpAPI payload for advanced client-side handling.

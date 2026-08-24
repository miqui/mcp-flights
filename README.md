# mcp-flights

A FastMCP server that exposes SerpAPI's Google Flights search as an MCP tool over streamable HTTP.

## Features

- `search_google_flights` MCP tool backed by SerpAPI's `engine=google_flights`
- `health_check` MCP tool for readiness checks
- SerpAPI key loaded from `SERPAPI_API_KEY`
- Expanded Google Flights filters including stops, bags, airline include/exclude, time windows, layover duration, price ceiling, and sorting
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
- `SERPAPI_TIMEOUT_SECONDS` — optional upstream HTTP timeout if you choose to add it to the client later

## Supported tool parameters

Core fields:

- `departure_id`
- `arrival_id`
- `outbound_date`
- `return_date`
- `currency`
- `hl`
- `adults`
- `children`
- `infants_in_seat`
- `infants_on_lap`
- `travel_class`
- `type`

Advanced filters:

- `stops` — `0` any, `1` nonstop, `2` one stop or fewer, `3` two stops or fewer
- `bags` — checked bag count
- `max_price` — maximum price filter
- `sort_by` — `1` top, `2` price, `3` departure, `4` arrival, `5` duration, `6` emissions
- `outbound_times` — strings like `4,18` or `4,18,3,19`
- `return_times` — same format as `outbound_times`
- `include_airlines` — comma-separated airline IATA codes
- `exclude_airlines` — comma-separated airline IATA codes
- `layover_duration` — string like `60,240`
- `exclude_basic` — exclude basic fares where supported
- `deep_search` — enable deeper but slower search

Validation rules:

- `include_airlines` and `exclude_airlines` cannot be used together
- `type=1` (round trip) requires `return_date`
- `type=2` (one way) must omit `return_date`
- `return_times` requires `return_date`

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

## Example SerpAPI-backed query mapping

The MCP tool maps onto the same underlying search parameters as your original curl, plus optional filters such as:

- `stops=1`
- `sort_by=2`
- `max_price=900`
- `include_airlines=AA,UA`
- `outbound_times=4,18`

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

## Docker hardening notes

- multi-stage build
- non-root runtime user with fixed UID/GID
- slim runtime image
- no pip cache retained in layers
- minimal runtime packages only

## Notes

- Docker is not currently installed on this host, so the Docker path is scaffolded but not build-tested here.
- The repository intentionally does not hardcode the SerpAPI key.
- `raw` in the tool response includes the full SerpAPI payload for advanced client-side handling.

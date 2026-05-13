from __future__ import annotations

import os
from functools import lru_cache
from typing import Any

from dotenv import load_dotenv
from fastmcp import FastMCP
from pydantic import BaseModel

from mcp_flights.models import FlightSearchRequest, FlightSearchResult
from mcp_flights.serpapi import SerpApiClient

load_dotenv()


class HealthResponse(BaseModel):
    status: str
    service: str


@lru_cache(maxsize=1)
def get_client() -> SerpApiClient:
    return SerpApiClient()


mcp = FastMCP(
    name="mcp-flights",
    instructions=(
        "Use this server to search flights through SerpAPI's Google Flights engine. "
        "Provide airport IATA codes and ISO dates."
    ),
)


@mcp.tool(
    name="search_google_flights",
    description="Search Google Flights via SerpAPI using IATA airport codes and ISO dates.",
)
async def search_google_flights(request: FlightSearchRequest) -> FlightSearchResult:
    params: dict[str, Any] = request.model_dump(exclude_none=True)
    params["deep_search"] = str(params["deep_search"]).lower()

    payload = await get_client().search_google_flights(params)
    return FlightSearchResult(
        search_metadata=payload.get("search_metadata", {}),
        search_parameters=payload.get("search_parameters", {}),
        best_flights=payload.get("best_flights", []),
        other_flights=payload.get("other_flights", []),
        price_insights=payload.get("price_insights", {}),
        airports=payload.get("airports", []),
        raw=payload,
    )


@mcp.tool(name="health_check", description="Return a simple readiness payload for the MCP server.")
def health_check() -> HealthResponse:
    return HealthResponse(status="ok", service="mcp-flights")


def main() -> None:
    host = os.getenv("MCP_HOST", "127.0.0.1")
    port = int(os.getenv("MCP_PORT", "8000"))
    path = os.getenv("MCP_PATH", "/mcp")
    stateless_http = os.getenv("MCP_STATELESS_HTTP", "false").lower() == "true"

    mcp.run(
        transport="streamable-http",
        host=host,
        port=port,
        path=path,
        stateless_http=stateless_http,
    )


if __name__ == "__main__":
    main()

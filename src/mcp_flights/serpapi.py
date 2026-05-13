from __future__ import annotations

import os
from typing import Any

import httpx

SERPAPI_URL = "https://serpapi.com/search"
SERPAPI_ENGINE = "google_flights"
SERPAPI_API_KEY_ENV = "SERPAPI_API_KEY"


class SerpApiError(RuntimeError):
    """Raised when SerpAPI returns an error or an invalid response."""


class SerpApiClient:
    def __init__(self, api_key: str | None = None, timeout: float = 30.0) -> None:
        self.api_key = api_key or os.getenv(SERPAPI_API_KEY_ENV)
        if not self.api_key:
            raise SerpApiError(
                f"Missing required environment variable: {SERPAPI_API_KEY_ENV}"
            )
        self.timeout = timeout

    async def search_google_flights(self, params: dict[str, Any]) -> dict[str, Any]:
        query = {
            "engine": SERPAPI_ENGINE,
            **params,
            "api_key": self.api_key,
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.get(SERPAPI_URL, params=query)

        try:
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise SerpApiError(
                f"SerpAPI request failed with status {exc.response.status_code}: {exc.response.text}"
            ) from exc

        payload = response.json()

        if "error" in payload:
            raise SerpApiError(f"SerpAPI error: {payload['error']}")

        return payload

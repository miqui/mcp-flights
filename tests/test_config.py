from __future__ import annotations

import os

from mcp_flights.models import FlightSearchRequest
from mcp_flights.serpapi import SERPAPI_API_KEY_ENV, SerpApiClient, SerpApiError


def test_request_model_normalizes_codes() -> None:
    request = FlightSearchRequest(
        departure_id="pek",
        arrival_id="aus",
        outbound_date="2026-05-14",
        return_date="2026-05-20",
        currency="usd",
        hl="en",
    )

    assert request.departure_id == "PEK"
    assert request.arrival_id == "AUS"
    assert request.currency == "USD"


def test_client_requires_api_key(monkeypatch) -> None:
    monkeypatch.delenv(SERPAPI_API_KEY_ENV, raising=False)

    try:
        SerpApiClient(api_key=None)
    except SerpApiError as exc:
        assert SERPAPI_API_KEY_ENV in str(exc)
    else:
        raise AssertionError("Expected SerpApiError when API key is missing")


def test_client_uses_explicit_api_key(monkeypatch) -> None:
    monkeypatch.delenv(SERPAPI_API_KEY_ENV, raising=False)
    client = SerpApiClient(api_key="test-key")
    assert client.api_key == "test-key"

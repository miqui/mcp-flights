from __future__ import annotations

from pydantic import ValidationError

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


def test_request_model_normalizes_airlines() -> None:
    request = FlightSearchRequest(
        departure_id="pek",
        arrival_id="aus",
        outbound_date="2026-05-14",
        return_date="2026-05-20",
        include_airlines=" ua, aa ",
    )

    assert request.include_airlines == "UA,AA"


def test_request_model_rejects_conflicting_airline_filters() -> None:
    try:
        FlightSearchRequest(
            departure_id="PEK",
            arrival_id="AUS",
            outbound_date="2026-05-14",
            return_date="2026-05-20",
            include_airlines="UA",
            exclude_airlines="AA",
        )
    except ValidationError as exc:
        assert "cannot be used together" in str(exc)
    else:
        raise AssertionError("Expected ValidationError for conflicting airline filters")


def test_request_model_rejects_round_trip_without_return_date() -> None:
    try:
        FlightSearchRequest(
            departure_id="PEK",
            arrival_id="AUS",
            outbound_date="2026-05-14",
            type=1,
        )
    except ValidationError as exc:
        assert "return_date is required" in str(exc)
    else:
        raise AssertionError("Expected ValidationError for missing round-trip return_date")


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

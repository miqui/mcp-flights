from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field, field_validator


class FlightSearchRequest(BaseModel):
    departure_id: str = Field(..., description="IATA departure airport code, e.g. PEK")
    arrival_id: str = Field(..., description="IATA arrival airport code, e.g. AUS")
    outbound_date: str = Field(..., description="Outbound date in YYYY-MM-DD format")
    return_date: str | None = Field(default=None, description="Return date in YYYY-MM-DD format")
    currency: str = Field(default="USD", description="Response currency, e.g. USD")
    hl: str = Field(default="en", description="Language code, e.g. en")
    adults: int = Field(default=1, ge=1, le=9, description="Number of adult travelers")
    children: int = Field(default=0, ge=0, le=8, description="Number of child travelers")
    travel_class: int | None = Field(
        default=None,
        description="Google Flights class code when needed (for example 1=economy)",
    )
    deep_search: bool = Field(
        default=False,
        description="Whether to enable SerpAPI deep_search for more results",
    )

    @field_validator("departure_id", "arrival_id", "currency", "hl")
    @classmethod
    def normalize_upper_or_trim(cls, value: str) -> str:
        return value.strip().upper() if len(value.strip()) <= 4 else value.strip()


class FlightSearchResult(BaseModel):
    search_metadata: dict[str, Any] = Field(default_factory=dict)
    search_parameters: dict[str, Any] = Field(default_factory=dict)
    best_flights: list[dict[str, Any]] = Field(default_factory=list)
    other_flights: list[dict[str, Any]] = Field(default_factory=list)
    price_insights: dict[str, Any] = Field(default_factory=dict)
    airports: list[dict[str, Any]] = Field(default_factory=list)
    raw: dict[str, Any] = Field(default_factory=dict)

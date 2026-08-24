from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field, field_validator, model_validator


class FlightSearchRequest(BaseModel):
    departure_id: str = Field(..., description="IATA departure airport code, e.g. PEK")
    arrival_id: str = Field(..., description="IATA arrival airport code, e.g. AUS")
    outbound_date: str = Field(..., description="Outbound date in YYYY-MM-DD format")
    return_date: str | None = Field(default=None, description="Return date in YYYY-MM-DD format")
    currency: str = Field(default="USD", description="Response currency, e.g. USD")
    hl: str = Field(default="en", description="Language code, e.g. en")
    adults: int = Field(default=1, ge=1, le=9, description="Number of adult travelers")
    children: int = Field(default=0, ge=0, le=8, description="Number of child travelers")
    infants_in_seat: int = Field(default=0, ge=0, le=9, description="Number of infants in seat")
    infants_on_lap: int = Field(default=0, ge=0, le=9, description="Number of infants on lap")
    travel_class: int | None = Field(
        default=None,
        description="Google Flights class code when needed, for example 1=economy",
    )
    type: int = Field(
        default=1,
        ge=1,
        le=3,
        description="Trip type where 1=round trip, 2=one way, 3=multi-city",
    )
    stops: int = Field(
        default=0,
        ge=0,
        le=3,
        description="0=any, 1=nonstop, 2=1 stop or fewer, 3=2 stops or fewer",
    )
    bags: int | None = Field(default=None, ge=0, le=2, description="Number of checked bags")
    max_price: int | None = Field(default=None, ge=1, description="Maximum ticket price filter")
    sort_by: int = Field(
        default=1,
        ge=1,
        le=6,
        description="1=top flights, 2=price, 3=departure, 4=arrival, 5=duration, 6=emissions",
    )
    outbound_times: str | None = Field(
        default=None,
        description="Time filter like '4,18' or '4,18,3,19' for outbound flights",
    )
    return_times: str | None = Field(
        default=None,
        description="Time filter like '4,18' or '4,18,3,19' for return flights",
    )
    include_airlines: str | None = Field(
        default=None,
        description="Comma-separated airline IATA codes to include, e.g. 'AA,UA'",
    )
    exclude_airlines: str | None = Field(
        default=None,
        description="Comma-separated airline IATA codes to exclude, e.g. 'NK,F9'",
    )
    layover_duration: str | None = Field(
        default=None,
        description="Layover duration filter as 'min,max' minutes, e.g. '60,240'",
    )
    exclude_basic: bool = Field(
        default=False,
        description="Exclude basic fares where supported by Google Flights/SerpAPI",
    )
    deep_search: bool = Field(
        default=False,
        description="Enable SerpAPI deep_search for more complete results",
    )

    @field_validator("departure_id", "arrival_id", "currency", "hl")
    @classmethod
    def normalize_upper_or_trim(cls, value: str) -> str:
        return value.strip().upper() if len(value.strip()) <= 4 else value.strip()

    @field_validator("include_airlines", "exclude_airlines")
    @classmethod
    def normalize_airline_list(cls, value: str | None) -> str | None:
        if value is None:
            return None
        airlines = [item.strip().upper() for item in value.split(",") if item.strip()]
        return ",".join(airlines) or None

    @model_validator(mode="after")
    def validate_combinations(self) -> "FlightSearchRequest":
        if self.include_airlines and self.exclude_airlines:
            raise ValueError("include_airlines and exclude_airlines cannot be used together")
        if self.type == 2 and self.return_date is not None:
            raise ValueError("return_date must be omitted for one-way searches (type=2)")
        if self.type == 1 and self.return_date is None:
            raise ValueError("return_date is required for round-trip searches (type=1)")
        if self.return_times and self.return_date is None:
            raise ValueError("return_times requires return_date")
        return self


class FlightSearchResult(BaseModel):
    search_metadata: dict[str, Any] = Field(default_factory=dict)
    search_parameters: dict[str, Any] = Field(default_factory=dict)
    best_flights: list[dict[str, Any]] = Field(default_factory=list)
    other_flights: list[dict[str, Any]] = Field(default_factory=list)
    price_insights: dict[str, Any] = Field(default_factory=dict)
    airports: list[dict[str, Any]] = Field(default_factory=list)
    raw: dict[str, Any] = Field(default_factory=dict)

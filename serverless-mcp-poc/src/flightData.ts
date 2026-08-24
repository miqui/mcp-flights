/**
 * In-memory mock flight dataset and search logic for the Serverless MCP POC.
 *
 * This intentionally does NOT call any external API (no SerpAPI, no AWS).
 * It mirrors the parameter shape and validation rules of the existing
 * mcp-flights Python/FastMCP server (src/mcp_flights/models.py) so the POC
 * demonstrates a realistic, non-trivial tool surface without any real
 * network calls, secrets, or cloud dependencies.
 */

export interface FlightOption {
  id: string;
  airline: string;
  flightNumber: string;
  departureId: string;
  arrivalId: string;
  outboundDate: string;
  returnDate?: string;
  stops: number;
  durationMinutes: number;
  price: number;
  currency: string;
}

export interface FlightSearchInput {
  departureId: string;
  arrivalId: string;
  outboundDate: string;
  returnDate?: string;
  currency?: string;
  adults?: number;
  tripType?: 1 | 2 | 3; // 1=round trip, 2=one way, 3=multi-city
  stops?: 0 | 1 | 2 | 3; // 0=any, 1=nonstop, 2=<=1 stop, 3=<=2 stops
  maxPrice?: number;
  sortBy?: 1 | 2 | 3 | 4 | 5; // 1=top,2=price,3=departure,4=duration,5=stops
  includeAirlines?: string;
  excludeAirlines?: string;
}

export interface FlightSearchResult {
  searchParameters: FlightSearchInput;
  bestFlights: FlightOption[];
  otherFlights: FlightOption[];
  totalResults: number;
}

const IATA_RE = /^[A-Z]{3}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const MOCK_AIRLINES = ['AA', 'UA', 'DL', 'BA', 'LH', 'NK'] as const;

/** Deterministic pseudo-random generator seeded from a string, so results
 * are stable across repeated calls with the same inputs (useful for tests). */
function seededRandom(seed: string): () => number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  let state = h >>> 0 || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

export class ValidationError extends Error {}

export function validateFlightSearchInput(input: FlightSearchInput): void {
  if (!IATA_RE.test(input.departureId)) {
    throw new ValidationError(`departureId must be a 3-letter IATA code, got "${input.departureId}"`);
  }
  if (!IATA_RE.test(input.arrivalId)) {
    throw new ValidationError(`arrivalId must be a 3-letter IATA code, got "${input.arrivalId}"`);
  }
  if (!DATE_RE.test(input.outboundDate)) {
    throw new ValidationError(`outboundDate must be YYYY-MM-DD, got "${input.outboundDate}"`);
  }
  if (input.returnDate !== undefined && !DATE_RE.test(input.returnDate)) {
    throw new ValidationError(`returnDate must be YYYY-MM-DD, got "${input.returnDate}"`);
  }
  if (input.includeAirlines && input.excludeAirlines) {
    throw new ValidationError('includeAirlines and excludeAirlines cannot be used together');
  }
  const tripType = input.tripType ?? 1;
  if (tripType === 2 && input.returnDate !== undefined) {
    throw new ValidationError('returnDate must be omitted for one-way searches (tripType=2)');
  }
  if (tripType === 1 && input.returnDate === undefined) {
    throw new ValidationError('returnDate is required for round-trip searches (tripType=1)');
  }
}

/** Generates a small deterministic set of mock flight options. No network I/O. */
export function searchFlights(input: FlightSearchInput): FlightSearchResult {
  validateFlightSearchInput(input);

  const currency = input.currency ?? 'USD';
  const stopsFilter = input.stops ?? 0;
  const includeSet = input.includeAirlines
    ? new Set(input.includeAirlines.split(',').map((a) => a.trim().toUpperCase()))
    : null;
  const excludeSet = input.excludeAirlines
    ? new Set(input.excludeAirlines.split(',').map((a) => a.trim().toUpperCase()))
    : null;

  const seedKey = `${input.departureId}-${input.arrivalId}-${input.outboundDate}-${input.returnDate ?? ''}`;
  const rand = seededRandom(seedKey);

  const candidates: FlightOption[] = MOCK_AIRLINES.map((airline, idx) => {
    const stops = Math.floor(rand() * 3); // 0, 1, or 2 stops
    const durationMinutes = 90 + Math.floor(rand() * 600) + stops * 45;
    const price = Math.round(150 + rand() * 850);
    return {
      id: `${seedKey}-${airline}-${idx}`,
      airline,
      flightNumber: `${airline}${100 + Math.floor(rand() * 900)}`,
      departureId: input.departureId,
      arrivalId: input.arrivalId,
      outboundDate: input.outboundDate,
      returnDate: input.returnDate,
      stops,
      durationMinutes,
      price,
      currency,
    };
  });

  let filtered = candidates.filter((f) => {
    if (stopsFilter === 1 && f.stops !== 0) return false;
    if (stopsFilter === 2 && f.stops > 1) return false;
    if (stopsFilter === 3 && f.stops > 2) return false;
    if (includeSet && !includeSet.has(f.airline)) return false;
    if (excludeSet && excludeSet.has(f.airline)) return false;
    if (input.maxPrice !== undefined && f.price > input.maxPrice) return false;
    return true;
  });

  const sortBy = input.sortBy ?? 1;
  filtered = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case 2:
        return a.price - b.price;
      case 3:
        return a.durationMinutes - b.durationMinutes; // proxy for departure ordering in this mock
      case 4:
        return a.durationMinutes - b.durationMinutes;
      case 5:
        return a.stops - b.stops;
      default:
        // "top flights": cheapest of the fewest-stop options first
        return a.stops - b.stops || a.price - b.price;
    }
  });

  const bestFlights = filtered.slice(0, 3);
  const otherFlights = filtered.slice(3);

  return {
    searchParameters: input,
    bestFlights,
    otherFlights,
    totalResults: filtered.length,
  };
}

export function getFlightStatus(flightNumber: string): {
  flightNumber: string;
  status: 'on_time' | 'delayed' | 'cancelled' | 'landed';
  updatedAt: string;
} {
  if (!/^[A-Z]{2}\d{2,4}$/.test(flightNumber)) {
    throw new ValidationError(
      `flightNumber must look like an IATA flight number, e.g. "AA123", got "${flightNumber}"`,
    );
  }
  const rand = seededRandom(flightNumber);
  const statuses = ['on_time', 'delayed', 'cancelled', 'landed'] as const;
  const status = statuses[Math.floor(rand() * statuses.length)];
  return {
    flightNumber,
    status,
    // Fixed epoch-derived value keeps this deterministic for tests instead of using real wall-clock time.
    updatedAt: new Date(Math.floor(rand() * 1_700_000_000_000)).toISOString(),
  };
}

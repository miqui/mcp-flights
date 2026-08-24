import { describe, expect, it } from 'vitest';
import { getFlightStatus, searchFlights, ValidationError } from '../src/flightData.js';

describe('searchFlights', () => {
  it('returns deterministic results for the same input', () => {
    const input = {
      departureId: 'SFO',
      arrivalId: 'JFK',
      outboundDate: '2027-03-01',
      returnDate: '2027-03-08',
    };
    const a = searchFlights(input);
    const b = searchFlights(input);
    expect(a).toEqual(b);
    expect(a.totalResults).toBeGreaterThan(0);
  });

  it('rejects malformed IATA codes', () => {
    expect(() =>
      searchFlights({
        departureId: 'sfo!',
        arrivalId: 'JFK',
        outboundDate: '2027-03-01',
        returnDate: '2027-03-08',
      }),
    ).toThrow(ValidationError);
  });

  it('rejects malformed dates', () => {
    expect(() =>
      searchFlights({
        departureId: 'SFO',
        arrivalId: 'JFK',
        outboundDate: '03/01/2027',
        returnDate: '2027-03-08',
      }),
    ).toThrow(ValidationError);
  });

  it('requires returnDate for round trip (tripType=1, default)', () => {
    expect(() =>
      searchFlights({
        departureId: 'SFO',
        arrivalId: 'JFK',
        outboundDate: '2027-03-01',
      }),
    ).toThrow(/returnDate is required/);
  });

  it('rejects returnDate for one-way (tripType=2)', () => {
    expect(() =>
      searchFlights({
        departureId: 'SFO',
        arrivalId: 'JFK',
        outboundDate: '2027-03-01',
        returnDate: '2027-03-08',
        tripType: 2,
      }),
    ).toThrow(/must be omitted/);
  });

  it('rejects combining includeAirlines and excludeAirlines', () => {
    expect(() =>
      searchFlights({
        departureId: 'SFO',
        arrivalId: 'JFK',
        outboundDate: '2027-03-01',
        returnDate: '2027-03-08',
        includeAirlines: 'AA',
        excludeAirlines: 'UA',
      }),
    ).toThrow(/cannot be used together/);
  });

  it('applies stops=1 (nonstop only) filter', () => {
    const result = searchFlights({
      departureId: 'ORD',
      arrivalId: 'LAX',
      outboundDate: '2027-05-01',
      returnDate: '2027-05-10',
      stops: 1,
    });
    for (const f of [...result.bestFlights, ...result.otherFlights]) {
      expect(f.stops).toBe(0);
    }
  });

  it('applies maxPrice filter', () => {
    const result = searchFlights({
      departureId: 'ORD',
      arrivalId: 'LAX',
      outboundDate: '2027-05-01',
      returnDate: '2027-05-10',
      maxPrice: 300,
    });
    for (const f of [...result.bestFlights, ...result.otherFlights]) {
      expect(f.price).toBeLessThanOrEqual(300);
    }
  });

  it('applies includeAirlines filter', () => {
    const result = searchFlights({
      departureId: 'ORD',
      arrivalId: 'LAX',
      outboundDate: '2027-05-01',
      returnDate: '2027-05-10',
      includeAirlines: 'AA,UA',
    });
    for (const f of [...result.bestFlights, ...result.otherFlights]) {
      expect(['AA', 'UA']).toContain(f.airline);
    }
  });

  it('sorts by price ascending when sortBy=2', () => {
    const result = searchFlights({
      departureId: 'ORD',
      arrivalId: 'LAX',
      outboundDate: '2027-05-01',
      returnDate: '2027-05-10',
      sortBy: 2,
    });
    const all = [...result.bestFlights, ...result.otherFlights];
    for (let i = 1; i < all.length; i++) {
      expect(all[i].price).toBeGreaterThanOrEqual(all[i - 1].price);
    }
  });
});

describe('getFlightStatus', () => {
  it('returns a deterministic status for a valid flight number', () => {
    const a = getFlightStatus('AA123');
    const b = getFlightStatus('AA123');
    expect(a).toEqual(b);
    expect(['on_time', 'delayed', 'cancelled', 'landed']).toContain(a.status);
  });

  it('rejects malformed flight numbers', () => {
    expect(() => getFlightStatus('not-a-flight')).toThrow(ValidationError);
  });
});

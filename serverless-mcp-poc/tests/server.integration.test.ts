import { InMemoryTransport } from '@modelcontextprotocol/server';
import { Client } from '@modelcontextprotocol/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createServer } from '../src/server.js';

/**
 * Exercises the real MCP server factory (the same factory wrapped by
 * createMcpHandler in src/server.ts) end-to-end over an in-memory transport
 * pair — no HTTP, no Lambda, no network. This is the "in-memory MCP client"
 * style of test recommended for the v2 SDK.
 */
describe('mcp-flights-poc server (in-memory transport)', () => {
  let client: Client;

  beforeEach(async () => {
    const server = createServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: 'test-client', version: '1.0.0' });
    await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  });

  afterEach(async () => {
    await client.close();
  });

  it('lists all three registered tools', async () => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual(['get_flight_status', 'health_check', 'search_flights']);
  });

  it('health_check returns ok status', async () => {
    const result = await client.callTool({ name: 'health_check', arguments: {} });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({ status: 'ok', service: 'mcp-flights-poc' });
  });

  it('search_flights returns mock flight results for a valid round trip', async () => {
    const result = await client.callTool({
      name: 'search_flights',
      arguments: {
        departureId: 'SFO',
        arrivalId: 'JFK',
        outboundDate: '2027-06-01',
        returnDate: '2027-06-08',
      },
    });
    expect(result.isError).toBeFalsy();
    const structured = result.structuredContent as { totalResults: number; bestFlights: unknown[] };
    expect(structured.totalResults).toBeGreaterThan(0);
    expect(Array.isArray(structured.bestFlights)).toBe(true);
  });

  it('search_flights surfaces a tool-level error for invalid combination (not a protocol error)', async () => {
    const result = await client.callTool({
      name: 'search_flights',
      arguments: {
        departureId: 'SFO',
        arrivalId: 'JFK',
        outboundDate: '2027-06-01',
        returnDate: '2027-06-08',
        includeAirlines: 'AA',
        excludeAirlines: 'UA',
      },
    });
    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ type: string; text?: string }>)[0]?.text ?? '';
    expect(text).toMatch(/cannot be used together/);
  });

  it('rejects malformed tool arguments via schema validation before the handler runs', async () => {
    const result = await client.callTool({
      name: 'search_flights',
      arguments: {
        departureId: 'SFO-TOO-LONG',
        arrivalId: 'JFK',
        outboundDate: '2027-06-01',
        returnDate: '2027-06-08',
      },
    });
    expect(result.isError).toBe(true);
  });

  it('get_flight_status returns a deterministic mock status', async () => {
    const result = await client.callTool({
      name: 'get_flight_status',
      arguments: { flightNumber: 'AA123' },
    });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({ flightNumber: 'AA123' });
  });
});

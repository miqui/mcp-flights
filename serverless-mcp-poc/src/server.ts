/**
 * MCP server factory for the mcp-flights Serverless-on-Lambda POC.
 *
 * Pattern (per the current Serverless Framework v4 "Deploy MCP servers on AWS
 * Lambda" guide): this module's default export must be the object returned by
 * `createMcpHandler(...)` from `@modelcontextprotocol/server` (the official
 * MCP TypeScript SDK v2, targeting the 2026-07-28 MCP spec revision).
 * Serverless Framework references this module via `mcp.servers.<name>.server`
 * in serverless.yml and wraps `handler.fetch` in a Lambda entry at deploy time.
 *
 * This POC intentionally has ZERO AWS SDK imports, ZERO secrets, ZERO auth
 * infrastructure, and ZERO outbound network calls. Tool logic is backed by a
 * small deterministic in-memory mock dataset (./flightData.ts) so it can be
 * fully exercised in tests and via `serverless package` without touching AWS
 * or any third-party API (e.g. the real mcp-flights project's SerpAPI key).
 */
import { createMcpHandler, McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import {
  ValidationError,
  getFlightStatus,
  searchFlights,
  type FlightSearchInput,
} from './flightData.js';

export const SERVER_NAME = 'mcp-flights-poc';
export const SERVER_VERSION = '0.1.0';

/** Factory: builds a fresh McpServer instance per invocation/request.
 * Register all tools inside the factory (per SDK v2 stateless-by-default
 * design) — never on a shared instance held at module scope. */
export function createServer(): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

  server.registerTool(
    'search_flights',
    {
      title: 'Search flights',
      description:
        'Search a mocked flight inventory between two IATA airport codes on given dates. ' +
        'Returns deterministic, locally-generated mock results only — this POC makes no ' +
        'network calls and is not backed by a real flight-data provider.',
      inputSchema: z.object({
        departureId: z
          .string()
          .length(3)
          .describe('3-letter IATA departure airport code, e.g. "SFO"'),
        arrivalId: z
          .string()
          .length(3)
          .describe('3-letter IATA arrival airport code, e.g. "JFK"'),
        outboundDate: z.string().describe('Outbound date, YYYY-MM-DD'),
        returnDate: z
          .string()
          .optional()
          .describe('Return date, YYYY-MM-DD. Required when tripType=1 (round trip).'),
        currency: z.string().optional().describe('ISO currency code, default "USD"'),
        adults: z.number().int().min(1).max(9).optional().describe('Number of adult travelers'),
        tripType: z
          .union([z.literal(1), z.literal(2), z.literal(3)])
          .optional()
          .describe('1=round trip (default), 2=one way, 3=multi-city'),
        stops: z
          .union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)])
          .optional()
          .describe('0=any (default), 1=nonstop, 2=<=1 stop, 3=<=2 stops'),
        maxPrice: z.number().positive().optional().describe('Maximum price filter'),
        sortBy: z
          .union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)])
          .optional()
          .describe('1=top (default), 2=price, 3=departure, 4=duration, 5=fewest stops'),
        includeAirlines: z
          .string()
          .optional()
          .describe('Comma-separated airline IATA codes to include, e.g. "AA,UA"'),
        excludeAirlines: z
          .string()
          .optional()
          .describe('Comma-separated airline IATA codes to exclude, e.g. "NK,F9"'),
      }),
      outputSchema: z.object({
        totalResults: z.number(),
        bestFlights: z.array(z.record(z.string(), z.unknown())),
        otherFlights: z.array(z.record(z.string(), z.unknown())),
      }),
    },
    async (args) => {
      try {
        const result = searchFlights(args as FlightSearchInput);
        const structuredContent = {
          totalResults: result.totalResults,
          bestFlights: result.bestFlights,
          otherFlights: result.otherFlights,
        };
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(structuredContent, null, 2),
            },
          ],
          structuredContent,
        };
      } catch (err) {
        if (err instanceof ValidationError) {
          return {
            content: [{ type: 'text' as const, text: `Invalid search: ${err.message}` }],
            isError: true,
          };
        }
        throw err;
      }
    },
  );

  server.registerTool(
    'get_flight_status',
    {
      title: 'Get flight status',
      description:
        'Look up a mocked status for a single flight number (e.g. "AA123"). ' +
        'Deterministic mock data only — no live flight-tracking API is called.',
      inputSchema: z.object({
        flightNumber: z.string().describe('IATA-style flight number, e.g. "AA123"'),
      }),
    },
    async ({ flightNumber }) => {
      try {
        const status = getFlightStatus(flightNumber);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(status, null, 2) }],
          structuredContent: status,
        };
      } catch (err) {
        if (err instanceof ValidationError) {
          return {
            content: [{ type: 'text' as const, text: `Invalid flight number: ${err.message}` }],
            isError: true,
          };
        }
        throw err;
      }
    },
  );

  server.registerTool(
    'health_check',
    {
      title: 'Health check',
      description: 'Return a simple readiness payload for the MCP server.',
    },
    async () => {
      const payload = { status: 'ok', service: SERVER_NAME, version: SERVER_VERSION };
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(payload) }],
        structuredContent: payload,
      };
    },
  );

  return server;
}

/**
 * Default export required by the Serverless Framework MCP integration:
 * `mcp.servers.flights.server` in serverless.yml points at this module, and
 * Serverless expects the default export to be the object `createMcpHandler`
 * returns (exposing a web-standard `fetch` handler), not the factory itself.
 */
const handler = createMcpHandler(createServer);

export default handler;

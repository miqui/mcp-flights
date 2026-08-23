# mcp-flights Serverless MCP-on-Lambda POC

This directory (`serverless-mcp-poc/`) is a **proof-of-concept** demonstrating
how the existing `mcp-flights` Python/FastMCP tool surface could be re-exposed
as a **TypeScript MCP server deployed on AWS Lambda via Serverless Framework
v4's native `mcp.servers` integration** — following the pattern described in
Serverless Framework's "Deploy MCP servers on AWS Lambda" guide.

**This is a local-only POC.** It does not call AWS, does not call SerpAPI, has
no secrets, no IAM roles, and no authentication infrastructure. Every tool
returns deterministic mock data generated in-process. Nothing here has been
deployed.

## What this demonstrates

- A TypeScript module (`src/server.ts`) whose **default export** is the
  object returned by `createMcpHandler(...)` from the official
  `@modelcontextprotocol/server` **v2** SDK, targeting the **2026-07-28** MCP
  spec revision.
- `serverless.yml` declaring the server under **`mcp.servers.flights.server`**
  — the exact key Serverless Framework v4 uses to auto-bundle a TypeScript MCP
  module and provision a Lambda entry + HTTPS route.
- A tool surface derived from the real `mcp-flights` project's parameter
  model (`../src/mcp_flights/models.py`): IATA airport codes, ISO dates,
  round-trip/one-way validation, stops/price/airline filters, sort order —
  reimplemented against an in-memory mock dataset instead of a live SerpAPI
  call.
- Local, no-deploy validation: unit tests, an in-memory MCP client/server
  integration test, TypeScript build/typecheck, and Serverless config
  inspection.

## Tool surface

| Tool | Purpose |
|---|---|
| `search_flights` | Search a mocked flight inventory between two IATA airports on given dates, with stops/price/airline/sort filters mirroring the real `mcp-flights` model. Deterministic (seeded) mock data — no network calls. |
| `get_flight_status` | Look up a mocked status (`on_time`/`delayed`/`cancelled`/`landed`) for a flight number. Deterministic mock data. |
| `health_check` | Simple readiness payload, mirrors the existing Python server's `health_check` tool. |

## Requirements

- Node.js **20+** (repo verified against Node 22.22.2)
- npm
- No AWS account/credentials required for anything in this README except the
  clearly marked manual deploy command at the bottom, which is **not** run
  here.

## Setup

```bash
cd /Users/miqui/development/mcp-flights/serverless-mcp-poc
npm install
```

Installs, from `package.json`:

- **dependencies:** `@modelcontextprotocol/server@^2.0.0`, `zod@^4.4.3`
  (both required in `dependencies`, not `devDependencies`, so Serverless'
  classic packaging doesn't strip them at deploy time)
- **devDependencies:** `@modelcontextprotocol/client` (for in-memory test
  client), `typescript`, `vitest`, `@types/node`, `serverless` (local CLI,
  v4.41.0 pinned via `^4.41.0`)

## Validation (all commands run, no AWS calls, no deploy)

### 1. Typecheck

```bash
npm run typecheck
```

Verified output: **clean, no errors** (`tsc --noEmit`).

### 2. Build

```bash
npm run build
```

Verified output: compiles `src/` and `tests/` to `dist/` with no errors.

### 3. Unit + in-memory MCP integration tests

```bash
npm test
```

Verified output:

```
✓ tests/flightData.test.ts (12 tests)
✓ tests/server.integration.test.ts (6 tests)
Test Files  2 passed (2)
     Tests  18 passed (18)
```

The integration test (`tests/server.integration.test.ts`) connects a real
`@modelcontextprotocol/client` `Client` to the actual `createServer()` factory
from `src/server.ts` over `InMemoryTransport.createLinkedPair()` — no HTTP,
no Lambda, no network — and exercises `tools/list`, `search_flights` (success,
validation-rejected combination, and malformed-argument schema rejection),
`get_flight_status`, and `health_check`.

### 4. Serverless config inspection / package validation

`serverless print` and `serverless package` are the documented no-deploy
validation commands for MCP server configs. **In this environment they could
not be run to completion**, because Serverless Framework v4 requires either
an interactive `serverless login` or a paid license key for *every* CLI
invocation, including config-only commands like `print`:

```
✖ Error: You must sign in or use a license key with Serverless Framework
  V.4 and later versions. Please use "serverless login".
```

This is a genuine pre-existing environment constraint, not a bug in this
POC's config — creating a Serverless account/license key or authenticating
was out of scope per this task's instructions (no credentials to be
created). As a substitute, `serverless.yml` was validated for syntactic
correctness and expected shape using Python's stdlib-adjacent `PyYAML`
(already present in this host's environment) instead of installing an
additional npm YAML parser:

```bash
python3 -c "
import yaml, json
with open('serverless.yml') as f:
    doc = yaml.safe_load(f)
assert doc['service'] == 'mcp-flights-poc'
assert doc['frameworkVersion'] == '4'
assert doc['provider']['runtime'] == 'nodejs20.x'
assert doc['mcp']['servers']['flights']['server'] == 'src/server.ts'
print('YAML valid and matches expected schema shape.')
"
```

Verified output: `YAML valid and matches expected schema shape.`

If you have a Serverless Framework license key (or want to `serverless
login` interactively), you can re-run the intended no-deploy validation
yourself:

```bash
npx serverless login        # or: export SERVERLESS_ACCESS_KEY=... / licenseKey in serverless.yml
npx serverless print         # renders fully-resolved config, no AWS calls
npx serverless package       # builds + stages the Lambda artifact locally, no AWS calls
```

## Known limitations / notes

- **No AWS calls anywhere in this POC.** `provider` in `serverless.yml`
  declares only `name: aws`, `runtime: nodejs20.x`, and `region` — no IAM
  roles, no resources, no environment secrets.
- **No auth infrastructure.** No `authorizer`, no `oauthDiscovery`, no bearer
  token verification — this POC is intentionally unauthenticated, matching
  its non-production, no-deploy scope. A production deployment would need to
  add these (see the Serverless MCP guide's auth section) before ever going
  live.
- **Dev dependency advisory:** `npm audit` reports vulnerabilities in
  `esbuild`/`vite`, transitively pulled in by `vitest@2.1.9` (its bundled dev
  server). This only affects the local `vitest` dev/watch server, not any
  code shipped in the Lambda bundle; a full fix requires upgrading to
  `vitest@4.x`, which is a breaking change out of scope for this POC.
- **Real mcp-flights project unaffected.** Nothing in the existing Python
  package (`../src/mcp_flights/`, `../pyproject.toml`, `../README.md`, etc.)
  was modified. This POC lives entirely under `serverless-mcp-poc/`.

## ⚠️ Manual-only: actual deployment (NOT run as part of this POC)

The command below would provision real AWS resources (Lambda function, API
Gateway route, IAM role, S3 deployment bucket) under whatever AWS
credentials/profile you have configured, and would incur AWS costs. It was
**not** run in the course of building or validating this POC and requires
you to first `serverless login` or configure a license key plus valid AWS
credentials:

```bash
# MANUAL ONLY — do not run automatically. Provisions real AWS resources.
cd /Users/miqui/development/mcp-flights/serverless-mcp-poc
npx serverless deploy
```

# Anthropic Just Dropped Its Official Claude Lab — companion demo

Interactive lab for the article *Anthropic Just Dropped Its Official Claude Certification — The Schema Mistake That Fails Developer Exams*. A deterministic schema lab proves the exact failure mode that breaks generic Claude study prep.

Zero dependencies — Node 24+ only. The domain model, the lab runner, and the test suite are plain ES modules shared by the browser UI and the `node:test` suites.

## What it proves

The seeded build uses a generic `functions[].parameters` tool schema and a stale cache marker. Run the schema checkpoint on that build and the scenario fails every time. Switch to the Claude-specific build with `tools[].input_schema` and the same scenario passes.

| Control | Seeded failure it catches |
|---|---|
| Schema checkpoint | Generic tool schema instead of Claude `tools[].input_schema` |
| Cache-break assertion | Stale cache state after a system or tool edit |
| API scenario | End-to-end POST to `/api/scenario` that mirrors the lab logic |

## Run it

```text
npm start        # serve the lab on :3000
npm test         # domain + e2e server suites
npm run check    # npm test alias
```

## Layout

- `public/lab.mjs` — domain model and deterministic assertions
- `public/demo.mjs` — re-exports the lab module for the browser bundle
- `public/app.js` — DOM wiring for the interactive lab
- `public/styles.css` — unique Certification Desk Lamp palette
- `app/server.js` — static server, security headers, and `/api/scenario` endpoint
- `test/lab.test.mjs` — unit coverage for the domain model and failure mode
- `test/server.test.mjs` — end-to-end server coverage

## Honest limits

- The lab simulates the schema boundary in plain JavaScript — it does not call live Anthropic APIs.
- Cache behavior follows a simplified deterministic model, not the full production prompt-caching system.
- A passing run means the configured boundary passed in this simulation; it is not an Anthropic certification result.

This is an educational demo, not production infrastructure.

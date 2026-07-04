# Examples

These examples are small application-style entrypoints that show how Teta fits into
Node, Bun, and Deno projects.

Most multi-stage examples use Teta's `pipe(...)` with named imports from `@teta/teta`.

For a guided introduction, see [Getting Started](../doc/GETTING_STARTED.md).

- `examples/node/tenant_orders.ts` builds `{ text, values }` for a typical database client.
- `examples/node/api_orders.ts` shows a request/session-driven API handler with bound SQL params.
- `examples/node/custom_dialect.ts` shows a runnable custom dialect configuration with language mappings and fallbacks.
- `examples/bun/dialect_report.ts` renders the same query for multiple engines.
- `examples/deno/runtime_smoke.ts` shows a minimal Deno-friendly query module.

Run them from the repository root with your preferred runtime. See `../README.md` for the surrounding concepts and API walkthrough.

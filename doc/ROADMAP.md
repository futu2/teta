# Teta Roadmap

This roadmap is directional rather than a strict release commitment. It reflects
the highest-value next steps for making Teta easier to adopt, stronger in real
projects, and easier to trust as a SQL compiler.

It now separates shipped work from open gaps so the roadmap stays useful as
features land.

## Guiding themes

- keep the EDSL dialect-neutral
- improve type safety for real schemas
- make compiler behavior more inspectable
- keep generated SQL readable and predictable
- validate package claims across supported runtimes

## Shipped recently

### 1. Adoption and positioning — shipped

Goal: make it obvious why someone should try Teta and how to install it.

- [x] add consumer install docs for JSR, Bun, Deno, and Node
- [x] add a short "Why Teta?" section in the README
- [x] explain how Teta differs from query builders and ORMs
- [x] add a few realistic end-to-end examples for app code

### 2. CI and runtime trust — shipped

Goal: make package compatibility claims match automated verification.

- [x] run `check` in CI
- [x] add cross-runtime smoke tests for Bun, Node, and Deno imports
- [x] keep live SQL execution tests for SQLite and DuckDB
- [x] verify publish flow stays aligned with the tested package entrypoints

### 3. Schema type coverage — shipped

Goal: support the types most projects need on day one.

- [x] add `t.nullable(...)`
- [x] add `t.bigint()`
- [x] add `t.decimal()`
- [x] add `t.json<T>()`
- [x] add `t.uuid()`
- [x] add `t.bytes()`

### 4. Render strategy controls — shipped

Goal: let users choose between readability and compactness intentionally.

- [x] add explicit render strategies such as `readable` and `optimized`
- [x] keep `optimized` as the default strategy
- [x] measure SQL size and render behavior across representative queries
- [x] document the tradeoffs of each mode

### 5. Package surface cleanup — shipped

Goal: keep the main entrypoint focused on the core EDSL.

- [x] move watch and clipboard helpers into a dedicated dev subpath export
- [x] keep the default package surface optimized for runtime use
- [x] document which APIs are compiler/runtime APIs versus local dev tooling

## Completed follow-up

### 6. Compiler and debugging DX — shipped

Goal: help users understand how queries are lowered and rendered.

- [x] add a structured `explain()` API for query compilation
- [x] include IR, AST, SQL, params, and stage metadata in debug output
- [x] document common lowering patterns such as stage fusion and derived-table barriers
- [x] add more guidance for debugging dialect-specific rewrites confidently

### 7. Error ergonomics — shipped

Goal: make user-facing failures easier to understand and handle.

- [x] introduce stable error classes and error codes
- [x] distinguish user mistakes from internal compiler failures
- [x] improve unsupported-dialect and invalid-query messages
- [x] document the most common error cases with fixes

### 8. Benchmarks and performance baselines — shipped

Goal: make performance a tracked feature instead of an anecdote.

- [x] add benchmarks for query render time
- [x] track output SQL size for representative pipelines
- [x] compare readable vs optimized render strategies
- [x] catch performance regressions in core lowering paths

### 9. Examples and ecosystem fit — shipped

Goal: reduce the gap between toy examples and production usage.

- [x] add a minimal Node example
- [x] add a minimal Deno example
- [x] add a minimal Bun example
- [x] add examples showing parameter binding in web APIs
- [x] add examples for custom dialect configuration

## Milestone snapshot

### v0.3 — shipped

- install and onboarding improvements
- README positioning improvements
- CI runs `check`
- cross-runtime import verification

### v0.4 — shipped

- `t.nullable(...)`
- common scalar type additions
- docs and tests for schema typing behavior

### v0.5 — shipped

- `explain()` and compiler introspection
- clearer render strategy options
- better user-facing error handling

### v0.6 — shipped

- package surface cleanup
- benchmarks
- more production-style examples

## Candidate issue backlog

- none currently; the roadmap items tracked in this file are shipped

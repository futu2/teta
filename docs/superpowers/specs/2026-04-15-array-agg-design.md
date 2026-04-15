# Array Aggregate Design

Date: 2026-04-15
Status: Approved for planning

## Summary

Add a single portable aggregate helper, `arrayAgg(expr)`, to the Teta DSL. The helper uses `ARRAY_AGG` as the canonical internal aggregate name and renders dialect-specific SQL per backend.

## Goals

- Expose one public API for list-style aggregation across supported dialects.
- Keep aggregate behavior in the existing aggregate planning and rendering path.
- Support PostgreSQL, Hetu, Hive, and SQLite with dialect-specific SQL names.
- Keep the first version small and testable.

## Non-Goals

- Supporting `DISTINCT` inside `arrayAgg(...)`.
- Supporting aggregate-local ordering such as `array_agg(x ORDER BY y)`.
- Adding fallback rewrites for dialects that do not expose an array or JSON collection aggregate.
- Modeling SQLite as a native SQL array backend.

## Current Behavior

Teta exposes scalar aggregates such as `count`, `sum`, `avg`, `min`, and `max`, but it does not expose an aggregate for collecting rows into an array or list value.

This blocks portable query authoring for common grouped list-aggregation cases. Users currently have to rely on raw SQL function names or cannot express the operation through the DSL at all.

## Proposed Change

Add a new public helper:

- `arrayAgg<T>(value: ExprInput<T>): ExprRef<T[]>`

Implementation details:

- Treat `ARRAY_AGG` as a canonical aggregate name in the expression model, alongside `COUNT`, `SUM`, `AVG`, `MIN`, and `MAX`.
- Build `arrayAgg(...)` through the aggregate node path, not the generic `fn(...)` path, so it participates correctly in `fold(...)`, group extraction, and aggregate rendering.
- Export the helper from the public package surface next to the existing aggregate helpers.

Dialect rendering:

- PostgreSQL: `ARRAY_AGG -> ARRAY_AGG`
- Hetu: `ARRAY_AGG -> ARRAY_AGG`
- Hive: `ARRAY_AGG -> COLLECT_LIST`
- SQLite: `ARRAY_AGG -> JSON_GROUP_ARRAY`

SQLite is the only backend in scope that does not expose a native SQL array aggregate. `json_group_array(...)` is the closest builtin collection aggregate and should be treated as the SQLite rendering target for the portable API. The public Teta API remains `arrayAgg(...)`; the dialect-specific runtime representation is documented rather than surfaced as a separate DSL type.

## Testing Strategy

Add tests before implementation for the supported dialects:

- PostgreSQL renders grouped `arrayAgg(...)` as `ARRAY_AGG(...)`.
- Hetu renders grouped `arrayAgg(...)` as `ARRAY_AGG(...)`.
- Hive renders grouped `arrayAgg(...)` as `COLLECT_LIST(...)`.
- SQLite renders grouped `arrayAgg(...)` as `JSON_GROUP_ARRAY(...)`.

Add the tests to the aggregate suite so the new helper is verified in the same context as the existing fold aggregates.

## Risks And Mitigations

### Risk: SQLite semantics differ from native array dialects

Mitigation:

- keep the public API portable while documenting that SQLite returns a JSON-backed collection value at execution time
- avoid promising native-array behavior in docs or tests

### Risk: implementing `arrayAgg(...)` as a generic function would break fold semantics

Mitigation:

- extend the aggregate function union and reuse the existing aggregate expression path
- cover grouped rendering in tests rather than testing only raw expression rendering

### Risk: scope expansion into `DISTINCT` or ordered aggregates

Mitigation:

- keep the first version unary only
- document `DISTINCT` and aggregate-local ordering as out of scope for this change

## Implementation Notes

- Update the aggregate function type union to include `ARRAY_AGG`.
- Add the new helper in `packages/teta/src/edsl/sql/expr/ops/aggregate.ts`.
- Export it through `packages/teta/mod.ts`.
- Add dialect function mappings in the PostgreSQL, Hetu, Hive, and SQLite dialect definitions.
- Update the language spec docs so the aggregate support matrix includes `arrayAgg(...)` and notes the SQLite JSON-backed rendering.

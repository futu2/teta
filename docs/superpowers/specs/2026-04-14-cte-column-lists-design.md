# CTE Column Lists Design

Date: 2026-04-14
Status: Approved for planning

## Summary

Render explicit column lists for every CTE that Teta materializes, not just recursive loop CTEs. This includes user or base query CTEs and auto-generated stage CTEs such as `cte_0` and join-hoist CTEs.

## Goals

- Make all emitted CTEs use a consistent `name(col1, col2, ...) AS (...)` form.
- Reuse the same column-list rendering pattern already used by recursive CTEs.
- Cover both base CTEs and generated stage CTEs with tests.

## Non-Goals

- Changing how final top-level `SELECT` projections are rendered.
- Renaming generated CTEs or changing stage-planning behavior.
- Adding a user-facing option to toggle CTE column lists on or off.

## Current Behavior

Recursive CTEs already render explicit column lists because the recursive materialization path sets the parser `With.columns` field from the loop column names.

Non-recursive query CTEs do not currently set `With.columns`, even though the underlying `QuerySpec` already carries `columnNames`. As a result, emitted SQL is inconsistent:

- recursive CTEs render as `loop_0(id, name, ...) AS (...)`
- non-recursive CTEs render as `seed AS (...)` or `cte_0 AS (...)`

## Proposed Change

Populate `With.columns` for every non-recursive `query` CTE at materialization time using `cte.query.columnNames`.

The renderer already centralizes CTE materialization in `packages/teta/src/edsl/sql/render/recursive_cte.ts`. The non-recursive branch should build the same column-ref AST nodes used by the recursive branch and attach them to the returned `With` node.

This keeps the change local to CTE rendering and automatically applies it to:

- base CTEs supplied through `query.withs`
- readable-stage intermediate CTEs
- hoisted join or subquery CTEs

## Testing Strategy

Add tests before implementation for the two key surfaces:

- a base non-recursive CTE materialized through `renderPipelineAst(...)`, asserting the first CTE renders with an explicit column list
- a generated readable-stage CTE rendered through `toSql(...)`, asserting stage CTEs render with explicit column lists

Existing recursive CTE tests continue to verify that loop CTEs keep their current explicit column-list behavior.

## Risks And Mitigations

### Risk: SQL formatting differs across parser output when `columns` is populated

Mitigation:

- verify behavior through current compact SQL rendering tests rather than relying only on AST inspection

### Risk: some generated CTEs might expose unexpected column names

Mitigation:

- use the already-planned query column names instead of inferring names from rendered SQL
- add tests for both user/base and generated stage CTE paths

## Implementation Notes

- Keep the change in the CTE materialization layer rather than threading new flags through pipeline builders.
- Reuse the existing helper that converts column names into parser column refs.
- Prefer minimal edits so recursive and non-recursive branches stay structurally aligned.

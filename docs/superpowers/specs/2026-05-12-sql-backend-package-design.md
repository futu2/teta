# SQL Backend Package Design

Date: 2026-05-12
Status: Approved for planning

## Summary

Split Teta into a reusable SQL backend package and a frontend EDSL package.

`@teta/sql` becomes the shared compiler backend and IR contract. It owns neutral IR types, IR helper constructors, dialect handling, AST lowering, and SQL rendering. `@teta/teta` becomes one frontend that builds typed queries and expressions, lowers them to `@teta/sql` IR, and keeps direct convenience helpers such as `toSql(...)`.

This is a breaking package-boundary refactor. Compatibility with the current internal file layout is not a goal.

## Goals

- Make `@teta/sql` reusable by future frontends, including a possible OOP-style EDSL.
- Move SQL dialect and rendering implementation out of `@teta/teta`.
- Make the frontend/backend relationship explicit:
  - frontend builds IR
  - backend renders IR
- Keep a direct EDSL-to-SQL helper in `@teta/teta` for ergonomic use.
- Publish `@teta/sql` as a separate JSR package from the same monorepo.
- Keep `@teta/sql` independent from `@teta/teta`.

## Non-Goals

- Do not preserve the old internal module paths.
- Do not require users to manually call `toIR(...)` before every render.
- Do not move the current EDSL query-building API into `@teta/sql`.
- Do not build a second frontend in this change.
- Do not make `@teta/sql` depend on `@teta/teta`.

## Package Boundary

The dependency direction is:

```text
@teta/teta       -> @teta/sql
future frontend  -> @teta/sql
@teta/sql        -> no dependency on @teta/teta
```

### `@teta/sql`

`@teta/sql` owns the shared language backend:

- IR data types:
  - `ExprNode`
  - `QueryIR`
  - `QuerySpec`
  - `Stage`
  - `Source`
  - `CteSpec`
  - identifiers and scope IDs
- IR helper APIs:
  - expression node constructors
  - table/value source constructors
  - stage constructors
  - scope and CTE name helpers
  - IR validation helpers where useful
- SQL backend APIs:
  - `irToAst(...)`
  - `irToSql(...)`
  - `irToSqlResult(...)`
  - `exprToSql(...)`
  - `exprToSqlResult(...)`
  - `explainIR(...)`
- Dialect and render APIs:
  - `SqlOptions`
  - `SqlResult`
  - dialect definitions
  - dialect resolution helpers

### `@teta/teta`

`@teta/teta` owns the current TypeScript EDSL frontend:

- `Query` builder objects
- `table(...)`, `values(...)`, `map(...)`, `filter(...)`, `fold(...)`, `join(...)`, `loop(...)`, `sort(...)`, `take(...)`
- typed row proxies and selector ergonomics
- expression helper ergonomics such as `eq(...)`, `add(...)`, `count(...)`, `upper(...)`
- `toIR(query)`
- direct convenience rendering:
  - `toSql(query, options)`
  - `toSqlResult(query, options)`
  - `explain(query, options)`

The direct rendering helpers in `@teta/teta` are facades over `@teta/sql`:

```ts
toSql(query, options) = irToSql(toIR(query), options)
toSqlResult(query, options) = irToSqlResult(toIR(query), options)
```

## Public API Shape

Recommended user-facing flow:

```ts
import { $, eq, filter, map, t, table, toIR, toSql } from "@teta/teta";
import { irToSql } from "@teta/sql";
import { pipe } from "remeda";

const users = table("users", {
  id: t.int(),
  active: t.boolean(),
});

const query = pipe(
  users,
  filter(eq($.active, true)),
  map({ id: $.id })
);

const directSql = toSql(query, { dialect: "postgresql" });

const ir = toIR(query);
const backendSql = irToSql(ir, { dialect: "postgresql" });
```

`@teta/sql` should use backend-oriented names instead of EDSL names. Query rendering starts from IR:

```ts
import { irToAst, irToSql, irToSqlResult } from "@teta/sql";
```

Expression rendering also belongs in the backend:

```ts
import { exprToSql, exprToSqlResult } from "@teta/sql";
```

## Internal Layout

Add a new workspace package:

```text
packages/
  sql/
    mod.ts
    jsr.json
    package.json
    src/
      ir/
      dialect/
      language/
      render/
  teta/
    mod.ts
    src/
      edsl/
  dev/
```

Move to `packages/sql`:

- neutral IR definitions currently under `packages/teta/src/edsl/core/types*`
- SQL dialect definitions and option resolution
- SQL language rewrite and fallback logic
- SQL AST lowering and render pipeline
- SQL renderer output and result types
- query/render utilities needed by the backend

Keep in `packages/teta`:

- frontend query construction
- typed `Query` class
- row proxy/deferred selector ergonomics
- public EDSL expression helpers
- `toIR(query)`
- convenience `toSql(...)` and `toSqlResult(...)` facades

## IR Helper API

`@teta/sql` should expose a small supported helper namespace, likely named `ir`.

The helper API prevents future frontends from manually copying raw object shapes. It should cover the stable construction points that frontend packages need:

- expression nodes:
  - literals
  - columns
  - unary/binary operators
  - functions
  - aggregates
  - windows
  - casts
- query sources:
  - table sources
  - values sources
- stages:
  - projection stages
  - filter stages
  - sort stages
  - take stages
  - join stages
  - unnest stages
  - union stages
- scope and CTE helpers:
  - fresh scope IDs
  - internal/generated CTE names
  - source and projection identifier helpers
- validation:
  - `validateQueryIR(...)` for backend-facing shape checks

The helpers should be lightweight. They should not recreate the current EDSL or make `@teta/sql` responsible for TypeScript row-selection ergonomics.

## Data Flow

Direct frontend use:

```text
@teta/teta EDSL
  -> Query object
  -> toIR(query)
  -> @teta/sql irToSqlResult(ir, options)
  -> SQL
```

Explicit compiler pipeline:

```text
@teta/teta Query
  -> toIR(query)
  -> @teta/sql irToAst(ir, options)
  -> @teta/sql irToSql(ir, options)
```

Future frontend:

```text
custom frontend
  -> @teta/sql IR helpers/types
  -> @teta/sql irToSql(...)
```

## Existing Coupling To Resolve

The current renderer imports a few helpers from `packages/teta/src/edsl/query/utils.ts`, including identifier and projection helpers. Those helpers are backend-relevant and must move into `@teta/sql` or into its IR helper area.

The current `query/builder.ts` also owns both frontend and backend entrypoints:

- `toIR(...)`
- `toAst(...)`
- `toSql(...)`
- `toSqlResult(...)`
- `explain(...)`

After the split:

- `toIR(...)` remains in `@teta/teta`
- AST and SQL rendering implementations move to `@teta/sql`
- direct `toSql(...)` and `toSqlResult(...)` in `@teta/teta` call `@teta/sql`
- `explain(...)` stays in `@teta/teta` as a facade, while `explainIR(...)` lives in `@teta/sql`

## Dev Package Impact

`@teta/dev` should continue to consume public package APIs only.

Its source-rendering helpers can keep using `toSql(...)` from `@teta/teta` for the convenience path. If it needs backend-only types or behavior later, it can add a direct dependency on `@teta/sql`.

## Publishing And CI

The monorepo will publish three JSR packages:

- `@teta/sql`
- `@teta/teta`
- `@teta/dev`

CI changes:

- add metadata sync checks for `packages/sql/package.json` and `packages/sql/jsr.json`
- add `check:sql`
- include `check:sql` in root `check`
- add a JSR dry-run job for `packages/sql`
- update publish workflow detection and publish job for `packages/sql`

Package dependencies:

- `@teta/teta` depends on `@teta/sql`
- `@teta/dev` depends on `@teta/teta`
- `@teta/sql` depends on SQL backend runtime dependencies such as `node-sql-parser`

## Testing Strategy

Add or update tests for:

- `@teta/sql` can render IR directly to SQL.
- `@teta/sql` can render expression IR directly to SQL.
- `@teta/sql` has no import dependency on `@teta/teta`.
- `@teta/teta toSql(query)` equals `@teta/sql irToSql(toIR(query))`.
- `@teta/teta toSqlResult(query)` preserves params.
- `explain(query)` and `explainIR(ir)` report equivalent SQL/backend metadata.
- package metadata remains in sync across all publish manifests.
- JSR publish dry-runs for all packages.

Run the full repo check after migration:

```bash
bun run check
```

## Implementation Order

1. Create `packages/sql` package metadata and public entrypoint.
2. Move IR types and SQL backend files into `packages/sql`.
3. Move backend-needed query utilities into `packages/sql`.
4. Update internal imports in `@teta/sql`.
5. Update `@teta/teta` to import IR and backend APIs from `@teta/sql`.
6. Replace frontend-owned render implementations with facades.
7. Update `@teta/dev` dependencies/import assumptions if needed.
8. Update root scripts, metadata tests, CI dry-runs, and publish workflow.
9. Update docs to describe the frontend/backend split.
10. Run focused package checks, then full `bun run check`.

## Risks

- The backend currently reaches into frontend utilities; moving those helpers incorrectly can create circular dependencies.
- Type exports may churn because current public types are re-exported from `@teta/teta`.
- `node-sql-parser` dependency ownership must move cleanly to `@teta/sql`.
- JSR publishing must avoid accidentally publishing `@teta/teta` before the new `@teta/sql` version exists.

## Planning Details

The implementation plan will choose exact helper function names inside the exported `ir` namespace. The names must stay grouped under `ir` and cover the helper categories listed in this design.

`explain(...)` remains part of `@teta/teta` as a frontend convenience facade. `@teta/sql` owns the backend implementation as `explainIR(...)`.

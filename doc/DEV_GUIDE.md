# Teta Dev Guide

This guide explains the internal structure of the EDSL and how data flows from an `ExprRef` or `Query` to final SQL.

## Mental model

Teta is split into frontend and backend packages:

1. **Frontend EDSL (`@teta/teta`)**
   - User code builds `ExprRef` trees and `Query` pipelines.
   - This layer is dialect-neutral and owns row-proxy ergonomics.

2. **Backend IR (`@teta/sql`)**
   - Expressions are stored as `ExprNode` trees.
   - Queries are stored as `source + stages + withs + column metadata`.

3. **Backend rendering (`@teta/sql`)**
   - `SqlOptions` are resolved into internal render state.
   - Expressions are rewritten for dialect language differences.
   - Query stages are lowered into a parser-compatible SQL AST.

4. **Stringification**
   - `node-sql-parser` turns the AST into SQL text.
   - Teta does final cleanup/pretty formatting.

In short:

```text
@teta/teta frontend
  -> @teta/sql IR
  -> @teta/sql SQL backend
  -> SqlResult
```

## Important files

### Backend IR

- `packages/sql/src/ir/types.ts`
  - Defines the neutral data model:
    - `ExprNode`
    - `Stage`
    - `QueryIR`
    - `CteSpec`
    - `Source`
- `packages/teta/src/edsl/core/expr/core.ts`
  - Defines `ExprRef`, `ColumnRef`, and low-level expression constructors.
- `packages/teta/src/edsl/core/expr.ts`
  - Re-exports core expression utilities.

### User-facing EDSL

- `packages/teta/src/edsl/query.ts`
  - Defines `Query` and the immutable query-building API.
   - Also defines `table(...)`, `loop(...)`, and `toIR()`, `toAst()`, `toSql(...)`.
- `packages/teta/src/edsl/expr.ts`
  - Loads expression methods and re-exports the public expression API.
- `packages/teta/src/edsl/sql/expr/*`
  - Higher-level expression operations like math, string, date, fold, array.

### Rendering

- `packages/sql/src/renderer.ts`
  - Backend render entrypoints such as `irToSql(...)`, `irToSqlResult(...)`, `exprToSql(...)`, and `explainIR(...)`.
- `packages/sql/src/render/pipeline.ts`
  - Turns a query pipeline into a parser AST.
- `packages/sql/src/render/build.ts`
  - Builds the staged CTE pipeline.
- `packages/sql/src/render/stage.ts`
  - Lowers a single `Stage` into a `SELECT` AST.
- `packages/sql/src/render/render.ts`
  - Lowers `ExprNode` values into parser expression AST nodes.
- `packages/sql/src/render/recursive.ts`
  - Materializes recursive CTEs for `loop(...)`.
- `packages/sql/src/render/union.ts`
  - Handles `UNION` / `UNION ALL` lowering.

### Dialect handling

- `packages/sql/src/dialect/resolve.ts`
  - Resolves SQL options into a concrete `QueryDialect`.
- `packages/sql/src/language.ts`
  - Applies dialect language rewrites + validation.
- `packages/sql/src/language/rewrite.ts`
  - Function renames and fallback rewrites.

## Core data structures

### `ExprNode`

`ExprNode` in `@teta/sql` is the canonical expression IR.

It includes nodes like:

- `column`
- `literal`
- `binary`
- `unary`
- `agg`
- `func`
- `window`
- `case`
- `cast`
- `extract`
- `array`
- `list`

`ExprRef<T>` is just a typed wrapper around an `ExprNode<T>`.

### `Query`

A `Query<TColumns>` in `packages/teta/src/edsl/query.ts` stores:

- `source`
- `stages`
- `columns`
- `columnNames`
- `withs`

The important part is that query-building is **immutable**: each helper function returns a new `Query` with another stage appended or merged. `toIR(query)` lowers that frontend object into the backend `QueryIR` shape consumed by `@teta/sql`.

### `Stage`

A query pipeline is a list of `Stage` values:

- `map`
- `fold`
- `filter`
- `sort`
- `take`
- `join`
- `union`

This stage list is the main query IR that the render pipeline lowers later.

## Flow: from `ExprRef` to final SQL

Take something like:

```ts
const expr = characterLength(replace(user.name, " ", "_"))
const result = toSql(expr, { dialect: "sqlite" })
```

### 1) Expression construction

Expression helpers build nested `ExprNode` values.

For example:

- function helpers from `src/edsl/sql/expr/ops/*`
- builders from `src/edsl/sql/expr/builders.ts`
- low-level constructors in `packages/teta/src/edsl/core/expr/core.ts`

Eventually everything becomes an `ExprRef` containing an `ExprNode` tree.

### 2) `toSql(expr, options)` and `toSqlResult(expr, options)`

Rendering stays function-first:

```text
expr -> toSql(expr, options) -> @teta/sql exprToSql(expr, options)
expr -> toSqlResult(expr, options) -> @teta/sql exprToSqlResult(expr, options)
```

The expression object itself does not render anything.

### 3) Render state setup

`exprToSql(...)` and `exprToSqlResult(...)` in `packages/sql/src/renderer.ts`:

- resolve dialect options through `buildSqlOptions(...)`
- build internal state with:
  - parser instance
  - resolved dialect
  - parser options
  - output format

### 4) Dialect language rewrite

For expressions, the render path calls `applyDialectLanguage(...)` from `packages/sql/src/language.ts`.

That step:

- renames functions for the target dialect
- expands fallbacks when a dialect does not support a function directly
- validates unsupported functions early

Examples:

- `CHARACTER_LENGTH` may map to `LENGTH`
- `BIT_LENGTH` may expand into a fallback expression

### 5) Expression AST lowering

`exprToAst(...)` in `packages/sql/src/render/render.ts` converts `ExprNode` into the AST shape expected by `node-sql-parser`.

Examples:

- `binary` -> `binary_expr`
- `func` -> `function`
- `column` -> `column_ref`
- `cast` -> `cast`
- `window` -> function + `over`

### 6) Final SQL string

The render path then:

- calls `parser.exprToSQL(...)`
- runs `stripRedundantQuotes(...)`
- applies `formatSqlPretty(...)` if requested

The final return value is:

```ts
{
  sql: string,
  params: []
}
```

Built-in renderers populate `params` when the query contains `param(...)` placeholders.

Rule of thumb:

- use `toSql(...)` by default
- use `toSqlResult(...)` only when you need `params` or other structured render metadata

## Flow: from `Query` to final SQL

Take something like:

```ts
const q = pipe(
  users,
  filter((u) => eq(u.active, true)),
  map((u) => ({ id: u.id, name: u.name })),
  sort((u) => asc(u.name))
)

const result = toSql(q, { dialect: "postgresql", format: "pretty" })
```

### 1) `table(...)` creates the base query

`table(...)` in `packages/teta/src/edsl/query.ts`:

- parses the table name
- creates column proxies with `createColumnRefs(...)`
- creates a `Query` with:
  - source table
  - empty `stages`
  - explicit `columnNames`

### 2) Query helpers append stages

Each query helper returns a new `Query` (or a `QueryStep` in data-last form).

Examples:

- `map(...)`
  - evaluates the selector
  - converts each selected value with `toExprNode(...)`
  - creates a `map` stage
- `fold(...)`
  - unwraps `group(...)` markers
  - builds a `fold` stage + `groupBy`
- `filter(...)`
  - stores a predicate expression
  - merges adjacent filters with `AND`
- `sort(...)`
  - stores order items
- `take(...)`
  - stores the limit count
- fixed join helpers
  - stores join metadata + join predicate + output projection
- `union(...)`
  - stores the right-hand query spec as a `union` stage

At this point no SQL text exists yet.

### 3) `toIR(query)` and `toAst(query)`

Useful checkpoints:

- `toIR(query)` returns the backend-renderable query representation:
  - `{ source, stages, scopeId, columnNames, columnIdentifiers, withs }`
- `toAst(query)` delegates to `@teta/sql irToAst(...)`
  - this gives the parser AST before final SQL stringification
- `explain(query, ...)` bundles IR, AST, SQL, params, stage metadata, and CTE metadata in one snapshot

In practice, `explain(query, ...)` is usually the fastest debugging entrypoint, with `toIR(query)` and `toAst(query)` as lower-level follow-ups.

### 4) `toSql(query, options)` and `toSqlResult(query, options)`

Like expressions, query rendering stays function-first:

```text
query -> toSql(query, options) -> irToSql(toIR(query), options)
query -> toSqlResult(query, options) -> irToSqlResult(toIR(query), options)
```

The real lowering happens in `packages/sql/src/renderer.ts`.

### 5) Query pipeline rendering

`renderQueryIRTarget(...)` calls `renderPipelineAst(...)` in `packages/sql/src/render/pipeline.ts`.

That function:

- materializes base CTEs from `query.withs`
- builds the pipeline AST from `source + stages`
- returns a parser-compatible `AST`

### 6) Building the staged CTE pipeline

`buildPipelineAst(...)` in `packages/sql/src/render/build.ts` is the central query-lowering step.

Behavior:

- **No stages**
  - render a direct `SELECT` from the base table
- **With stages in `readable` mode**
  - non-final stages are preserved as named CTEs like `cte_0`, `cte_1`, ...
  - the final stage becomes the outer query
- **With stages in `optimized` mode**
  - compatible stages may be fused into a smaller SQL shape, sometimes a single `SELECT`

This is why generated SQL may look like a flat `SELECT`, a staged `WITH` pipeline, or a mix with derived-table barriers.

### 6a) Common lowering patterns

A few patterns show up repeatedly when you inspect `explain(query, ...)`, `toIR(query)`, or `toAst(query)`:

- **optimized render strategy**
  - adjacent stages are fused when they can share one `SELECT`
  - a `filter -> select -> limit` chain may render with no `WITH` at all
- **readable render strategy**
  - non-final stages are preserved as `cte_0`, `cte_1`, ...
  - use this when you want SQL to track the builder pipeline more literally
- **derived-table barriers**
  - some operations must be wrapped in a nested query boundary to preserve scope
  - common examples are window filters on dialects without `QUALIFY`, or order/limit that must remain outside a barrier
- **recursive lowering**
  - `loop(...)` materializes through recursive CTE compilation rather than a plain stage chain

This is why the same logical query may render as a flat `SELECT`, a staged `WITH` pipeline, or a nested derived table depending on dialect features and render strategy.

### 7) Lowering each stage

`compileStageAst(...)` in `packages/sql/src/render/stage.ts` turns one `Stage` into one `SELECT` AST.

Per stage kind:

- `map` / `fold`
  - writes projected columns
  - `fold` optionally writes `GROUP BY`
- `filter`
  - writes `WHERE`
- `sort`
  - writes `ORDER BY`
- `take`
  - writes `LIMIT`
- `join`
  - builds joined `FROM` entries
  - handles lateral joins
  - handles subquery joins
- `union`
  - handled elsewhere by `renderPipelineAst(...)` + `packages/sql/src/render/union.ts`

### 8) Expression qualification inside queries

Before expressions become AST, the render layer normalizes column references.

Scope binding in `packages/sql/src/render/render_scope.ts` does three things:

1. strips table refs when safe
2. fills in missing table refs with the current base alias
3. applies dialect language rewrite

This is the key bridge between neutral expression IR and query-local SQL names.

### 9) Joins, unions, and recursive CTEs

#### Join subqueries

`hoistJoinSubquery(...)` in `packages/sql/src/render/source_join.ts` can hoist a non-lateral join subquery into a CTE before rendering the join.

#### Unions

`packages/sql/src/render/union.ts` builds left and right sides separately, then attaches them with `UNION` / `UNION ALL`.

#### Recursive CTEs

`loop(...)` in `packages/teta/src/edsl/query.ts` does not emit SQL directly.
It creates a deferred recursive `CteSpec`.

Later, `materializeCte(...)` and `buildRecursiveCte(...)` in `packages/sql/src/render/recursive_cte.ts` turn that into a recursive `WITH` entry.

### 10) Final AST fixes and stringification

After `renderPipelineAst(...)`, the render path:

1. runs `applyDialectFixes(...)`
2. calls `parser.sqlify(...)`
3. strips redundant identifier quotes
4. optionally pretty-prints

That becomes the final `SqlResult`.

## Dialect information flow

Dialect data is resolved once per render call.

### Resolution

`buildSqlOptions(...)` in `packages/sql/src/dialect/resolve_options.ts` turns SQL options into:

- `QueryDialect`
- parser options
- `sqlFormat`

### Use sites

That resolved dialect is then used in three places:

1. **language rewrite**
   - function renaming / fallback expansion
2. **feature checks**
   - e.g. recursive CTE support, lateral join keyword support
3. **parser stringification options**
   - parser dialect name passed to `node-sql-parser`

## Good debugging checkpoints

When something looks wrong, inspect from top to bottom:

1. `ExprRef.node`
   - is the expression tree what you expect?
2. `toIR(query)`
   - are the stages right?
3. `toAst(query)`
   - did the stage lowering produce the right parser AST?
4. `irToAst(toIR(query), options)` or `@teta/sql` renderer internals
   - is the CTE pipeline shaped correctly?
5. `applyDialectLanguage(...)`
   - is a function being renamed or expanded unexpectedly?
6. final `SqlResult.sql`
   - if AST is correct but text is odd, the issue is likely in parser output cleanup/formatting

### Compare dialect rewrites with `explain()`

A fast way to isolate dialect issues is to render the same query twice:

- `explain(query, { dialect: "postgresql" })`
- `explain(query, { dialect: "sqlite" })`

Interpret the differences like this:

- if `ir` and `stages` match but `sql` differs, the change is usually dialect language mapping, fallback rewrite, or final formatting
- if `ast` shape changes, dialect feature support likely changed the lowering path itself
- if `ctes` differ, check whether recursive CTEs, hoisted joins, or readable-stage preservation were introduced
- if `ir` already differs, the bug is earlier in query construction rather than in SQL rendering

## If you want to extend the system

### Add a new expression helper

Usually touch:

- `packages/teta/src/edsl/sql/expr/ops/*`
- if needed, `packages/sql/src/ir/types_expr.ts` for a new node kind
- `packages/sql/src/render/expr_ast.ts` to lower that node kind
- `packages/sql/src/language/rewrite.ts` if dialect mapping/fallback is needed

### Add a new query operation

Usually touch:

- `packages/sql/src/ir/types_query.ts` to add a new `Stage`
- `packages/teta/src/edsl/query.ts` to build that stage
- `packages/sql/src/render/stage.ts` and/or `packages/sql/src/render/build.ts` to lower it

### Add dialect behavior

Usually touch:

- `packages/sql/src/dialect/*`
- `packages/sql/src/language/config.ts`
- `packages/sql/src/language/rewrite.ts`

## Short summary

The most important idea is:

- **EDSL building is neutral**
- **rendering is where dialect behavior happens**

So the main flow is:

```text
@teta/teta ExprRef / Query
  -> @teta/sql ExprNode / QueryIR
  -> @teta/sql buildSqlOptions(...) + internal render state
  -> @teta/sql dialect rewrite + qualification
  -> node-sql-parser AST
  -> sqlify / exprToSQL
  -> SqlResult
```

If you keep that split in mind, most of the codebase becomes much easier to navigate.

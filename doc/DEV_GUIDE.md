# Teta Dev Guide

This guide explains the internal structure of the EDSL and how data flows from an `ExprRef` or `Query` to final SQL.

## Mental model

Teta is split into a few clean layers:

1. **EDSL construction**
   - User code builds `ExprRef` trees and `Query` pipelines.
   - This layer is dialect-neutral.

2. **Neutral IR**
   - Expressions are stored as `ExprNode` trees.
   - Queries are stored as `source + stages + withs`.

3. **Rendering**
   - A `SqlRenderer` resolves dialect + formatting.
   - Expressions are rewritten for dialect language differences.
   - Query stages are lowered into a parser-compatible SQL AST.

4. **Stringification**
   - `node-sql-parser` turns the AST into SQL text.
   - Teta does final cleanup/pretty formatting.

In short:

```text
ExprRef / Query
  -> neutral IR
  -> dialect-aware render pass
  -> node-sql-parser AST
  -> SQL string
  -> SqlResult
```

## Important files

### Core IR

- `src/edsl/core/types.ts`
  - Defines the neutral data model:
    - `ExprNode`
    - `Stage`
    - `QueryIR`
    - `CteSpec`
    - `Source`
- `src/edsl/core/expr/core.ts`
  - Defines `ExprRef`, `ColumnRef`, and low-level expression constructors.
- `src/edsl/core/expr.ts`
  - Re-exports core expression utilities.

### User-facing EDSL

- `src/edsl/query.ts`
  - Defines `Query` and the immutable query-building API.
  - Also defines `table(...)`, `loop(...)`, and `toIR()`, `toAst()`, `toSql(...)`.
- `src/edsl/expr.ts`
  - Loads expression methods and re-exports the public expression API.
- `src/edsl/sql/expr/*`
  - Higher-level expression operations like math, string, date, fold, array.

### Rendering

- `src/edsl/sql/renderer.ts`
  - Main render entrypoint.
  - Exposes `sqlRenderer(...)` and dialect-specific helpers like `duckdbRenderer(...)`.
- `src/edsl/sql/render/pipeline.ts`
  - Turns a query pipeline into a parser AST.
- `src/edsl/sql/render/build.ts`
  - Builds the staged CTE pipeline.
- `src/edsl/sql/render/stage.ts`
  - Lowers a single `Stage` into a `SELECT` AST.
- `src/edsl/sql/render/render.ts`
  - Lowers `ExprNode` values into parser expression AST nodes.
- `src/edsl/sql/render/recursive.ts`
  - Materializes recursive CTEs for `loop(...)`.
- `src/edsl/sql/render/union.ts`
  - Handles `UNION` / `UNION ALL` lowering.

### Dialect handling

- `src/edsl/sql/dialect/resolve.ts`
  - Resolves renderer options into a concrete `QueryDialect`.
- `src/edsl/sql/language.ts`
  - Applies dialect language rewrites + validation.
- `src/edsl/sql/language/rewrite.ts`
  - Function renames and fallback rewrites.

## Core data structures

### `ExprNode`

`ExprNode` in `src/edsl/core/types.ts` is the canonical expression IR.

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

A `Query<TColumns>` in `src/edsl/query.ts` stores:

- `source`
- `stages`
- `columns`
- `columnNames`
- `withs`

The important part is that query-building is **immutable**: each helper function returns a new `Query` with another stage appended or merged.

### `Stage`

A query pipeline is a list of `Stage` values:

- `map`
- `fold`
- `filter`
- `sort`
- `take`
- `join`
- `union`

This stage list is the main query IR that the renderer lowers later.

## Flow: from `ExprRef` to final SQL

Take something like:

```ts
const expr = characterLength(replace(user.name, " ", "_"))
const result = toSql(expr, sqlRenderer({ dialect: "sqlite" }))
```

### 1) Expression construction

Expression helpers build nested `ExprNode` values.

For example:

- function helpers from `src/edsl/sql/expr/ops/*`
- builders from `src/edsl/sql/expr/builders.ts`
- low-level constructors in `src/edsl/core/expr/core.ts`

Eventually everything becomes an `ExprRef` containing an `ExprNode` tree.

### 2) `toSql(expr, renderer)` and `toSqlResult(expr, renderer)`

Rendering stays function-first:

```text
expr -> toSql(expr, renderer) -> renderSql(expr, renderer)
expr -> toSqlResult(expr, renderer) -> renderSqlResult(expr, renderer)
```

The expression object itself does not render anything.

### 3) Renderer setup

`sqlRenderer(...)` in `src/edsl/sql/renderer.ts`:

- resolves dialect options through `buildSqlOptions(...)`
- stores:
  - parser instance
  - resolved dialect
  - parser options
  - output format

### 4) Dialect language rewrite

For expressions, the renderer calls `applyDialectLanguage(...)` from `src/edsl/sql/language.ts`.

That step:

- renames functions for the target dialect
- expands fallbacks when a dialect does not support a function directly
- validates unsupported functions early

Examples:

- `CHARACTER_LENGTH` may map to `LENGTH`
- `BIT_LENGTH` may expand into a fallback expression

### 5) Expression AST lowering

`exprToAst(...)` in `src/edsl/sql/render/render.ts` converts `ExprNode` into the AST shape expected by `node-sql-parser`.

Examples:

- `binary` -> `binary_expr`
- `func` -> `function`
- `column` -> `column_ref`
- `cast` -> `cast`
- `window` -> function + `over`

### 6) Final SQL string

The renderer then:

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

const result = toSql(q, sqlRenderer({ dialect: "postgresql", format: "pretty" }))
```

### 1) `table(...)` creates the base query

`table(...)` in `src/edsl/query.ts`:

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
- `join(...)`
  - stores join metadata + join predicate + output projection
- `union(...)`
  - stores the right-hand query spec as a `union` stage

At this point no SQL text exists yet.

### 3) `toIR(query)` and `toAst(query)`

Useful checkpoints:

- `toIR(query)` returns the neutral query representation:
  - `{ source, stages }`
- `toAst(query)` calls `renderPipelineAst(...)`
  - this gives the parser AST before final SQL stringification
- `explain(query, ...)` bundles IR, AST, SQL, params, stage metadata, and CTE metadata in one snapshot

In practice, `explain(query, ...)` is usually the fastest debugging entrypoint, with `toIR(query)` and `toAst(query)` as lower-level follow-ups.

### 4) `toSql(query, renderer)` and `toSqlResult(query, renderer)`

Like expressions, query rendering stays function-first:

```text
query -> toSql(query, renderer) -> renderSql(query, renderer)
query -> toSqlResult(query, renderer) -> renderSqlResult(query, renderer)
```

The real lowering happens in `src/edsl/sql/renderer.ts`.

### 5) Query pipeline rendering

`renderQueryTarget(...)` calls `renderPipelineAst(...)` in `src/edsl/sql/render/pipeline.ts`.

That function:

- materializes base CTEs from `query.withs`
- builds the pipeline AST from `source + stages`
- returns a parser-compatible `AST`

### 6) Building the staged CTE pipeline

`buildPipelineAst(...)` in `src/edsl/sql/render/build.ts` is the central query-lowering step.

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

`compileStageAst(...)` in `src/edsl/sql/render/stage.ts` turns one `Stage` into one `SELECT` AST.

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
  - handled elsewhere by `renderPipelineAst(...)` + `src/edsl/sql/render/union.ts`

### 8) Expression qualification inside queries

Before expressions become AST, the render layer normalizes column references.

`qualifyForBase(...)` in `src/edsl/sql/render/render.ts` does three things:

1. strips table refs when safe
2. fills in missing table refs with the current base alias
3. applies dialect language rewrite

This is the key bridge between neutral expression IR and query-local SQL names.

### 9) Joins, unions, and recursive CTEs

#### Join subqueries

`hoistJoinSubquery(...)` in `src/edsl/sql/render/source.ts` can hoist a non-lateral join subquery into a CTE before rendering the join.

#### Unions

`src/edsl/sql/render/union.ts` builds left and right sides separately, then attaches them with `UNION` / `UNION ALL`.

#### Recursive CTEs

`loop(...)` in `src/edsl/query.ts` does not emit SQL directly.
It creates a deferred recursive `CteSpec`.

Later, `materializeCte(...)` and `buildRecursiveCte(...)` in `src/edsl/sql/render/recursive.ts` turn that into a recursive `WITH` entry.

### 10) Final AST fixes and stringification

After `renderPipelineAst(...)`, the renderer:

1. runs `applyDialectFixes(...)`
2. calls `parser.sqlify(...)`
3. strips redundant identifier quotes
4. optionally pretty-prints

That becomes the final `SqlResult`.

## Dialect information flow

Dialect data is resolved once per renderer.

### Resolution

`buildSqlOptions(...)` in `src/edsl/sql/dialect/resolve.ts` turns renderer options into:

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
4. `renderPipelineAst(...)`
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

- `src/edsl/sql/expr/ops/*`
- maybe `src/edsl/sql/expr/methods/*`
- if needed, `src/edsl/core/types.ts` for a new node kind
- `src/edsl/sql/render/render.ts` to lower that node kind
- `src/edsl/sql/language/rewrite.ts` if dialect mapping/fallback is needed

### Add a new query operation

Usually touch:

- `src/edsl/core/types.ts` to add a new `Stage`
- `src/edsl/query.ts` to build that stage
- `src/edsl/sql/render/stage.ts` and/or `src/edsl/sql/render/build.ts` to lower it

### Add dialect behavior

Usually touch:

- `src/edsl/sql/dialect/*`
- `src/edsl/sql/language/config.ts`
- `src/edsl/sql/language/rewrite.ts`

## Short summary

The most important idea is:

- **EDSL building is neutral**
- **rendering is where dialect behavior happens**

So the main flow is:

```text
ExprRef / Query
  -> ExprNode / Stage[] / CteSpec[]
  -> sqlRenderer(...)
  -> dialect rewrite + qualification
  -> parser AST
  -> sqlify / exprToSQL
  -> SqlResult
```

If you keep that split in mind, most of the codebase becomes much easier to navigate.

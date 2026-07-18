# Design Philosophy

Teta is an opinionated SQL EDSL. This document explains the design choices and the reasoning behind them.

## Core principles

### 1. Function-first, not method-chaining

```ts
// Teta style: functions composed with pipe()
const q = pipe(
  users,
  filter((u) => eq(u.active, true)),
  map((u) => ({ id: u.id, name: u.name })),
  take(10),
);

// Not the builder-pattern style:
// const q = users.where("active", true).select("id", "name").limit(10);
```

**Why:** Function composition is more composable than method chains. Every query step (`filter`, `map`, `sort`, `distinct`, `take`) is a standalone, callable value — you can assign it to a variable, pass it to a higher-order function, test it in isolation, and compose it with `flow()`.

```ts
// Reusable, testable, composable
const activeAndNamed = flow(
  filter((u) => eq(u.active, true)),
  map((u) => ({ name: u.name })),
);

const q1 = activeAndNamed(users);
const q2 = activeAndNamed(admins);
```

Method chaining ties operations to a single builder instance. Function composition lets steps live independently.

### 2. Dialect-neutral construction, dialect-aware rendering

Query construction knows nothing about SQL dialects. `filter()`, `map()`,
`join()` — none of these mention PostgreSQL or SQLite. They build a
frontend-owned logical plan. `toIR(...)` then lowers that plan into the
portable backend IR.

Dialect behavior happens at render time:

```ts
// Build a dialect-neutral query
const q = pipe(users, map((u) => ({ name_len: charLength(u.name) })));

// Render for different targets
toSql(q, { dialect: "postgresql" }); // CHAR_LENGTH(name)
toSql(q, { dialect: "sqlite" });     // LENGTH(name)   ← auto-mapped
```

**Why:** Separation of concerns. Query logic should not be coupled to a
specific database engine. A query can target multiple supported engines, while
the capability matrix still makes dialect differences explicit.

The dialect system handles:
- Function name mapping (`CHARACTER_LENGTH` → `LENGTH` on SQLite)
- Expression fallbacks (`BIT_LENGTH` → `LENGTH(x) * 8` on SQLite)
- Feature checks (omit `LATERAL` keyword on SQLite)

### 3. Type-safe, not string-safe

Teta tracks SQL value types through branded types, not through tagged template literals or raw strings.

```ts
// Every column has a typed expression:
// u.id:   Expr<SqlInt>
// u.name: Expr<SqlString>

// Expressions compose with type checks:
eq(u.id, u.name);   // ✗ TypeScript error: SqlInt ≠ SqlString
eq(u.id, 42);       // ✓ Numeric literal normalized to SqlNumber
eq(u.id, "hello");  // ✗ TypeScript error: SqlInt vs string
```

**Why:** If your query makes no sense at the SQL level, Teta wants you to know at compile time, not when the database returns an error. Branded types (`SqlInt`, `SqlString`, `SqlTimestamp`, etc.) let TypeScript distinguish values that JavaScript would treat identically at runtime (e.g., a timestamp column and a plain text column are both `string`).

### 4. Immutable pipelines with explicit failure

Every query step returns a new `Query` value. Nothing is mutated.

```ts
const filtered = pipe(users, filter((u) => eq(u.active, true)));
// users is unchanged. filtered is a new Query.
```

**Why:** Immutability makes queries predictable, debuggable, and safe to share. You can build a base query and branch off variations without worrying about side effects:

```ts
const base = pipe(users, filter((u) => eq(u.active, true)));

const byName = pipe(base, sort((u) => asc(u.name)));
const byAge = pipe(base, sort((u) => asc(u.age)));
// Both share the same base filter — no accidental mutation.
```

"Pure" describes construction and state flow: helpers do not mutate their
inputs, renderer state is passed explicitly, and the same valid inputs produce
the same query or SQL. It does not mean every public helper is total. Invalid
schemas, selectors, parameter values, and unsupported operations throw
descriptive user errors at the API boundary.

### 5. Queries are opaque, not transparent

A `Query<T>` only exposes `kind` and `columns`. Everything else (sources, stages, CTEs, generated aliases) is hidden behind a package-private symbol.

```ts
const q = pipe(users, filter((u) => eq(u.active, true)));

q.kind;     // "query"
q.columns;  // { id: Column<...>, name: Column<...>, ... }

// q.stages     ← does not exist
// q.source     ← does not exist
// q.columnNames ← does not exist
```

**Why:** Opaqueness is an API contract. It means the internal compiler state can evolve without breaking user code. When you need to inspect the internals, use the intentional escape hatches:

```ts
explain(q, { dialect: "postgresql" });  // stages, ctes, sql, params
toIR(q);                                 // lowered intermediate representation
import { toAst } from "@teta/teta/inspect";
toAst(q, { dialect: "postgresql" });    // explicit parser AST inspection
```

### 6. Explicitly layered architecture

```
@teta/teta (EDSL + logical plan)
    ↓ toIR(...)
portable @teta/sql IR
    ↓
@teta/sql (dialect resolution + rendering)
    ↓
node-sql-parser (AST → SQL string)
```

**Why:** Each layer is independently testable, replaceable, and inspectable. The frontend (`@teta/teta`) can evolve its ergonomics without touching the renderer. The renderer (`@teta/sql`) can add dialect features without changing the frontend API. A custom frontend could target the same IR.

### 7. `fold()` instead of `GROUP BY`

Teta doesn't have a separate `groupBy` step. Grouping happens inside `fold()`, the aggregate projection:

```ts
// Teta: grouping is part of the projection
pipe(
  orders,
  fold((o) => ({
    user_id: group(o.user_id),    // ← mark as grouping key
    count: count(o.id),           // ← aggregate
  })),
);

// Not: users.groupBy("user_id").select({ count: count("id") })
```

**Why:** In SQL, `GROUP BY` and aggregate `SELECT` are conceptually one operation — you project an aggregated row shape, and the database groups by the non-aggregated columns. Teta models this as `fold()`: a projection where every returned expression is either a grouped key or an aggregate. This is enforced at the type level — plain row expressions are rejected inside `fold()`.

### 8. No implicit star-select

`table(...)` requires an explicit schema. There is no `table("users")` without column definitions.

```ts
// Always explicit:
const users = table("users", {
  id: t.int(),
  name: t.string(),
  age: t.int(),
});
```

**Why:** `SELECT *` is a common source of bugs in production — adding a column to a table silently changes query behavior. By requiring explicit schemas, Teta makes column selection explicit and traceable. The schema also powers the type inference that gives you autocomplete and type checking throughout the pipeline.

### 9. Callback-based column access

Column references use typed callbacks, not string literals:

```ts
// Teta: typed callback
filter((u) => gte(u.age, 18));
map((u) => ({ id: u.id, name: u.name }));

// Not: filter("age", ">=", 18) or .where({ age: { gte: 18 } })
```

**Why:** Callbacks give you:
- Autocomplete on column names
- Compile-time checks on expressions
- Type-safe composition of expressions
- IDE-renamable column references (when you rename a schema field, all usages update)

The row parameter type is inferred from the current query shape, so `u` in `filter((u) => ...)` has the exact type of the columns available at that point in the pipeline.

### 10. Runtime type descriptors and prepared parameters

`t.int()`, `t.uuid()`, and the other schema helpers are runtime descriptors,
not phantom tags. Each `SqlType<Expression, Input, Output>` connects the SQL
expression domain to a driver-facing input and decoded output, with
`encode(...)` and `decode(...)` at runtime.

`prepare(schema, build)` uses the same descriptors to construct typed
parameter expressions:

```ts
const byUserCriteria = prepare(
  { userId: t.int(), minimumAge: t.int() },
  (params) => pipe(
    users,
    filter((u) => eq(u.id, params.userId)),
    filter((u) => gte(u.age, params.minimumAge)),
  ),
);
```

**Why:** A caller-selected generic placeholder could claim any SQL type without runtime
evidence and left bindings as an unrelated dictionary. Prepared queries tie
declaration, expression use, runtime validation, and exact binding keys to one
schema. `param(name, type)` remains the explicit low-level escape hatch.

## Trade-offs

### Verbose schemas vs. quick prototyping

Schemas must be defined upfront. This is more ceremony than inline SQL strings, but the payoff is type safety across the entire query pipeline and protection against star-select bugs.

### Generated SQL shape vs. hand-written SQL

Teta generates auto-aliased, fully-qualified SQL with a CTE pipeline structure. This is more verbose than hand-written SQL but is deterministic, predictable, and avoids SQL injection by construction. Use `renderStrategy: "readable"` when you want the staged pipeline to be visible, or `renderStrategy: "optimized"` for a more compact shape.

### Type overhead vs. string-based builders

Branded types add some TypeScript ceremony (especially when extracting reusable helpers). The trade-off is that type errors surface at compile time rather than at runtime.

## What Teta is not

- **Not an ORM.** Teta doesn't manage connections, execute queries, or map results back to objects. It's a query builder that outputs SQL strings.
- **Not a migration tool.** Teta doesn't create or modify database schemas.
- **Not a general data-validation library.** Descriptors validate their runtime
  scalar/container shape, but `t.json<T>()` cannot validate an arbitrary
  TypeScript payload type without an application-supplied schema.

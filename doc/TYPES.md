# Teta Types Guide

This guide explains the main TypeScript types you will see while using Teta's EDSL.

If you are looking for compiler-internal IR types such as `ExprNode`, `Stage`, or `QuerySpec`, see `doc/DEV_GUIDE.md`.

## Quick mental model

Teta's type story is easiest to understand in four layers:

1. `t.*` declares column types for a schema.
2. `table(...)` and `values(...)` produce `Query<TColumns>`.
3. query callbacks receive typed expression values and return new query shapes.
4. render helpers use SQL-focused types such as `SqlOptions`, `SqlResult`, and `SqlRenderable`.

In practice, you usually let TypeScript infer everything and only annotate types at API boundaries or when extracting reusable helpers.

## 1) Schema types with `t`

Use `t.*` helpers only when declaring schemas. Table schemas must be non-empty objects and are restricted to SQL row values: SQL primitives, nullable SQL primitives, SQL JSON/bytes values, and SQL arrays. Arbitrary host objects should be encoded with `t.json<T>()` rather than used as plain column values.

```ts
import { table, t } from "@teta/teta";

const users = table("users", {
  id: t.int(),
  email: t.string(),
  age: t.int(),
  active: t.boolean(),
  created_at: t.timestamp(),
  deleted_at: t.nullable(t.timestamp()),
  tags: t.array(t.string()),
  profile: t.json<{ theme: string; locale: string }>(),
});
```

That gives you a query with this inferred shape:

```ts
// Query<{
//   id: SqlInt;
//   email: SqlString;
//   age: SqlInt;
//   active: SqlBoolean;
//   created_at: SqlTimestamp;
//   deleted_at: SqlTimestamp | null;
//   tags: SqlString[];
//   profile: SqlJson<{ theme: string; locale: string }>;
// }>
```

Common schema helpers:

- `t.string()` -> `SqlString`
- `t.boolean()` -> `SqlBoolean`
- `t.int()` -> `SqlInt`
- `t.float()` -> `SqlFloat`
- `t.bigint()` -> `SqlBigInt`
- `t.decimal()` -> `SqlDecimal`
- `t.date()` -> `SqlDate`
- `t.timestamp()` -> `SqlTimestamp`
- `t.uuid()` -> `SqlUuid`
- `t.bytes()` -> `SqlBytes`
- `t.json<T>()` -> `SqlJson<T>`
- `t.array(inner)` -> `T[]`
- `t.nullable(inner)` -> `T | null`

## 2) `Query<TColumns>` is the row shape

`Query<TColumns>` means: "a query that currently exposes one row shaped like `TColumns`".

The key rule is that each query helper either preserves that shape or replaces it.

At runtime, a query is intentionally opaque. Public code should use:

- `query.kind` to identify the value as a query-like EDSL value
- `query.columns` when reusing column expressions outside a callback
- `toIR(query)` or `explain(query, ...)` when inspecting lowered sources, stages, CTEs, and output columns

Do not depend on internal fields such as `source`, `stages`, `columnNames`, `withs`, or name-supply counters being present on the query object. Those are internal compiler state and may change without affecting the public row type.

### Shape-preserving helpers

These keep the same `TColumns`:

- `filter(...)`
- `sort(...)`
- `take(...)`

```ts
import { eq, filter, pipe } from "@teta/teta";

const activeUsers = pipe(users, filter((user) => eq(user.active, true)));
// still Query<{ id, email, age, active, created_at, deleted_at, tags, profile }>
```

### Shape-replacing helpers

These create a new `TColumns` from the object you return:

- `map(...)`
- `fold(...)`

```ts
import { map, pipe } from "@teta/teta";

const publicUsers = pipe(
  users,
  map((user) => ({
    id: user.id,
    email: user.email,
  }))
);
// Query<{ id: SqlInt; email: SqlString }>
```

With `fold(...)`, the returned object also becomes the new row shape, but it must be grouped or aggregated output. Plain row expressions such as `user.id` are rejected in `fold(...)`; wrap grouping keys with `group(...)` or `groupShape(...)`, and use aggregate helpers for measures.

```ts
import { count, fold, group, pipe } from "@teta/teta";

const userCounts = pipe(
  users,
  fold((user) => ({
    active: group(user.active),
    total: count(user.id),
  }))
);
```

`fold(...)` uses a phantom expression phase internally. `group(...)` marks an expression as a grouping key and aggregate helpers mark expressions as aggregate outputs. This is type-only metadata and does not change the runtime expression object or generated SQL.

### Shape-merging helpers

`join(...)` combines the left and right query shapes.

- `inner` join keeps both sides as-is
- `left` join makes right-side columns nullable
- `right` join makes left-side columns nullable
- `full` join makes both sides nullable

The frontend join type is exported as `JoinKind` and is intentionally lowercase-only. `JoinOptions<T>` is available when typing reusable join helper wrappers.

```ts
import {
  dropOverlapLeft,
  join,
  onEq,
  prefixOverlapLeft,
  table,
  t,
  pipe,
} from "@teta/teta";

const orders = table("orders", {
  id: t.int(),
  user_id: t.int(),
  total: t.float(),
});

const usersWithOrders = pipe(
  users,
  join(orders, {
    type: "left",
    on: onEq({ id: "user_id" }),
    select: dropOverlapLeft(),
  })
);
// order columns are inferred as nullable because this is a left join
```

`join(...)` is the primitive join step. Default joins only infer a merged shape when the left and right output names do not overlap. If names overlap, use `select` with an explicit merge helper such as `dropOverlapLeft()` or `prefixOverlapLeft("left_")`. Fixed helpers such as `leftJoinMerge(right, on, dropOverlapLeft())` remain available as wrappers around `join(...)`.

```ts
const profiles = table("profiles", {
  user_id: t.int(),
  id: t.int(),
  bio: t.string(),
});

const renamed = pipe(
  users,
  join(profiles, {
    type: "left",
    on: onEq({ id: "user_id" }),
    select: prefixOverlapLeft("left_"),
  })
);
```

### Shape-extending helpers

`unnest(...)` keeps the original columns and adds generated ones.

```ts
import { unnest } from "@teta/teta";

const usersByTag = pipe(users, unnest((user) => user.tags, {
  value: "tag",
  ordinality: "tag_index",
}));
// original user columns + { tag: SqlString, tag_index: SqlInt }
```

### Set operations

`union(...)` and `unionAll(...)` require both sides to have the same row shape and compatible SQL value types, then return that same shape.

## 3) `Expr<T>` is the expression type

Inside query callbacks, columns are typed expression values.

- `user.id` is not a plain `number`; it is an expression with type `Expr<SqlInt>`
- `user.email` is `Expr<SqlString>`
- `user.deleted_at` is `Expr<SqlTimestamp | null>`

This is why expression helpers compose safely: `eq(...)`, `add(...)`, `upper(...)`, `dateTrunc(...)`, and others all operate on typed expressions, not raw SQL strings.

Most of the time you do not need to annotate `Expr<T>` yourself. It becomes useful when extracting reusable expression helpers.

```ts
import { type Expr, type SqlInt, gte } from "@teta/teta";

function isAdult(age: Expr<SqlInt>) {
  return gte(age, 18);
}
```

Then use it in a query:

```ts
import { filter, pipe } from "@teta/teta";

const adults = pipe(users, filter((user) => isAdult(user.age)));
```

The important idea is that Teta tracks the SQL value type carried by an expression, and TypeScript keeps that information all the way through your query pipeline.

Expression types also carry an optional phantom phase parameter used by aggregate projections:

```ts
// Most user code only needs Expr<T>.
type RowExpr = Expr<SqlInt>;

// Advanced helpers may mention the phase explicitly.
type GroupedExpr = Expr<SqlInt, "group">;
```

## 4) Branded SQL primitives

Teta uses branded types to distinguish SQL-oriented values that share the same JavaScript runtime representation.

For example:

- `SqlInt`, `SqlFloat`, and `SqlDecimal` are all numeric at runtime
- `SqlString`, `SqlDate`, `SqlTimestamp`, and `SqlUuid` are all string-based at runtime
- `SqlBoolean` is boolean at runtime
- `SqlJson<T>` keeps your JSON payload type attached to the expression

These brands exist only at type-check time. At runtime:

- `SqlInt` behaves like a `number`
- `SqlBigInt` behaves like a `bigint`
- `SqlString` behaves like a `string`
- `SqlTimestamp` behaves like a `string`
- `SqlBoolean` behaves like a `boolean`
- `SqlBytes` behaves like a `Uint8Array`

This lets Teta make useful distinctions without forcing wrapper objects into user code.

### Why brands matter

Brands help TypeScript keep SQL intent separate even when JavaScript would treat values the same.

For example, a timestamp column and a plain string are both strings at runtime, but they do not mean the same thing in the query DSL.

Teta also smooths over normal usage: raw numeric literals are normalized in numeric contexts, so code like `eq(user.id, 1)` or `add(user.id, 1)` still works naturally.

## 5) `QueryStep<TIn, TOut>` is the reusable pipeline type

When you call a query helper in data-last form, Teta returns a reusable pipeline step.

```ts
import { eq, filter, take, pipe } from "@teta/teta";

const top10ActiveUsers = pipe(
  users,
  filter((user) => eq(user.active, true)),
  take(10)
);
```

Inside that pipeline, `filter((user) => eq(user.active, true))` and `take(10)` are callable `QueryStep<TIn, TOut>` values.

- `filter(...)` returns `QueryStep<T, T>`
- `map(...)` returns `QueryStep<TIn, TOut>` with a new output shape
- `take(...)` returns `QueryStep<T, T>`
- `flow(...)` composes query steps and preserves each intermediate type for ordinary pipeline lengths.
- `extend(name, selector)` keeps existing columns and adds or replaces one named column.
- `filterEq(...)` and related helpers return `QueryStep<T, T>` and use row callbacks when operands come from query columns.

At runtime, query steps are still functions, but they also expose lightweight metadata:

```ts
const activeStep = filterEq((user) => user.active, true);

activeStep.kind;     // "query_step"
activeStep.stepName; // "filterEq"
```

This metadata is useful for debugging, logging, and tooling. It is not needed for normal query composition.

You usually do not need to write `QueryStep<...>` explicitly, but it is the right type when building higher-level query utilities.

`pipe(...)` and `flow(...)` keep exact intermediate types through 12 steps. Longer pipelines still run normally, but TypeScript falls back to a less precise result type after that point. Split very long pipelines with `flow(...)` if you need precise types across every step.

## 6) `values(...)` infers row types from data

`values(...)` creates a typed inline relation from literal rows.

```ts
import { values } from "@teta/teta";

const seedUsers = values([
  { id: 1, email: "ada@example.com", active: true },
  { id: 2, email: "grace@example.com", active: false },
]);
```

Important rules:

- there must be at least one row
- every row must have exactly the same keys
- `undefined` is not allowed

`values(...)` is great for tests, small lookup tables, and seed-like inline datasets.

## 7) Render and inspection types

These types matter once you leave the query-building layer:

- `SqlOptions` configures dialect, format, render strategy, and parameter mode
- `SqlResult` is the structured `{ sql, params }` return type from `toSqlResult(...)`
- `SqlRenderable` is the frontend union accepted by `toSql(...)`: an opaque Teta `Query` or a backend SQL expression/query target
- `QueryIR<TColumns>` is the lowered logical query representation returned by `toIR(...)`
- `QueryExplainResult<TColumns>` is the structured debug output returned by `explain(...)`

`SqlOptions`, `SqlResult`, `ExprNode`, `Stage`, and the raw backend `QueryIR` contract are owned by `@teta/sql`. `@teta/teta` re-exports the common SQL types and adds frontend types such as `SqlRenderable` and the typed `QueryIR<TColumns>` returned by `toIR(...)`.

```ts
import { explain, toSqlResult } from "@teta/teta";
import type { ExprNode, SqlOptions, SqlResult, Stage } from "@teta/sql";

const result = toSqlResult(publicUsers, {
  dialect: "postgresql",
  parameterMode: "named",
});

const info = explain(publicUsers, {
  dialect: "postgresql",
  renderStrategy: "readable",
});
```

Explicit parameter placeholders are value-free in the query expression. Bind their runtime values through `SqlOptions.params`:

```ts
import { eq, filter, param, pipe, table, t, toSqlResult } from "@teta/teta";
import type { SqlInt } from "@teta/teta";

const users = table("users", { id: t.int() });
const byId = pipe(users, filter((user) => eq(user.id, param<SqlInt>("id"))));

const rendered = toSqlResult(byId, {
  dialect: "postgresql",
  params: { id: 42 },
});
```

Array bindings are available for positional placeholders. Numeric parameter names are 1-based indexes into the array:

```ts
const byPosition = pipe(users, filter((user) => eq(user.id, param<SqlInt>("1"))));

const positional = toSqlResult(byPosition, {
  dialect: "postgresql",
  parameterMode: "positional",
  parameterPrefix: "$",
  params: [42],
});
```

One useful detail: dialect is not part of `Query<TColumns>`. Teta keeps the query dialect-neutral, and you choose the target dialect later through `SqlOptions`.

## 8) Practical advice

- Prefer inference first. Teta is designed so schemas and callbacks usually provide all the types you need.
- Reach for `Expr<T>` when writing reusable expression helpers.
- Reach for `Query<TColumns>` or `QueryStep<TIn, TOut>` when writing reusable query utilities.
- Reach for `QueryColumns` when you need a generic constraint for "any object-shaped SQL query row". Its values are constrained to SQL value types rather than arbitrary `unknown`.
- Use `null`, not `undefined`, for nullable SQL values.
- Remember that `t.json<T>()` affects TypeScript types only; it does not validate JSON at runtime.
- Remember that `SqlDate` and `SqlTimestamp` are string-based SQL types, not JavaScript `Date` objects.

## 9) Which types are public?

The most important public types for EDSL users are:

- `Query`
- `QueryColumns`
- `QueryStep`
- `Expr`
- `SqlInt`, `SqlFloat`, `SqlBigInt`, `SqlDecimal`, `SqlNumber`
- `SqlDate`, `SqlTimestamp`, `SqlUuid`, `SqlBytes`, `SqlJson`
- `SqlOptions`, `SqlResult`, `SqlRenderable`
- `QueryIR`, `QueryExplainResult`
- `BuiltinDialect`, `Dialect`, `DialectSpec`, `QueryDialect`

If you need deeper compiler types such as `ExprNode`, `Stage`, `Source`, or `CteSpec`, import them from `@teta/sql`. For that layer, use `doc/DEV_GUIDE.md`.

# Teta Types Guide

This guide explains the main TypeScript types you will see while using Teta's EDSL.

If you are looking for compiler-internal IR types such as `ExprNode`, `Stage`, or `QuerySpec`, see `doc/DEV_GUIDE.md`.

## Quick mental model

Teta's type story is easiest to understand in four layers:

1. `t.*` declares column types for a schema.
2. `table(...)` and `values(...)` produce `Query<TColumns>`.
3. query callbacks receive typed expression refs and return new query shapes.
4. render helpers use SQL-focused types such as `SqlOptions` and `SqlResult`.

In practice, you usually let TypeScript infer everything and only annotate types at API boundaries or when extracting reusable helpers.

## 1) Schema types with `t`

Use `t.*` helpers only when declaring schemas.

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
//   email: string;
//   age: SqlInt;
//   active: boolean;
//   created_at: SqlTimestamp;
//   deleted_at: SqlTimestamp | null;
//   tags: string[];
//   profile: SqlJson<{ theme: string; locale: string }>;
// }>
```

Common schema helpers:

- `t.string()` -> `string`
- `t.boolean()` -> `boolean`
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

### Shape-preserving helpers

These keep the same `TColumns`:

- `filter(...)`
- `sort(...)`
- `take(...)`

```ts
import { eq, filter } from "@teta/teta";

const activeUsers = filter(users, (user) => eq(user.active, true));
// still Query<{ id, email, age, active, created_at, deleted_at, tags, profile }>
```

### Shape-replacing helpers

These create a new `TColumns` from the object you return:

- `map(...)`
- `fold(...)`

```ts
import { map } from "@teta/teta";

const publicUsers = map(users, (user) => ({
  id: user.id,
  email: user.email,
}));
// Query<{ id: SqlInt; email: string }>
```

With `fold(...)`, the returned object also becomes the new row shape, but it is meant for grouped or aggregated output.

```ts
import { count, fold, group } from "@teta/teta";

const userCounts = fold(users, (user) => ({
  active: group(user.active),
  total: count(user.id),
}));
```

### Shape-merging helpers

`join(...)` combines the left and right query shapes.

- `inner` join keeps both sides as-is
- `left` join makes right-side columns nullable
- `right` join makes left-side columns nullable
- `full` join makes both sides nullable

```ts
import { pipe } from "remeda";
import { leftJoin, onEq, prefixOverlapLeft, table, t } from "@teta/teta";

const orders = table("orders", {
  id: t.int(),
  user_id: t.int(),
  total: t.float(),
});

const usersWithOrders = pipe(
  users,
  leftJoin(orders, onEq({ id: "user_id" }))
);
// order columns are inferred as nullable because this is a left join
```

Default joins only infer a merged shape when the left and right output names do not overlap. If names overlap, pass an explicit merge helper such as dropOverlapLeft() or prefixOverlapLeft("left_").
Legacy `join(..., { merge })` is no longer supported. Pass the merge helper positionally before the options object, for example `join(right, on, dropOverlapLeft(), { type: "left" })`.

```ts
const profiles = table("profiles", {
  user_id: t.int(),
  id: t.int(),
  bio: t.string(),
});

const renamed = pipe(
  users,
  leftJoin(profiles, onEq({ id: "user_id" }), prefixOverlapLeft("left_"))
);
```

### Shape-extending helpers

`unnest(...)` keeps the original columns and adds generated ones.

```ts
import { unnest } from "@teta/teta";

const usersByTag = unnest(users, (user) => user.tags, {
  value: "tag",
  ordinality: "tag_index",
});
// original user columns + { tag: string, tag_index: SqlInt }
```

### Set operations

`union(...)` and `unionAll(...)` require both sides to have the same row shape and return that same shape.

## 3) `ExprRef<T>` is the expression type

Inside query callbacks, columns are typed expression refs.

- `user.id` is not a plain `number`; it is an expression with type `ExprRef<SqlInt>`
- `user.email` is `ExprRef<string>`
- `user.deleted_at` is `ExprRef<SqlTimestamp | null>`

This is why expression helpers compose safely: `eq(...)`, `add(...)`, `upper(...)`, `dateTrunc(...)`, and others all operate on typed expressions, not raw SQL strings.

Most of the time you do not need to annotate `ExprRef<T>` yourself. It becomes useful when extracting reusable expression helpers.

```ts
import { type ExprRef, type SqlInt, gte } from "@teta/teta";

function isAdult(age: ExprRef<SqlInt>) {
  return gte(age, 18);
}
```

Then use it in a query:

```ts
import { filter } from "@teta/teta";

const adults = filter(users, (user) => isAdult(user.age));
```

The important idea is that Teta tracks the SQL value type carried by an expression, and TypeScript keeps that information all the way through your query pipeline.

## 4) Branded SQL primitives

Teta uses branded types to distinguish SQL-oriented values that share the same JavaScript runtime representation.

For example:

- `SqlInt`, `SqlFloat`, and `SqlDecimal` are all numeric at runtime
- `SqlDate`, `SqlTimestamp`, and `SqlUuid` are all string-based at runtime
- `SqlJson<T>` keeps your JSON payload type attached to the expression

These brands exist only at type-check time. At runtime:

- `SqlInt` behaves like a `number`
- `SqlBigInt` behaves like a `bigint`
- `SqlTimestamp` behaves like a `string`
- `SqlBytes` behaves like a `Uint8Array`

This lets Teta make useful distinctions without forcing wrapper objects into user code.

### Why brands matter

Brands help TypeScript keep SQL intent separate even when JavaScript would treat values the same.

For example, a timestamp column and a plain string are both strings at runtime, but they do not mean the same thing in the query DSL.

Teta also smooths over normal usage: raw numeric literals are normalized in numeric contexts, so code like `eq(user.id, 1)` or `add(user.id, 1)` still works naturally.

## 5) `QueryStep<TIn, TOut>` is the reusable pipeline type

When you call a query helper in data-last form, Teta returns a reusable pipeline step.

```ts
import { pipe } from "remeda";
import { eq, filter, take } from "@teta/teta";

const top10ActiveUsers = pipe(
  users,
  filter((user) => eq(user.active, true)),
  take(10)
);
```

Inside that pipeline, `filter((user) => eq(user.active, true))` and `take(10)` are `QueryStep<TIn, TOut>` functions.

- `filter(...)` returns `QueryStep<T, T>`
- `map(...)` returns `QueryStep<TIn, TOut>` with a new output shape
- `take(...)` returns `QueryStep<T, T>`

You usually do not need to write `QueryStep<...>` explicitly, but it is the right type when building higher-level query utilities.

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
- `QueryIR<TColumns>` is the lowered logical query representation returned by `toIR(...)`
- `QueryExplainResult<TColumns>` is the structured debug output returned by `explain(...)`

```ts
import { explain, toSqlResult } from "@teta/teta";

const result = toSqlResult(publicUsers, {
  dialect: "postgresql",
  parameterMode: "named",
});

const info = explain(publicUsers, {
  dialect: "postgresql",
  renderStrategy: "readable",
});
```

One useful detail: dialect is not part of `Query<TColumns>`. Teta keeps the query dialect-neutral, and you choose the target dialect later through `SqlOptions`.

## 8) Practical advice

- Prefer inference first. Teta is designed so schemas and callbacks usually provide all the types you need.
- Reach for `ExprRef<T>` when writing reusable expression helpers.
- Reach for `Query<TColumns>` or `QueryStep<TIn, TOut>` when writing reusable query utilities.
- Use `null`, not `undefined`, for nullable SQL values.
- Remember that `t.json<T>()` affects TypeScript types only; it does not validate JSON at runtime.
- Remember that `SqlDate` and `SqlTimestamp` are string-based SQL types, not JavaScript `Date` objects.

## 9) Which types are public?

The most important public types for EDSL users are:

- `Query`
- `QueryStep`
- `ExprRef`
- `SqlInt`, `SqlFloat`, `SqlBigInt`, `SqlDecimal`, `SqlNumber`
- `SqlDate`, `SqlTimestamp`, `SqlUuid`, `SqlBytes`, `SqlJson`
- `SqlOptions`, `SqlResult`
- `QueryIR`, `QueryExplainResult`
- `BuiltinDialect`, `Dialect`, `DialectSpec`, `QueryDialect`

If you need deeper compiler types such as `ExprNode`, `Stage`, `Source`, or `CteSpec`, they exist in the codebase but are mainly useful when working on Teta itself. For that layer, use `doc/DEV_GUIDE.md`.

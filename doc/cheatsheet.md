# Teta Cheatsheet

Quick reference for the public API exported from `@teta/teta`.

For detailed signatures and return types, see the [API Reference](./API.md).
For a guided walkthrough, see the [Tutorial](./TUTORIAL.md).

Teta is function-first. Row-transforming query helpers are curried query steps used with `pipe(...)`.

Queries are opaque runtime values. Use `query.columns` for reusable column expressions and `toIR(query)` / `explain(query, ...)` for inspection. Query steps are callable values with `kind: "query_step"` and `stepName` metadata. `flow(...)` composes general unary functions; `composeSteps(...)` preserves the query-step brand and metadata. These composition helpers preserve exact intermediate types through 12 explicit steps and a checked variadic tail.

```ts
import { add, and, arrayAppend, arrayContains, arrayJoin, arrayLength, arrayPosition, arraySlice, asBigInt, asBoolean, asBytes, asDate, asDecimal, asFloat, asInt, asJson, asString, asTimestamp, asUuid, asc, avg, bitLength, cast, charLength, characterLength, coalesce, composeSteps, concat, count, currentDate, currentTimestamp, dateAdd, dateDiff, dateFormat, dateLiteral, dateParse, dateTrunc, day, desc, drop, dropOverlapLeft, dropOverlapRight, eq, explain, Expr, f, filter, filterEq, flow, fold, fromUnixTime, full, group, gt, gte, hour, identityStep, inner, isIn, isNotNull, isNull, JoinKind, JoinOptions, join, lag, lead, left, leftSubstring, like, loop, lower, lt, lte, map, max, min, minute, mod, month, mul, ne, not, ntile, nullIf, octetLength, onEq, over, overlay, param, percentRank, pick, pipe, position, pow, prefixAllLeft, prefixAllRight, prefixOverlapLeft, prefixOverlapRight, Query, rank, regexExtract, regexLike, regexReplace, rename, replace, reverse, right, rightSubstring, round, rowNumber, rpad, sort, sqrt, sub, substring, suffixAllLeft, suffixAllRight, sum, sumOver, t, table, take, takeWithin, timestampLiteral, toIR, toSql, toSqlResult, toUnixTime, trim, union, unionAll, unlessStep, unnest, upper, usingCols, values, when, whenStep, year } from "@teta/teta";
import { fn, windowFn } from "@teta/teta/advanced";
```

## 1) Query roots and composition

### `table(name, schema)`
Create a typed table query root.

```ts
const users = table("users", {
  id: t.int(),
  name: t.string(),
  created_at: t.timestamp(),
});
```

Schemas must be non-empty objects whose values come from `t.*` helpers. Use dotted strings like `table("analytics.users", ...)` for schema-qualified paths. If the literal table name contains a dot, use `table({ table: "schema1.table1" }, ...)`.

### `values(rows)`
Create a typed inline row-set query root.

```ts
const seed = values([
  { id: 1, name: "Ada" },
  { id: 2, name: "Grace" },
]);
```

`values(...)` requires at least one row, every row must have the same columns, and values must be SQL literals supported by `lit(...)`.

### Multi-stage pipelines
Use Teta's `pipe(...)` to compose query stages.

```ts
const q = pipe(
  users,
  filter((u) => gt(u.id, 0)),
  map((u) => ({ id: u.id, name: upper(u.name) })),
  sort((u) => asc(u.name)),
  take(10)
);
```

Use `takeWithin(...)` for the first N rows in each partition:

```ts
const firstEmployeePerRole = pipe(
  employees,
  takeWithin({
    partitionBy: (employee) => employee.role,
    orderBy: (employee) => asc(employee.join_date),
    count: 1,
  })
);
```

`partitionBy` must return an expression or expression array. `orderBy` must return an order item or order item array, usually from `asc(...)` or `desc(...)`.

Use `flow(...)` to save reusable pipelines:

```ts
const activePublicUsers = flow(
  filterEq((user) => user.active, true),
  map((user) => ({ id: user.id, name: user.name }))
);
```

Use `composeSteps(...)` to wrap compatible query transforms in one branded query
step, such as when nesting composition inside a conditional step:

```ts
const activePage = composeSteps(
  filterEq((user: typeof users.columns) => user.active, true),
  take(50)
);

const visibleUsers = pipe(users, whenStep(includeActivePage, activePage));
```

Use `identityStep()`, `whenStep(condition, step)`, and `unlessStep(condition, step)` for simple host-language conditional composition. These helpers include or skip schema-preserving query steps while building the query; they do not create SQL `CASE` logic.

```ts
const visibleUsers = flow(
  filterEq((user) => user.active, true),
  whenStep(includeLimit, take(50)),
  unlessStep(includeDeleted, filterEq((user) => user.deleted, false))
);
```

### Callback column selectors

Use row callbacks to access columns with autocomplete and compile-time checks:

```ts
const q = pipe(
  users,
  filter((user) => and(eq(user.active, true), gte(user.age, 18))),
  map((user) => ({ id: user.id, name: upper(user.name) })),
  sort((user) => asc(user.name))
);
```

```ts
const joined = pipe(
  users,
  join(orders, left(
    (user, order) => eq(user.id, order.user_id)
  ))
);
```

Pass a selector as the join spec's second argument when the output should be
projected at the join boundary:

```ts
const joined = pipe(
  users,
  join(orders, left(
    (user, order) => eq(user.id, order.user_id),
    (user, order) => ({ user_id: user.id, order_total: order.total })
  ))
);
```

Use `map(...)` to select, omit, compute, or alias columns:

```ts
const compactUsers = pipe(users, map((user) => ({ id: user.id, name: user.name })));
const aliasedUsers = pipe(users, map((user) => ({ user_id: user.id, user_name: user.name })));
```

Callback selectors carry the current query shape through the row parameter.

### Curried helpers
Row-transforming query helpers are query steps used with `pipe(...)`.

```ts
const q = pipe(users, map((u) => ({ id: u.id })));
```

### `loop(step)`
Build a recursive CTE from a base query plus a recursive step.

```ts
const base = pipe(table("seed", { n: t.int() }), map((s) => ({ n: s.n })));
const q = pipe(base, loop((self) => pipe(self, map((s) => ({ n: add(s.n, 1) })))));
```

### Join helpers
Join queries with `join(rightOrBuilder, spec)`, where the spec is built with
`inner(...)`, `left(...)`, `right(...)`, or `full(...)`.

```ts
const usersWithOrders = pipe(
  users,
  join(orders, left(
    onEq({ id: "user_id" }),
    (user, order) => ({
      user_id: user.id,
      user_name: user.name,
      order_total: order.total,
    })
  ))
);
```

The optional second argument is either a selector or a merge helper when
overlapping output columns need an explicit strategy:

```ts
const q = pipe(
  leftQuery,
  join(rightQuery, left(on, dropOverlapLeft()))
);
```

### Join-kind helpers
Each join-kind helper is a data-last spec constructor:
`left(on)`, `left(on, selector)`, or `left(on, mergeHelper)`. The other join
kinds have the same shape. Pass `{ lateral: true }` after the selector, or in
the selector position when no selector is needed.

### `fold(selector)`
Use `group(expr)` inside the selector for grouping keys. `fold(...)` selectors are aggregate-phase projections: every returned expression should be grouped with `group(...)` / `groupShape(...)` or produced by an aggregate helper such as `count(...)`, `sum(...)`, `avg(...)`, `min(...)`, `max(...)`, or `arrayAgg(...)`.

```ts
const spend = pipe(
  orders,
  fold((o) => ({
    user_id: group(o.user_id),
    order_count: count(o.id),
    total_spend: sum(o.total),
  }))
);
```

### `unnest(selector, columns, options?)`
Expand an array-valued expression into rows.

```ts
const q = pipe(
  table("sessions", {
    id: t.int(),
    tags: t.array(t.string()),
  }),
  unnest((s) => s.tags, { value: "tag", ordinality: "tag_index" })
);
```

### Set operations

```ts
const allUsers = pipe(activeUsers, unionAll(inactiveUsers));
const uniqueUsers = pipe(activeUsers, union(inactiveUsers));
```

## 2) Query helpers

- `map(selector)`
- `fold(selector)`
- `filter(predicate)`
- `sort(selector)`
- `distinct()`
- `take(count)`
- `takeWithin({ partitionBy, orderBy, count })`
- `join(rightOrBuilder, inner(on, select?, options?))`
- `left(on, select?, options?)`
- `right(on, select?, options?)`
- `full(on, select?, options?)`
- `usingCols(name | names)`
- `onEq({ leftName: rightName })`
- `dropOverlapLeft()`
- `dropOverlapRight()`
- `prefixOverlapLeft(prefix)`
- `prefixOverlapRight(prefix)`
- `prefixAllLeft(prefix)`
- `prefixAllRight(prefix)`
- `suffixAllLeft(suffix)`
- `suffixAllRight(suffix)`
- `unnest(selector, { value, ordinality? }, { outer? })`
- `unionAll(right)`
- `union(right)`
- `loop(step)`
- `composeSteps(...steps)`
- `identityStep()`
- `whenStep(condition, step)`
- `unlessStep(condition, step)`

Record projection helpers compose inside `map(...)`:

```ts
map(pick("id", "name"))
map(drop("internal_note"))
map(rename((key) => `user_${key}`))
```

`map(...)`, `fold(...)`, `filter(...)`, `sort(...)`, `distinct()`, `take(...)`, fixed join helpers, `union(...)`, `unionAll(...)`, and `loop(...)`
all return `QueryStep` functions when called without the left query.

## 3) Rendering and introspection

### SQL output

```ts
toSql(q, { dialect: "postgresql" });
toSql(q, { dialect: "postgresql", format: "pretty" });
toSql(q, { dialect: "duckdb", format: "compact" });
toSql(q, { dialect: "postgresql", renderStrategy: "readable" });
```

### Structured SQL output

```ts
const result = toSqlResult(q, {
  dialect: "postgresql",
  parameterMode: "named",
});

result.sql;
result.params;
```

### Lowering helpers

```ts
import { irToSql } from "@teta/sql";
import { toAst } from "@teta/teta/inspect";

const ir = toIR(q);
const ast = toAst(q, { dialect: "postgresql" });
const info = explain(q, { dialect: "postgresql", renderStrategy: "readable" });
const explicitSql = irToSql(ir, { dialect: "postgresql" });
```

### Lowering tips

- `explain(query, ...)` is the fastest way to inspect `stages`, `ctes`, `sql`, and `params`
- `toSql(query, ...)` is a frontend convenience wrapper around `@teta/sql` rendering
- `optimized` may fuse stages into one `SELECT`
- `readable` preserves stage boundaries as `cte_0`, `cte_1`, ...
- a nested derived table usually means the compiler needed a scope barrier

## 4) Schema helpers

- `t.string()`
- `t.int()`
- `t.float()`
- `t.bigint()`
- `t.decimal()`
- `t.boolean()`
- `t.date()`
- `t.timestamp()`
- `t.uuid()`
- `t.json<T>()`
- `t.bytes()`
- `t.array(inner)`
- `t.nullable(inner)`

## 5) Expression helpers

### Comparison and boolean

- `eq(left, right)`
- `ne(left, right)`
- `gt(left, right)`
- `gte(left, right)`
- `lt(left, right)`
- `lte(left, right)`
- `like(value, pattern)`
- `isIn(value, values)`
- `isNotIn(value, values)`
- `notIn(value, values)`
- `between(value, lower, upper)`
- `isDistinctFrom(left, right)`
- `and(...conditions)`
- `or(...conditions)`
- `not(value)`
- `isNull(value)`
- `isNotNull(value)`

`and(...)` and `or(...)` accept one or more conditions.

### Arithmetic and numeric

- `add(left, right)`
- `sub(left, right)`
- `mul(left, right)`
- `div(left, right)`
- `mod(left, right)`
- `ceil(value)`
- `floor(value)`
- `abs(value)`
- `sqrt(value)`
- `pow(value, exponent)`
- `greatest(value, ...values)`
- `least(value, ...values)`
- `round(value, scale?)`

### Date and time

- `extract(value, field)`
- `dateTrunc(value, unit)`
- `dateAdd(value, unit, amount)`
- `dateDiff(value, unit, other)`
- `dateFormat(value, format)`
- `dateParse(value, format)`
- `toUnixTime(value)`
- `fromUnixTime(value)`
- `year(value)`
- `month(value)`
- `day(value)`
- `hour(value)`
- `minute(value)`
- `second(value)`
- `currentDate()`
- `currentTimestamp()`
- `dateLiteral("YYYY-MM-DD")`
- `timestampLiteral("YYYY-MM-DD HH:MM:SS")`

### Aggregation and grouping

- `group(value)`
- `count(value)`
- `sum(value)`
- `avg(value)`
- `min(value)`
- `max(value)`
- `arrayAgg(value)`

### Window

- `over(rank(), spec)`
- `over(denseRank(), spec)`
- `over(rowNumber(), spec)`
- `over(lag(value, offset?, fallback?), spec)`
- `over(lead(value, offset?, fallback?), spec)`
- `over(percentRank(), spec)`
- `over(ntile(buckets), spec)`
- `sumOver(value, spec)`
- `asc(value)`
- `desc(value)`

`spec` shape:
- `{ partitionBy?: Expr | Expr[]; orderBy?: OrderItem | OrderItem[] }`

### String and regex

- `replace(value, search, replacement)`
- `upper(value)`
- `lower(value)`
- `reverse(value)`
- `trim(value)`
- `substring(value, start, length?)`
- `position(value, needle)`
- `overlay(value, placing, start, length?)`
- `charLength(value)`
- `characterLength(value)`
- `octetLength(value)`
- `bitLength(value)`
- `leftSubstring(value, length)`
- `rightSubstring(value, length)`
- `lpad(value, length, padding?)`
- `rpad(value, length, padding?)`
- `concat(value, ...parts)`
- `regexLike(value, pattern)`
- `regexReplace(value, pattern, replacement, flags?)`
- `regexExtract(value, pattern, groupIndex?)`

### Array

- `arrayLength(value)`
- `arrayContains(value, item)`
- `arrayPosition(value, item)`
- `arraySlice(value, start, length?)`
- `arrayJoin(value, separator)`
- `arrayAppend(value, item)`
- `arrayPrepend(value, item)`
- `arrayConcat(value, ...values)`
- `arrayDistinct(value)`
- `array(...values)`

### Nulls and casts

- `coalesce(value, ...fallbacks)`
- `nullIf(value, other)`
- `cast(value, type)`
- `asInt(value)`, `asFloat(value)`, `asString(value)`
- `asBigInt(value)`, `asDecimal(value)`, `asBoolean(value)`
- `asDate(value)`, `asTimestamp(value)`
- `asUuid(value)`, `asBytes(value)`, `asJson(value)`

## 6) Builders and utilities

### Core expression builders

- `lit(value)`
- `param<T>(name)` with render-time `params`
- `fn(name, ...args)`
- `windowFn(name, ...args)`
- `over(window, spec)`
- `when(condition, value, ...pairs)` -> build `CASE WHEN ... THEN ... END`; use `true, value` as the fallback pair
- `mapShape(obj, mapper)` -> map each expression in a shape
- `groupShape(obj)` -> apply `group(...)` to each expression in a shape
- ``f`prefix ${expr} suffix` ``

```ts
filter((user) => and(eq(user.active, true), gte(user.age, 18), isNotNull(user.email)))
```

### Projections

```ts
import { fold, groupShape, map, pipe, upper } from "@teta/teta";

const compactUsers = pipe(
  users,
  map((user) => ({
    id: user.id,
    name: user.name,
    name_upper: upper(user.name),
  }))
);

const publicUsers = pipe(users, map((user) => ({ id: user.id, name: user.name })));

const enrichedUsers = pipe(users, map((user) => ({
  id: user.id,
  name: user.name,
  name_upper: upper(user.name),
})));

const prefixedUsers = pipe(users, map((user) => ({
  user_id: user.id,
  user_name: user.name,
})));

const groupedUsers = pipe(
  users,
  fold((user) => ({
    ...groupShape({ id: user.id }),
  }))
);
```

## 7) Dev package

Source-module rendering, file watching, and clipboard helpers now live in `@teta/dev`.
See [the dev package README](../packages/dev/README.md) for setup and usage.

## 8) Key exported types

For a guided explanation of how these fit together in the EDSL, see [TYPES.md](./TYPES.md).

- `Query`
- `QueryColumns`
- `QueryIR`
- `QueryExplainResult`
- `QueryStep`
- `Expr`
- `BuiltinDialect`
- `DialectSpec`
- `Dialect`
- `QueryDialect`
- `DialectFeatures`
- `DialectLanguageConfig`
- `DialectLanguageFallback`
- `SqlFormat`
- `SqlRenderStrategy`
- `SqlOptions`
- `SqlRenderable`
- `SqlInt`
- `SqlFloat`
- `SqlBigInt`
- `SqlDecimal`
- `SqlNumber`
- `SqlDate`
- `SqlTimestamp`
- `SqlUuid`
- `SqlBytes`
- `SqlJson`
- `LanguageCategory`

## 9) End-to-end mini example

```ts
import { asc, desc, currentTimestamp, dateTrunc, eq, filter, take, sort, map, table, t, toSql, trim, upper, pipe } from "@teta/teta";

const users = table("users", {
  id: t.int(),
  name: t.string(),
  active: t.boolean(),
  created_at: t.timestamp(),
});

const q = pipe(
  users,
  filter((u) => eq(u.active, true)),
  map((u) => ({
    id: u.id,
    name: upper(trim(u.name)),
    created_day: dateTrunc(u.created_at, "day"),
    generated_at: currentTimestamp(),
  })),
  sort((u) => [desc(u.created_day), asc(u.id)]),
  take(100)
);

console.log(toSql(q, { dialect: "postgresql", format: "pretty" }));
```

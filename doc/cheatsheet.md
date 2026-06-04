# Teta Cheatsheet

Quick reference for the public API exported from `@teta/teta`.

Teta is function-first. Row-transforming query helpers are curried query steps used with `pipe(...)`.

```ts
import { add, and, arrayAppend, arrayContains, arrayJoin, arrayLength, arrayPosition, arraySlice, asBigInt, asBoolean, asBytes, asDate, asDecimal, asFloat, asInt, asJson, asString, asTimestamp, asUuid, asc, avg, bitLength, cast, charLength, characterLength, coalesce, concat, count, currentDate, currentTimestamp, dateAdd, dateDiff, dateFormat, dateLiteral, dateParse, dateTrunc, day, desc, drop, dropOverlapLeft, dropOverlapRight, eq, explain, Expr, extend, f, filter, filterEq, flow, fn, fold, fromUnixTime, fullJoin, group, gt, gte, hour, innerJoin, isIn, isNotNull, isNull, join, lag, lead, left, leftJoin, like, loop, lower, lt, lte, map, rename, max, min, minute, mod, month, mul, ne, not, ntile, nullIf, octetLength, onEq, over, overlay, param, percentRank, pick, pipe, position, pow, prefixAllLeft, prefixAllRight, prefixOverlapLeft, prefixOverlapRight, Query, rank, regexExtract, regexLike, regexReplace, replace, reverse, right, rightJoin, round, rowNumber, rpad, shape, sort, sqrt, sub, substring, suffixAllLeft, suffixAllRight, sum, sumOver, t, table, take, takeWithin, timestampLiteral, toAst, toIR, toSql, toSqlResult, toUnixTime, trim, union, unionAll, unnest, upper, usingCols, values, when, windowFn, year } from "@teta/teta";
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

Use dotted strings like `table("analytics.users", ...)` for schema-qualified paths. If the literal table name contains a dot, use `table({ table: "schema1.table1" }, ...)`.

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

Use `flow(...)` to save reusable pipelines:

```ts
const activePublicUsers = flow(
  filterEq((user) => user.active, true),
  pick("id", "name")
);
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
  join(orders, {
    type: "left",
    on: (user, order) => eq(user.id, order.user_id),
  })
);
```

Use `select` when the join output should be projected at the join boundary. The `*JoinMap(...)` helpers are wrappers for this shape:

```ts
const joined = pipe(
  users,
  join(orders, {
    type: "left",
    on: (user, order) => eq(user.id, order.user_id),
    select: (user, order) => ({ user_id: user.id, order_total: order.total }),
  })
);
```

Use `pick(...)` for same-name projections:

```ts
const compactUsers = pipe(users, pick("id", "name"));
const activeUserColumns = pipe(users, drop("deleted_at"));
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
Join queries with `join(rightOrBuilder, { type?, on, select?, lateral? })`. `type` defaults to `inner`; use `"left"`, `"right"`, or `"full"` for outer joins.

```ts
const usersWithOrders = pipe(
  users,
  join(orders, {
    type: "left",
    on: onEq({ id: "user_id" }),
    select: (user, order) => ({
      user_id: user.id,
      user_name: user.name,
      order_total: order.total,
    }),
  })
);
```

Use merge helpers in `select` when overlapping output columns need an explicit strategy. The `*JoinMerge(...)` helpers are wrappers for this shape:

```ts
const q = pipe(
  left,
  join(right, {
    type: "left",
    on,
    select: dropOverlapLeft(),
  })
);
```

### Join-kind helpers
Use `innerJoin(...)`, `leftJoin(...)`, `rightJoin(...)`, or `fullJoin(...)` as fixed-type wrappers around `join(...)`. Use `innerJoinMap(...)` or `innerJoinMerge(...)` style helpers when you prefer wrapper names for `select` projections or merge helpers.

### `fold(selector)`
Use `group(expr)` inside the selector for grouping keys.

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
- `take(count)`
- `takeWithin({ partitionBy, orderBy, count })`
- `join(rightOrBuilder, { type?, on, select?, lateral? })`
- `innerJoin(...)`, `leftJoin(...)`, `rightJoin(...)`, `fullJoin(...)` as fixed-type wrappers
- `innerJoinMap(...)`, `leftJoinMap(...)`, `rightJoinMap(...)`, `fullJoinMap(...)` as projection wrappers
- `innerJoinMerge(...)`, `leftJoinMerge(...)`, `rightJoinMerge(...)`, `fullJoinMerge(...)` as merge-helper wrappers
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
- `identityStep()`
- `whenStep(condition, step)`
- `unlessStep(condition, step)`

`map(...)`, `fold(...)`, `filter(...)`, `sort(...)`, `take(...)`, fixed join helpers, `union(...)`, `unionAll(...)`, and `loop(...)`
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
- `left(value, length)`
- `right(value, length)`
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
- `param(value, name?)`
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

### Projection helpers

```ts
import { drop, extend, fold, groupShape, map, rename, pick, pipe, upper } from "@teta/teta";

const compactUsers = pipe(
  users,
  map((user) => ({
    id: user.id,
    name: user.name,
    name_upper: upper(user.name),
  }))
);

const publicUsers = pipe(users, pick("id", "name"));

const enrichedUsers = pipe(users, extend("name_upper", (user) => upper(user.name)));

const internalUsers = pipe(users, drop("password_hash"));

const prefixedUsers = pipe(users, rename((key) => `user_${key}`));

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

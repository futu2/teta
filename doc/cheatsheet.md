# Teta Cheatsheet

Quick reference for the public API exported from `@teta/teta`.

Teta is function-first. Query helpers are dual-mode, so you can write either `map(users, fn)`
or `pipe(users, map(fn))`. In practice, the examples here prefer Remeda's `pipe(...)`.

```ts
import { pick, pipe } from "remeda";

import { fold, and, arrayAppend, arrayContains, arrayJoin, arrayLength, arrayPosition, arraySlice, asc, avg, bitLength, cast, charLength, characterLength, coalesce, concat, count, currentDate, currentTimestamp, dateAdd, dateDiff, dateFormat, dateLiteral, dateParse, dateTrunc, day, desc, eq, explain, ExprRef, f, filter, fn, fromUnixTime, group, gt, gte, hour, isIn, isNotNull, isNull, join, lag, lead, left, like, take, loop, lower, lt, lte, max, min, minute, mod, month, mul, ne, not, ntile, nullIf, octetLength, sort, over, overlay, param, percentRank, position, pow, Query, rank, regexExtract, regexLike, regexReplace, replace, reverse, right, round, rowNumber, rpad, map, shape, sqrt, sub, substring, sum, sumOver, t, table, timestampLiteral, toAst, toDate, toFloat, toIR, toInt, toSql, toSqlResult, toUnixTime, trim, union, unionAll, unnest, upper, when, windowFn, year } from "@teta/teta";

import { copyTextToClipboard, renderSqlFromSource, watchQuerySourceToClipboard } from "@teta/teta";
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
Use Remeda's `pipe(...)` to compose query stages.

```ts
const q = pipe(
  users,
  filter((u) => gt(u.id, 0)),
  map((u) => ({ id: u.id, name: upper(u.name) })),
  sort((u) => asc(u.name)),
  take(10)
);
```

### Dual-mode helpers
Every query helper can be used data-first or data-last.

```ts
const q1 = map(users, (u) => ({ id: u.id }));
const q2 = pipe(users, map((u) => ({ id: u.id })));
```

### `loop(step)`
Build a recursive CTE from a base query plus a recursive step.

```ts
const base = map(table("seed", { n: t.int() }), (s) => ({ n: s.n }));
const q = loop(base, (self) => map(self, (s) => ({ n: add(s.n, 1) })));
```

### `join(right, on, options?)`
Join queries with `inner`, `left`, `right`, or `full` behavior.

```ts
const usersWithOrders = pipe(
  users,
  join(orders, (u, o) => eq(u.id, o.user_id), { type: "left" }),
  map((row) => ({
    user_id: row.id,
    user_name: row.name,
    order_total: row.total,
  }))
);
```

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
const allUsers = unionAll(activeUsers, inactiveUsers);
const uniqueUsers = union(activeUsers, inactiveUsers);
```

## 2) Query helpers

- `map(selector)`
- `fold(selector)`
- `filter(predicate)`
- `sort(selector)`
- `take(count)`
- `join(rightOrBuilder, on, { type?, lateral?, merge? })`
- `unnest(selector, { value, ordinality? }, { outer? })`
- `unionAll(right)`
- `union(right)`
- `loop(step)`

`map(...)`, `fold(...)`, `filter(...)`, `sort(...)`, `take(...)`, `join(...)`, `union(...)`, `unionAll(...)`, and `loop(...)`
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
const ir = toIR(q);
const ast = toAst(q, { dialect: "postgresql" });
const info = explain(q, { dialect: "postgresql", renderStrategy: "readable" });
```

### Lowering tips

- `explain(query, ...)` is the fastest way to inspect `stages`, `ctes`, `sql`, and `params`
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
- `and(left, right)`
- `or(left, right)`
- `not(value)`
- `isNull(value)`
- `isNotNull(value)`

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
- `{ partitionBy?: ExprRef | ExprRef[]; orderBy?: OrderItem | OrderItem[] }`

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
- `toInt(value)`
- `toFloat(value)`
- `toDate(value)`

## 6) Builders and utilities

### Core expression builders

- `lit(value)`
- `param(value, name?)`
- `fn(name, ...args)`
- `windowFn(name, ...args)`
- `over(window, spec)`
- `when(condition, value)` -> build a CASE branch
- `caseWhen(branches, elseValue?)` -> build `CASE WHEN ... THEN ... [ELSE ...] END`
- `mapShape(obj, mapper)` -> map each expression in a shape
- `groupShape(obj)` -> apply `group(...)` to each expression in a shape
- ``f`prefix ${expr} suffix` ``

### Remeda-friendly projection helpers

```ts
import { merge, omit, pick, pipe } from "remeda";

const compactUsers = map(users, pipe(
  pick(["id", "name"] as const),
  (base) => merge(base, { name_upper: upper(base.name) })
));

const publicUsers = map(users, omit(["created_at"] as const));

const groupedUsers = fold(users, (user) => ({
  ...groupShape({ id: user.id }),
}));
```

## 7) Dev utilities

### `copyTextToClipboard(text, preferred = "auto")`
Copy SQL to the clipboard using one of:
- `"auto"`, `"wl-copy"`, `"xclip"`, `"xsel"`, `"pbcopy"`, `"clip"`

Returns the clipboard tool actually used.

### `renderSqlFromSource(source, exportName = "query", rendererOptions = {})`
Load a module and render SQL from:
- a query-like object
- a SQL string export
- a function returning either of the above

### `watchQuerySourceToClipboard(options)`
Watch source files, re-render SQL on change, optionally write an output file and/or copy to the clipboard.

Example:

```ts
// queries/users_report.ts
import { eq, filter, map, table, t } from "@teta/teta";

const users = table("users", {
  id: t.int(),
  email: t.string(),
  active: t.boolean(),
});

export const query = map(
  filter(users, (user) => eq(user.active, true)),
  (user) => ({
    id: user.id,
    email: user.email,
  })
);
```

```ts
// scripts/watch_users_report.ts
import { watchQuerySourceToClipboard } from "@teta/teta";

const watcher = await watchQuerySourceToClipboard({
  source: "./queries/users_report.ts",
  watchPaths: ["./queries"],
  outputFile: "./tmp/users_report.sql",
  copyToClipboard: true,
  rendererOptions: {
    dialect: "postgresql",
    format: "pretty",
  },
});

process.on("SIGINT", () => watcher.stop());
```

Saving `queries/users_report.ts` re-renders the SQL, writes `./tmp/users_report.sql`, and copies the latest SQL to your clipboard.

Returns a controller with:
- `stop()`
- `runOnce()`

## 8) Key exported types

- `Query`
- `QueryIR`
- `QueryExplainResult`
- `QueryStep`
- `ExprRef`
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
import { pipe } from "remeda";
import { asc, desc, currentTimestamp, dateTrunc, eq, filter, take, sort, map, table, t, toSql, trim, upper } from "@teta/teta";

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

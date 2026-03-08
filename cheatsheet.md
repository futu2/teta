# Teta Cheatsheet

Quick reference for the public API exported from `mod.ts`.

```ts
import {
  Query,
  table,
  loop,
  t,
  ExprRef,
  fn,
  windowFn,
  when,
  shape,
  f,
  lit,
  currentDate,
  currentTimestamp,
  dateLiteral,
  timestampLiteral,
  LANGUAGE_SPEC,
  getLanguageSpec,
  copyTextToClipboard,
  renderSqlFromSource,
  watchQuerySourceToClipboard,
} from "@teta/teta";
```

## 1) Query Builders

### `table(name, schema)`
Create a typed table query root.

```ts
const users = table("users", {
  id: t.int(),
  name: t.string(),
  created_at: t.timestamp(),
});
```

### `loop(base, step)`
Create a recursive CTE query (base + step).

```ts
const q = loop(
  table("seed", { n: t.int() }).select((s) => ({ n: s.n })),
  (self) => self.select((s) => ({ n: s.n.add(1) }))
);
```

### `t` schema helpers
- `t.string()`
- `t.int()`
- `t.float()`
- `t.boolean()`
- `t.date()`
- `t.timestamp()`

## 2) `Query` Methods

All `Query` methods are immutable and return a new `Query`.

### Projection and filtering
- `select(selector)`
- `aggregate(selector)` (supports grouping via `expr.group()`)
- `filter(predicate)`

### Ordering and limiting
- `orderBy(selector)`
- `limit(count)`

### Set operations
- `unionAll(right)`
- `union(right)`

### Joins
- `join(right, on, joinType = "inner")`
- `innerJoin(right, on)`
- `leftJoin(right, on)`
- `rightJoin(right, on)`
- `fullJoin(right, on)`
- `lateralJoin(rightOrBuilder, on, joinType = "inner")`

### Output and introspection
- `toIR()`
- `toAst()`
- `toSql(renderer)`
- `toSqlResult(renderer)`

`toSql` examples:

```ts
q.toSql(sqlRenderer({ dialect: "postgresql" }));
q.toSql(sqlRenderer({ dialect: "postgresql", format: "pretty" }));
q.toSql(sqlRenderer({ dialect: "duckdb", format: "compact" }));
q.toSql(duckdbRenderer({ format: "compact" }));
```

## 3) `ExprRef` Methods

Use these on column refs and expression refs (for example `u.age.gte(18)`).

### Comparison and boolean
- `eq(value)`
- `ne(value)`
- `gt(value)`
- `gte(value)`
- `lt(value)`
- `lte(value)`
- `like(value)` (string)
- `in(values)`
- `and(value)`
- `or(value)`
- `not()`

### Arithmetic and numeric
- `add(value)`
- `sub(value)`
- `mul(value)`
- `div(value)`
- `mod(value)`
- `ceil()`
- `floor()`
- `abs()`
- `sqrt()`
- `pow(exponent)`
- `greatest(...values)`
- `least(...values)`
- `round(scale?)`

### Date and time
- `extract(field)`
- `dateTrunc(unit)`
- `dateAdd(unit, amount)`
- `dateDiff(unit, other)`
- `dateFormat(format)`
- `dateParse(format)`
- `toUnixTime()`
- `fromUnixTime()`
- `year()`
- `month()`
- `day()`
- `hour()`
- `minute()`
- `second()`

### Aggregation and grouping
- `group()`
- `count()`
- `sum()`
- `avg()`
- `min()`
- `max()`

### Window
- `rank().over(spec)`
- `denseRank().over(spec)`
- `rowNumber().over(spec)`
- `lag(offset?, fallback?).over(spec)`
- `lead(offset?, fallback?).over(spec)`
- `percentRank().over(spec)`
- `ntile(buckets).over(spec)`
- `sumOver(spec)`

`spec` shape:
- `{ partitionBy?: ExprRef | ExprRef[]; orderBy?: OrderItem | OrderItem[] }`

### String
- `replace(search, replacement)`
- `upper()`
- `lower()`
- `reverse()`
- `trim()`
- `substring(start, length?)`
- `position(needle)`
- `overlay(placing, start, length?)`
- `charLength()`
- `characterLength()`
- `octetLength()`
- `bitLength()`
- `left(length)`
- `right(length)`
- `lpad(length, padding = " ")`
- `rpad(length, padding = " ")`
- `concat(...parts)`

### Regex
- `regexLike(pattern)`
- `regexReplace(pattern, replacement, flags?)`
- `regexExtract(pattern, groupIndex?)`

### Array
- `arrayLength()`
- `arrayContains(value)`
- `arrayPosition(value)`
- `arraySlice(start, length?)`
- `arrayJoin(separator)`
- `arrayAppend(value)`
- `arrayPrepend(value)`
- `arrayConcat(...values)`
- `arrayDistinct()`

### Nulls, casts, order items
- `coalesce(...values)`
- `nullIf(value)`
- `isNull()`
- `isNotNull()`
- `cast(target)`
- `toInt()`
- `toFloat()`
- `toDate()`
- `asc()` (for `orderBy`)
- `desc()` (for `orderBy`)

## 4) Expression Utilities

### Core builders
- `lit(value)` -> literal expression
- `fn(name, ...args)` -> generic SQL function call
- `windowFn(name, ...args).over(spec)` -> generic window function call

### Date/time constants and literals
- `currentDate()`
- `currentTimestamp()`
- `dateLiteral("YYYY-MM-DD")`
- `timestampLiteral("YYYY-MM-DD HH:MM:SS")`

### CASE builder
- `when(condition, value).when(...).else(value)`
- `when(condition, value).when(...).end()`

### Shape utilities
- `shape(obj).map(mapper)` -> map each expression in a shape
- `shape(obj).group()` -> apply `.group()` to each expression in a shape

### Template helper
- ``f`prefix ${expr} suffix` `` -> SQL `CONCAT(...)`

## 5) Language Utilities

### `LANGUAGE_SPEC`
Language categories and canonical operations/functions:
- `math`
- `string`
- `logical`
- `dateTime`
- `conversionAndNull`
- `array`
- `windowAndAgg`
- `queryFeatures`

### `getLanguageSpec()`
Returns the same language spec object as `LANGUAGE_SPEC`.

## 6) Dev Utilities

### `copyTextToClipboard(text, preferred = "auto")`
Copy a SQL string to clipboard using one of:
- `"auto"`, `"wl-copy"`, `"xclip"`, `"xsel"`, `"pbcopy"`, `"clip"`

Returns the clipboard tool actually used.

### `renderSqlFromSource(source, exportName = "query", rendererOptions = {})`
Load a module and render SQL from:
- a `Query`-like object (`toSql(renderer)`)
- a SQL string export
- a function returning either of the above

### `watchQuerySourceToClipboard(options)`
Watch source files, re-render SQL on change, optionally write output file and/or copy to clipboard.

Returns a controller:
- `stop()`
- `runOnce()`

## 7) Key Exported Types (from `mod.ts`)

- `BuiltinDialect`
- `DialectSpec`
- `Dialect`
- `QueryDialect`
- `DialectFeatures`
- `DialectLanguageConfig`
- `DialectLanguageFallback`
- `SqlFormat`
- `SqlOptions`
- `SqlInt`
- `SqlFloat`
- `SqlNumber`
- `SqlDate`
- `SqlTimestamp`
- `LanguageCategory`
- `ClipboardTool`
- `QueryLike`
- `WatchQuerySourceOptions`
- `WatchQueryController`

## 8) End-to-End Mini Example

```ts
import { table, t, currentTimestamp } from "@teta/teta";

const users = table("users", {
  id: t.int(),
  name: t.string(),
  active: t.boolean(),
  created_at: t.timestamp(),
});

const q = users
  .filter((u) => u.active.eq(true))
  .select((u) => ({
    id: u.id,
    name: u.name.trim().upper(),
    created_day: u.created_at.dateTrunc("day"),
    generated_at: currentTimestamp(),
  }))
  .orderBy((u) => [u.created_day.desc(), u.id.asc()])
  .limit(100);

console.log(q.toSql(sqlRenderer({ dialect: "postgresql", format: "pretty" })));
```

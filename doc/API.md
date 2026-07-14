# API Reference

Complete reference for the `@teta/teta` public API.

## Table of Contents

- [Query Roots](#query-roots)
- [Query Steps](#query-steps)
- [Projection Helpers](#projection-helpers)
- [Join Helpers](#join-helpers)
- [Comparison & Logic](#comparison--logic)
- [Arithmetic & Numeric](#arithmetic--numeric)
- [Date & Time](#date--time)
- [String & Regex](#string--regex)
- [Array](#array)
- [Casts & Nulls](#casts--nulls)
- [Aggregation & Grouping](#aggregation--grouping)
- [Window Functions](#window-functions)
- [Builders & Utilities](#builders--utilities)
- [Rendering & Introspection](#rendering--introspection)
- [Schema Helpers](#schema-helpers)
- [Types](#types)

---

## Query Roots

### `table(name, schema)`

Creates a typed query root from a table name and schema definition.

```ts
function table<TName extends string, TSchema extends TableSchema>(
  name: TName,
  schema: TSchema,
): Query<SchemaToColumns<TSchema>>
```

```ts
const users = table("users", {
  id: t.int(),
  name: t.string(),
  active: t.boolean(),
});
```

Use dotted strings for schema-qualified paths (`"analytics.users"`). For table names containing dots, use `table({ table: "my.table" }, schema)`.

### `values(rows)`

Creates a typed query root from inline literal rows.

```ts
function values<TRow extends Record<string, LitValue>>(
  rows: readonly [TRow, ...TRow[]],
): Query<RowsToColumns<TRow>>
```

```ts
const seed = values([
  { id: 1, name: "Ada" },
  { id: 2, name: "Grace" },
]);
```

Requires at least one row. Every row must have the same keys. `undefined` values are not allowed.

---

## Query Steps

All query steps are curried functions. When called without a query argument, they return a `QueryStep<TIn, TOut>`.

### `pipe(query, ...steps)`

Applies steps to a query from left to right.

```ts
function pipe<T, A extends readonly any[]>(
  value: T,
  ...steps: PipeSteps<T, A>
): PipeResult<T, A>
```

```ts
const q = pipe(
  users,
  filter((u) => u.active),
  map((u) => ({ id: u.id })),
  take(10),
);
```

### `flow(...steps)`

Composes unary functions into a reusable function without applying them. The
result is an ordinary function; use `composeSteps(...)` when the composed value
must remain a branded `QueryStep`.

```ts
function flow<T extends readonly any[]>(
  ...steps: [...T]
): FlowResult<T>
```

```ts
const activeUsers = flow(
  filter((u) => u.active),
  pick("id", "name"),
);
const q = activeUsers(users);
```

### `composeSteps(...transforms)`

Composes compatible query-to-query transforms from left to right. The runtime
result is frozen and branded with `kind: "query_step"` and
`stepName: "composeSteps"`, so schema-preserving compositions can be passed to
`whenStep(...)` and `unlessStep(...)`. Calling `composeSteps()` with no
arguments produces a schema-polymorphic `IdentityQueryStep` whose metadata is
also visible in the static type.

```ts
function composeSteps(): IdentityQueryStep

function composeSteps<T0, T1, T2>(
  transform1: (query: Query<T0>) => Query<T1>,
  transform2: (query: Query<T1>) => Query<T2>,
): QueryStep<T0, T2>
```

```ts
const activePage = composeSteps(
  filter((u) => eq(u.active, true)),
  take(50),
);

const q = pipe(users, whenStep(includeActivePage, activePage));
```

TypeScript needs a concrete input schema before `composeSteps(...)` can wrap or
compose schema-polymorphic helpers such as `pick(...)`, `drop(...)`, or
`rename(...)`. Bind the schema with a plain wrapper:

```ts
const idPage = composeSteps(
  (query: typeof users) => pipe(query, pick("id")),
  take(50)
);
```

### `filter(predicate)`

Filters rows with a predicate expression.

```ts
function filter<T extends QueryColumns>(
  predicate: (row: ColumnRefs<T>) => Expr<SqlBoolean | null>,
): QueryStep<T, T>
```

```ts
pipe(users, filter((u) => and(u.active, gte(u.age, 18))));
```

Accepts nullable booleans to match SQL's three-valued logic.

### `filterEq(columnSelector, value)`

Filters rows where a column equals a value.

```ts
function filterEq<T extends QueryColumns, K extends keyof T>(
  columnSelector: (row: ColumnRefs<T>) => Expr<T[K]>,
  value: ExprInput<T[K]>,
): QueryStep<T, T>
```

```ts
pipe(users, filterEq((u) => u.active, true));
```

Also available: `filterNe`, `filterGt`, `filterGte`, `filterLt`, `filterLte`.

### `map(selector)`

Projects each row into a new shape.

```ts
function map<T extends QueryColumns, TOut extends QueryColumns>(
  selector: (row: ColumnRefs<T>) => { [K in keyof TOut]: Expr<TOut[K]> },
): QueryStep<T, TOut>
```

```ts
pipe(users, map((u) => ({ id: u.id, name: upper(u.name) })));
```

### `fold(selector)`

Aggregate projection. Every returned expression must be grouped (`group(...)`) or an aggregate (`count(...)`, `sum(...)`, etc.).

```ts
function fold<T extends QueryColumns, TOut extends QueryColumns>(
  selector: (row: ColumnRefs<T>) => { [K in keyof TOut]: GroupedOrAggregate<TOut[K]> },
): QueryStep<T, TOut>
```

```ts
pipe(
  orders,
  fold((o) => ({
    user_id: group(o.user_id),
    total: sum(o.total),
  })),
);
```

### `sort(selector)`

Adds an `ORDER BY` clause.

```ts
function sort<T extends QueryColumns>(
  selector: (row: ColumnRefs<T>) => OrderItem | readonly OrderItem[],
): QueryStep<T, T>
```

```ts
pipe(users, sort((u) => [desc(u.age), asc(u.id)]));
```

### `take(count)`

Limits the number of rows.

```ts
function take<T extends QueryColumns>(count: number): QueryStep<T, T>
```

### `takeWithin({ partitionBy, orderBy, count })`

Keeps the first N rows within each partition.

```ts
function takeWithin<T extends QueryColumns>(
  spec: TakeWithinSpec<T>,
): QueryStep<T, T>
```

```ts
pipe(
  employees,
  takeWithin({
    partitionBy: (e) => e.role,
    orderBy: (e) => asc(e.join_date),
    count: 1,
  }),
);
```

### `join(right, options)`

Joins two query inputs.

```ts
function join<TLeft extends QueryColumns, TRight extends QueryColumns, TKind extends JoinKind>(
  right: Query<TRight> | ((left: ColumnRefs<TLeft>) => Query<TRight>),
  options: JoinOptions<TLeft, TRight, TKind>,
): QueryStep<TLeft, JoinResult<TLeft, TRight, TKind>>
```

```ts
pipe(
  users,
  join(orders, {
    type: "left",
    on: (user, order) => eq(user.id, order.user_id),
    select: (user, order) => ({ user_id: user.id, order_total: order.total }),
  }),
);
```

`type` can be `"inner"`, `"left"`, `"right"`, or `"full"`. Defaults to `"inner"`.

Use `lateral: true` for lateral/correlated joins.

### `innerJoin(right, on)`, `leftJoin(right, on)`, etc.

Convenience wrappers around `join()` with fixed join types.

```ts
function innerJoin<TLeft extends QueryColumns, TRight extends QueryColumns>(
  right: Query<TRight>,
  on: JoinOn<TLeft, TRight>,
): QueryStep<TLeft, TLeft & TRight>
```

### `union(right)`, `unionAll(right)`

Set operations. Both sides must have compatible row shapes.

```ts
function union<T extends QueryColumns>(
  right: Query<T>,
): QueryStep<T, T>

function unionAll<T extends QueryColumns>(
  right: Query<T>,
): QueryStep<T, T>
```

```ts
pipe(activeUsers, unionAll(inactiveUsers));
```

### `loop(step)`

Builds a recursive CTE from a base query and a recursive step.

```ts
function loop<T extends QueryColumns>(
  step: (self: Query<T>) => Query<T>,
): QueryStep<T, T>
```

```ts
const base = pipe(employees, filter((e) => isNull(e.manager_id)));
const tree = pipe(
  base,
  loop((self) =>
    pipe(
      employees,
      join(self, { on: (e, s) => eq(e.manager_id, s.id), select: (e) => e }),
    ),
  ),
);
```

### `unnest(selector, columns, options?)`

Expands an array-valued expression into rows.

```ts
function unnest<T extends QueryColumns, TV extends string, TO extends string | undefined>(
  selector: (row: ColumnRefs<T>) => Expr<any[] | null>,
  columns: UnnestSelection<TV, TO>,
  options?: UnnestOptions,
): QueryStep<T, UnnestResult<T, TV, TO>>
```

```ts
pipe(users, unnest((u) => u.tags, { value: "tag", ordinality: "tag_index" }));
```

### `identityStep()`

Returns a step that leaves its input unchanged.

```ts
function identityStep<T extends QueryColumns>(): QueryStep<T, T>
```

### `whenStep(condition, step)`, `unlessStep(condition, step)`

Conditionally include or skip a shape-preserving step based on a host-language boolean.

```ts
function whenStep<T extends QueryColumns>(
  condition: boolean,
  step: QueryStep<T, T>,
): QueryStep<T, T>
```

---

## Projection Helpers

### `pick(...keys)`

Keeps only the named columns.

```ts
function pick<T extends QueryColumns, K extends readonly (keyof T)[]>(
  ...keys: K
): QueryStep<T, Pick<T, K[number]>>
```

### `drop(...keys)`

Removes the named columns.

```ts
function drop<T extends QueryColumns, K extends readonly (keyof T)[]>(
  ...keys: K
): QueryStep<T, Omit<T, K[number]>>
```

### `rename(mapper)`

Renames every projected column.

```ts
function rename<T extends QueryColumns>(
  mapper: (key: string) => string,
): QueryStep<T, RenameResult<T>>
```

### `extend(name, selector)`

Adds or replaces one named column while preserving others.

```ts
function extend<T extends QueryColumns, N extends string, V>(
  name: N,
  selector: (row: ColumnRefs<T>) => Expr<V>,
): QueryStep<T, T & { [K in N]: V }>
```

---

## Join Helpers

### `onEq(mapping)`

Builds a join predicate from left-to-right column equality mappings.

```ts
function onEq<TLeft extends QueryColumns, TRight extends QueryColumns>(
  mapping: { [K in keyof TLeft & string]?: keyof TRight & string },
): JoinOn<TLeft, TRight>
```

```ts
join(orders, { type: "left", on: onEq({ id: "user_id" }) });
```

### `usingCols(...names)`

Builds a join predicate by equating same-named columns.

```ts
function usingCols(...names: string[]): JoinOn<any, any>
```

### Overlap merge helpers

When both sides of a join have overlapping column names, use these in the `select` option:

| Helper | Behavior |
|---|---|
| `dropOverlapLeft()` | Drops overlapping columns from the left side |
| `dropOverlapRight()` | Drops overlapping columns from the right side |
| `prefixOverlapLeft(prefix)` | Prefixes overlapping left columns |
| `prefixOverlapRight(prefix)` | Prefixes overlapping right columns |
| `prefixAllLeft(prefix)` | Prefixes all left columns |
| `prefixAllRight(prefix)` | Prefixes all right columns |
| `suffixAllLeft(suffix)` | Suffixes all left columns |
| `suffixAllRight(suffix)` | Suffixes all right columns |

---

## Comparison & Logic

| Function | Signature |
|---|---|
| `eq(left, right)` | `(left: ExprInput<S>, right: ExprInput<S>) => Expr<SqlBoolean \| null>` |
| `ne(left, right)` | `(left: ExprInput<S>, right: ExprInput<S>) => Expr<SqlBoolean \| null>` |
| `gt(left, right)` | `(left: ExprInput<S>, right: ExprInput<S>) => Expr<SqlBoolean \| null>` |
| `gte(left, right)` | `(left: ExprInput<S>, right: ExprInput<S>) => Expr<SqlBoolean \| null>` |
| `lt(left, right)` | `(left: ExprInput<S>, right: ExprInput<S>) => Expr<SqlBoolean \| null>` |
| `lte(left, right)` | `(left: ExprInput<S>, right: ExprInput<S>) => Expr<SqlBoolean \| null>` |
| `like(value, pattern)` | `(value: ExprInput<SqlString>, pattern: string) => Expr<SqlBoolean \| null>` |
| `isIn(value, values)` | `(value: Expr<S>, values: readonly S[]) => Expr<SqlBoolean \| null>` |
| `isNotIn(value, values)` | `(value: Expr<S>, values: readonly S[]) => Expr<SqlBoolean \| null>` |
| `notIn(value, values)` | Alias for `isNotIn` |
| `between(value, lower, upper)` | `(value: Expr<S>, lower: ExprInput<S>, upper: ExprInput<S>) => Expr<SqlBoolean \| null>` |
| `isDistinctFrom(left, right)` | `(left: ExprInput<S>, right: ExprInput<S>) => Expr<SqlBoolean \| null>` |
| `and(...conditions)` | `(...conditions: ExprInput<SqlBoolean \| null>[]) => Expr<SqlBoolean \| null>` |
| `or(...conditions)` | `(...conditions: ExprInput<SqlBoolean \| null>[]) => Expr<SqlBoolean \| null>` |
| `not(value)` | `(value: ExprInput<SqlBoolean \| null>) => Expr<SqlBoolean \| null>` |
| `isNull(value)` | `(value: Expr<S \| null>) => Expr<SqlBoolean>` |
| `isNotNull(value)` | `(value: Expr<S \| null>) => Expr<SqlBoolean>` |

---

## Arithmetic & Numeric

| Function | Signature | SQL |
|---|---|---|
| `add(left, right)` | `(left: ExprInput<N>, right: ExprInput<N>) => Expr<N>` | `+` |
| `sub(left, right)` | `(left: ExprInput<N>, right: ExprInput<N>) => Expr<N>` | `-` |
| `mul(left, right)` | `(left: ExprInput<N>, right: ExprInput<N>) => Expr<N>` | `*` |
| `div(left, right)` | `(left: ExprInput<N>, right: ExprInput<N>) => Expr<N>` | `/` |
| `mod(left, right)` | `(left: ExprInput<N>, right: ExprInput<N>) => Expr<N>` | `MOD` |
| `abs(value)` | `(value: ExprInput<N>) => Expr<N>` | `ABS` |
| `ceil(value)` | `(value: ExprInput<N>) => Expr<N>` | `CEIL` |
| `floor(value)` | `(value: ExprInput<N>) => Expr<N>` | `FLOOR` |
| `sqrt(value)` | `(value: ExprInput<N>) => Expr<N>` | `SQRT` |
| `pow(value, exponent)` | `(value: ExprInput<N>, exponent: ExprInput<N>) => Expr<N>` | `POWER` |
| `round(value, scale?)` | `(value: ExprInput<N>, scale?: number) => Expr<N>` | `ROUND` |
| `greatest(...values)` | `(...values: ExprInput<N>[]) => Expr<N>` | `GREATEST` |
| `least(...values)` | `(...values: ExprInput<N>[]) => Expr<N>` | `LEAST` |

---

## Date & Time

| Function | Signature | SQL |
|---|---|---|
| `extract(value, field)` | `(value: Expr<DT>, field: string) => Expr<SqlNumber>` | `EXTRACT` |
| `dateTrunc(value, unit)` | `(value: Expr<DT>, unit: string) => Expr<DT>` | `DATE_TRUNC` |
| `dateAdd(value, unit, amount)` | `(value: Expr<DT>, unit: string, amount: number) => Expr<DT>` | `DATE_ADD` |
| `dateDiff(value, unit, other)` | `(value: Expr<DT>, unit: string, other: Expr<DT>) => Expr<SqlInt>` | `DATE_DIFF` |
| `dateFormat(value, format)` | `(value: Expr<DT>, format: string) => Expr<SqlString>` | `DATE_FORMAT` |
| `dateParse(value, format)` | `(value: Expr<SqlString>, format: string) => Expr<SqlTimestamp>` | `DATE_PARSE` |
| `toUnixTime(value)` | `(value: Expr<DT>) => Expr<SqlBigInt>` | `TO_UNIXTIME` |
| `fromUnixTime(value)` | `(value: Expr<N>) => Expr<SqlTimestamp>` | `FROM_UNIXTIME` |
| `year(value)` | `(value: Expr<DT>) => Expr<SqlInt>` | `EXTRACT(YEAR ...)` |
| `month(value)` | `(value: Expr<DT>) => Expr<SqlInt>` | `EXTRACT(MONTH ...)` |
| `day(value)` | `(value: Expr<DT>) => Expr<SqlInt>` | `EXTRACT(DAY ...)` |
| `hour(value)` | `(value: Expr<DT>) => Expr<SqlInt>` | `EXTRACT(HOUR ...)` |
| `minute(value)` | `(value: Expr<DT>) => Expr<SqlInt>` | `EXTRACT(MINUTE ...)` |
| `second(value)` | `(value: Expr<DT>) => Expr<SqlInt>` | `EXTRACT(SECOND ...)` |
| `currentDate()` | `() => Expr<SqlDate>` | `CURRENT_DATE` |
| `currentTimestamp()` | `() => Expr<SqlTimestamp>` | `CURRENT_TIMESTAMP` |
| `dateLiteral(value)` | `(value: string) => Expr<SqlDate>` | date literal |
| `timestampLiteral(value)` | `(value: string) => Expr<SqlTimestamp>` | timestamp literal |

---

## String & Regex

| Function | Signature | SQL |
|---|---|---|
| `concat(...parts)` | `(...parts: ExprInput<SqlString>[]) => Expr<SqlString>` | `CONCAT` |
| `upper(value)` | `(value: ExprInput<SqlString>) => Expr<SqlString>` | `UPPER` |
| `lower(value)` | `(value: ExprInput<SqlString>) => Expr<SqlString>` | `LOWER` |
| `trim(value)` | `(value: ExprInput<SqlString>) => Expr<SqlString>` | `TRIM` |
| `substring(value, start, length?)` | `(value: Expr<SqlString>, start: number, length?: number) => Expr<SqlString>` | `SUBSTRING` |
| `position(value, needle)` | `(value: Expr<SqlString>, needle: string) => Expr<SqlInt>` | `POSITION` |
| `overlay(value, placing, start, length?)` | `(value: Expr<SqlString>, placing: string, start: number, length?: number) => Expr<SqlString>` | `OVERLAY` |
| `charLength(value)` | `(value: Expr<SqlString>) => Expr<SqlInt>` | `CHAR_LENGTH` |
| `characterLength(value)` | `(value: Expr<SqlString>) => Expr<SqlInt>` | `CHARACTER_LENGTH` |
| `octetLength(value)` | `(value: Expr<SqlString>) => Expr<SqlInt>` | `OCTET_LENGTH` |
| `bitLength(value)` | `(value: Expr<SqlString>) => Expr<SqlInt>` | `BIT_LENGTH` |
| `replace(value, search, replacement)` | `(value: Expr<SqlString>, search: string, replacement: string) => Expr<SqlString>` | `REPLACE` |
| `reverse(value)` | `(value: Expr<SqlString>) => Expr<SqlString>` | `REVERSE` |
| `left(value, length)` | `(value: Expr<SqlString>, length: number) => Expr<SqlString>` | `LEFT` |
| `right(value, length)` | `(value: Expr<SqlString>, length: number) => Expr<SqlString>` | `RIGHT` |
| `lpad(value, length, padding?)` | `(value: Expr<SqlString>, length: number, padding?: string) => Expr<SqlString>` | `LPAD` |
| `rpad(value, length, padding?)` | `(value: Expr<SqlString>, length: number, padding?: string) => Expr<SqlString>` | `RPAD` |
| `regexLike(value, pattern)` | `(value: Expr<SqlString>, pattern: string) => Expr<SqlBoolean \| null>` | `REGEXP_LIKE` |
| `regexReplace(value, pattern, replacement, flags?)` | `(value: Expr<SqlString>, pattern: string, replacement: string, flags?: string) => Expr<SqlString>` | `REGEXP_REPLACE` |
| `regexExtract(value, pattern, group?)` | `(value: Expr<SqlString>, pattern: string, group?: number) => Expr<SqlString>` | `REGEXP_EXTRACT` |

---

## Array

| Function | Signature | SQL |
|---|---|---|
| `arrayLength(value)` | `(value: Expr<T[]>) => Expr<SqlInt>` | `ARRAY_LENGTH` |
| `arrayContains(value, item)` | `(value: Expr<T[]>, item: T) => Expr<SqlBoolean \| null>` | `ARRAY_CONTAINS` |
| `arrayPosition(value, item)` | `(value: Expr<T[]>, item: T) => Expr<SqlInt>` | `ARRAY_POSITION` |
| `arraySlice(value, start, length?)` | `(value: Expr<T[]>, start: number, length?: number) => Expr<T[]>` | `ARRAY_SLICE` |
| `arrayJoin(value, separator)` | `(value: Expr<SqlString[]>, separator: string) => Expr<SqlString>` | `ARRAY_JOIN` |
| `arrayAppend(value, item)` | `(value: Expr<T[]>, item: T) => Expr<T[]>` | `ARRAY_APPEND` |
| `arrayPrepend(value, item)` | `(value: Expr<T[]>, item: T) => Expr<T[]>` | `ARRAY_PREPEND` |
| `arrayConcat(...values)` | `(...values: Expr<T[]>[]) => Expr<T[]>` | `ARRAY_CONCAT` |
| `arrayDistinct(value)` | `(value: Expr<T[]>) => Expr<T[]>` | `ARRAY_DISTINCT` |
| `array(...values)` | `(...values: T[]) => Expr<T[]>` | `ARRAY[...]` |

---

## Casts & Nulls

| Function | Signature | SQL |
|---|---|---|
| `cast(value, type)` | `(value: ExprInput<S>, type: string) => Expr<T>` | `CAST(x AS type)` |
| `asInt(value)` | `(value: ExprInput<S>) => Expr<SqlInt>` | `CAST(x AS INTEGER)` |
| `asFloat(value)` | `(value: ExprInput<S>) => Expr<SqlFloat>` | `CAST(x AS FLOAT)` |
| `asString(value)` | `(value: ExprInput<S>) => Expr<SqlString>` | `CAST(x AS TEXT)` |
| `asBigInt(value)` | `(value: ExprInput<S>) => Expr<SqlBigInt>` | `CAST(x AS BIGINT)` |
| `asDecimal(value)` | `(value: ExprInput<S>) => Expr<SqlDecimal>` | `CAST(x AS DECIMAL)` |
| `asBoolean(value)` | `(value: ExprInput<S>) => Expr<SqlBoolean>` | `CAST(x AS BOOLEAN)` |
| `asDate(value)` | `(value: ExprInput<S>) => Expr<SqlDate>` | `CAST(x AS DATE)` |
| `asTimestamp(value)` | `(value: ExprInput<S>) => Expr<SqlTimestamp>` | `CAST(x AS TIMESTAMP)` |
| `asUuid(value)` | `(value: ExprInput<S>) => Expr<SqlUuid>` | `CAST(x AS UUID)` |
| `asBytes(value)` | `(value: ExprInput<S>) => Expr<SqlBytes>` | `CAST(x AS BYTEA)` |
| `asJson(value)` | `(value: ExprInput<S>) => Expr<SqlJson<unknown>>` | `CAST(x AS JSON)` |
| `coalesce(value, ...fallbacks)` | `(value: Expr<S \| null>, ...fallbacks: ExprInput<S>[]) => Expr<S>` | `COALESCE` |
| `nullIf(value, other)` | `(value: Expr<S>, other: ExprInput<S>) => Expr<S \| null>` | `NULLIF` |

---

## Aggregation & Grouping

| Function | Signature | SQL |
|---|---|---|
| `group(value)` | `(value: Expr<S>) => Expr<S, "group">` | marks as GROUP BY key |
| `count(value)` | `(value: Expr<any>) => Expr<SqlInt, "aggregate">` | `COUNT` |
| `sum(value)` | `(value: Expr<N>) => Expr<N, "aggregate">` | `SUM` |
| `avg(value)` | `(value: Expr<N>) => Expr<N, "aggregate">` | `AVG` |
| `min(value)` | `(value: Expr<S>) => Expr<S, "aggregate">` | `MIN` |
| `max(value)` | `(value: Expr<S>) => Expr<S, "aggregate">` | `MAX` |
| `arrayAgg(value)` | `(value: Expr<S>) => Expr<S[], "aggregate">` | `ARRAY_AGG` |

---

## Window Functions

| Function | Signature | SQL |
|---|---|---|
| `rank()` | `() => Expr<SqlInt>` | `RANK` |
| `denseRank()` | `() => Expr<SqlInt>` | `DENSE_RANK` |
| `rowNumber()` | `() => Expr<SqlInt>` | `ROW_NUMBER` |
| `percentRank()` | `() => Expr<SqlFloat>` | `PERCENT_RANK` |
| `ntile(buckets)` | `(buckets: number) => Expr<SqlInt>` | `NTILE` |
| `lag(value, offset?, fallback?)` | `(value: Expr<S>, offset?: number, fallback?: S) => Expr<S>` | `LAG` |
| `lead(value, offset?, fallback?)` | `(value: Expr<S>, offset?: number, fallback?: S) => Expr<S>` | `LEAD` |
| `sumOver(value, spec)` | `(value: Expr<N>, spec: WindowSpec) => Expr<N>` | `SUM(...) OVER (...)` |
| `over(windowFn, spec)` | `(windowFn: Expr<S>, spec: WindowSpec) => Expr<S>` | `... OVER (...)` |
| `asc(value)` | `(value: Expr<S>) => OrderItem` | `ASC` |
| `desc(value)` | `(value: Expr<S>) => OrderItem` | `DESC` |

`WindowSpec` shape:

```ts
interface WindowSpec {
  partitionBy?: Expr<any> | readonly Expr<any>[];
  orderBy?: OrderItem | readonly OrderItem[];
}
```

---

## Builders & Utilities

| Function | Signature | Description |
|---|---|---|
| `lit(value)` | `(value: T) => Expr<T>` | Wraps a host-language literal as an expression |
| `param<T>(name)` | `(name: string) => Expr<T>` | Named parameter placeholder |
| `fn<T>(name, ...args)` | `(name: string, ...args: ExprInput<any>[]) => Expr<T>` | Generic SQL function call |
| `windowFn<T>(name, ...args)` | `(name: string, ...args: ExprInput<any>[]) => Expr<T>` | Generic window function (before `over()`) |
| `when(cond, val, ...pairs)` | `(cond: ExprInput<SqlBoolean>, val: ExprInput<S>, ...rest: WhenPair<S>[]) => Expr<S>` | `CASE WHEN ... THEN ... END` |
| `f\`...\`` | template tag | String concatenation via `CONCAT` |
| `mapShape(obj, mapper)` | `(obj: T, mapper: (expr: Expr<any>) => Expr<any>) => T` | Maps each expression in a shape |
| `groupShape(obj)` | `(obj: T) => GroupedShape<T>` | Applies `group()` to each expression in a shape |

### `when(condition, value, ...pairs)`

```ts
map((u) => ({
  age_group: when(
    lt(u.age, 18), "minor",
    lt(u.age, 65), "adult",
    true, "senior",
  ),
}));
```

### `f\`template\`` (string concatenation)

```ts
map((u) => ({ full: f`${u.first} ${u.last}` }));
// Renders as: CONCAT(first, ' ', last)
```

### `lit(value)` and type brands

```ts
const name: Expr<SqlString> = lit("Ada");
const active: Expr<SqlBoolean> = lit(true);
const id: Expr<SqlNumber> = lit(1);   // SqlNumber = SqlInt | SqlFloat | SqlBigInt | SqlDecimal
const bigId: Expr<SqlBigInt> = lit(1n);
```

### `param<T>(name)`

```ts
pipe(users, filter((u) => eq(u.id, param<SqlInt>("id"))));

// Render with bound values:
toSqlResult(q, { dialect: "postgresql", params: { id: 42 } });
```

### `fn<T>(name, ...args)` and `windowFn<T>(name, ...args)`

Import these database-specific builders from `@teta/teta/advanced`. Names must
be SQL identifiers; arbitrary SQL fragments are rejected.

```ts
map((u) => ({ hash: fn<SqlString>("md5", u.email) }));
map((u) => ({ pct: over(windowFn<SqlFloat>("percent_rank"), { orderBy: desc(u.score) }) }));
```

---

## Rendering & Introspection

### `toSql(query, options)`

Renders a query or expression to a SQL string.

```ts
function toSql(
  target: SqlRenderable,
  options: SqlOptions,
): string
```

```ts
toSql(q, { dialect: "postgresql" });
toSql(q, { dialect: "postgresql", format: "pretty" });
toSql(q, { dialect: "sqlite", renderStrategy: "readable" });
```

### `toSqlResult(query, options)`

Renders to structured SQL + params.

```ts
function toSqlResult(
  target: SqlRenderable,
  options: SqlOptions,
): SqlResult
```

```ts
const { sql, params } = toSqlResult(q, {
  dialect: "postgresql",
  parameterMode: "named",
  params: { id: 42 },
});
```

### `toIR(query)`

Lowers a query to the backend intermediate representation.

```ts
function toIR<T extends QueryColumns>(query: Query<T>): QueryIR<T>
```

### `toAst(query, options)`

Lowers a query to the parser AST.

```ts
function toAst(query: Query<any>, options: SqlOptions): AST
```

### `explain(query, options)`

Returns structured debug output: stages, CTEs, SQL, AST, params.

```ts
function explain<T extends QueryColumns>(
  query: Query<T>,
  options: SqlOptions,
): QueryExplainResult<T>
```

```ts
const info = explain(q, { dialect: "postgresql", renderStrategy: "readable" });
info.stages;  // array of stage descriptors
info.ctes;    // array of CTE descriptors
info.sql;     // final SQL string
```

### `isQuery(value)`, `isExpr(value)`, `isColumn(value)`

Runtime type guards.

```ts
function isQuery(value: unknown): value is Query<any>
function isExpr(value: unknown): value is Expr<any>
function isColumn(value: unknown): value is Column<any, any>
```

---

## Schema Helpers

All available through the `t` namespace:

| Helper | SQL type | JS runtime type |
|---|---|---|
| `t.string()` | `SqlString` | `string` |
| `t.int()` | `SqlInt` | `number` |
| `t.float()` | `SqlFloat` | `number` |
| `t.bigint()` | `SqlBigInt` | `bigint` |
| `t.decimal()` | `SqlDecimal` | `number` |
| `t.boolean()` | `SqlBoolean` | `boolean` |
| `t.date()` | `SqlDate` | `string` |
| `t.timestamp()` | `SqlTimestamp` | `string` |
| `t.uuid()` | `SqlUuid` | `string` |
| `t.bytes()` | `SqlBytes` | `Uint8Array` |
| `t.json<T>()` | `SqlJson<T>` | `T` |
| `t.array(inner)` | `T[]` | `T[]` |
| `t.nullable(inner)` | `T \| null` | `T \| null` |

---

## Types

### Core EDSL types

| Type | Description |
|---|---|
| `Expr<T, Phase?>` | Typed SQL expression |
| `Query<T>` | Opaque query value with row shape `T` |
| `QueryColumns` | Constraint for object-shaped query rows |
| `QueryStep<TIn, TOut>` | Curried query transformation |
| `IdentityQueryStep` | Branded schema-polymorphic identity transformation |
| `Column<T, Name>` | Typed column reference |
| `JoinKind` | `"inner"` \| `"left"` \| `"right"` \| `"full"` |

### SQL value brands

| Type | Description |
|---|---|
| `SqlInt` | Integer |
| `SqlFloat` | Float |
| `SqlBigInt` | Big integer |
| `SqlDecimal` | Decimal |
| `SqlNumber` | `SqlInt \| SqlFloat \| SqlBigInt \| SqlDecimal` |
| `SqlString` | Text |
| `SqlBoolean` | Boolean |
| `SqlDate` | Date |
| `SqlTimestamp` | Timestamp |
| `SqlUuid` | UUID |
| `SqlBytes` | Bytes |
| `SqlJson<T>` | JSON with payload type `T` |

### Render types

| Type | Description |
|---|---|
| `SqlOptions` | Dialect, format, render strategy, params |
| `SqlResult` | `{ sql: string; params: SqlParam[] }` |
| `SqlRenderable` | Union accepted by `toSql()` |
| `SqlFormat` | `"compact"` \| `"pretty"` |
| `SqlRenderStrategy` | `"optimized"` \| `"readable"` |
| `QueryIR<T>` | Lowered intermediate representation |
| `QueryExplainResult<T>` | Structured debug output |

### Dialect types

| Type | Description |
|---|---|
| `BuiltinDialect` | Built-in dialect name (e.g. `"postgresql"`) |
| `DialectSpec` | Custom dialect configuration |
| `Dialect` | `BuiltinDialect \| DialectSpec` |
| `QueryDialect` | Resolved dialect metadata |
| `DialectFeatures` | Feature flags (lateral, recursive) |
| `DialectLanguageConfig` | Function mappings and fallbacks |
| `DialectLanguageFallback` | Built-in fallback identifiers |

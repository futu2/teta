# Functional EDSL Redesign Design

## Goal

Redesign the Teta SQL EDSL toward a smaller, more functional public model. Backward compatibility is not required.

The new design should make query programs easier to compose, keep strong TypeScript inference through callback row parameters, and remove the deferred column-reference system that currently adds significant overload and validation complexity.

## Decisions

- Query and expression values are plain immutable tagged values, not public classes.
- Query helpers remain curried and positional.
- Joins use fixed helpers instead of object configuration.
- Column access is callback-only; remove `col(...)`, `leftCol(...)`, and `rightCol(...)`.
- Public vocabulary stays functional/relational rather than SQL-syntax-oriented.
- Ergonomic helper modules stay, but helpers are rebuilt around callbacks and typed names.

## Public Core Shape

The public core should expose immutable values with tags:

```ts
type Query<Row> = Readonly<{
  kind: "Query";
  state: QueryState<Row>;
}>;

type Expr<Value> = Readonly<{
  kind: "Expr";
  node: ExprNode<Value>;
}>;

type QueryStep<Input, Output> = (query: Query<Input>) => Query<Output>;
```

The runtime may keep private constructors or internal helpers, but public checks should use tags such as `isQuery(...)` and `isExpr(...)` rather than `instanceof`.

All query transforms return new values. Existing query and expression values are immutable from the caller's perspective.

## Composition Model

`pipe(...)` and `flow(...)` remain the primary composition tools:

```ts
const activeUsers = flow(
  filter((user) => eq(user.active, true)),
  map((user) => ({
    id: user.id,
    email: user.email,
  })),
  sort((user) => asc(user.email)),
  take(50)
);

const query = activeUsers(users);
```

Query helpers stay curried-only:

```ts
filter(predicate)
map(selector)
extend(selector)
sort(selector)
take(count)
```

No data-first query helper forms are reintroduced.

## Column Access

Column references are available only through typed callback row parameters:

```ts
filter((user) => eq(user.active, true))

map((user) => ({
  id: user.id,
  normalized_email: lower(user.email),
}))

sort((user) => asc(user.email))
```

Remove these public helpers:

```ts
col("name")
leftCol("name")
rightCol("name")
```

Join callbacks receive separate typed row parameters:

```ts
leftJoin(orders, (user, order) => eq(user.id, order.user_id))
```

This removes the need for deferred current/left/right scopes, deferred column resolution, and phantom dependency guards throughout expression helper types.

## Query Vocabulary

Keep names that describe transformations rather than SQL syntax:

- `map` replaces the row shape.
- `extend` adds or replaces fields.
- `filter` keeps rows that satisfy a predicate.
- `fold` keeps the existing aggregate/group transformation vocabulary.
- `sort` orders rows.
- `take` limits row count.
- `join`, fixed join helpers, `union`, `unionAll`, `unnest`, and `loop` keep their functional pipeline roles.

Do not rename the core vocabulary to `select`, `where`, or `limit` in this redesign. Avoid implying that each helper maps directly to one SQL clause.

## Fixed Join Helpers

Prefer fixed positional helpers:

```ts
innerJoin(orders, (user, order) => eq(user.id, order.user_id))
leftJoin(orders, (user, order) => eq(user.id, order.user_id))
rightJoin(orders, (user, order) => eq(user.id, order.user_id))
fullJoin(orders, (user, order) => eq(user.id, order.user_id))
```

Avoid optional positional arguments whose meaning depends on shape. In particular, avoid signatures where the same position might mean merge, projection, or options.

For custom output, use separate fixed helpers instead of overloading the base join helpers:

```ts
leftJoinMap(
  orders,
  (user, order) => eq(user.id, order.user_id),
  (user, order) => ({
    user_id: user.id,
    total: order.total,
  })
)
```

For merge-style helpers, use explicit fixed helper names:

```ts
leftJoinMerge(orders, onEq("id", "user_id"), prefixOverlapRight("order_"))
```

The exact mapped and merged helper names can be finalized during implementation planning. The design rule is fixed: positional helpers are preferred, and ambiguous optional positional overloads are not allowed.

## Helper Modules

Keep ergonomic helpers because they reduce typing and keep query programs compact. Move them into a separate helper layer if needed so the core remains small.

Examples:

```ts
filterEq((user) => user.active, true)
filterGte((user) => user.age, 18)
pick("id", "email")
drop("internal_id")
rename((key) => `user_${key}`)
onEq("id", "user_id")
prefixOverlapRight("order_")
```

Helpers must be built on callback row access or typed column names. They must not depend on deferred expression refs such as `col(...)`.

Possible module split:

```txt
@teta/teta/core
  Query, Expr, table, values, pipe, flow, map, extend, filter, fold, sort, take, joins

@teta/teta/helpers
  pick, drop, rename, filterEq, filterGte, onEq, prefix/suffix join helpers

@teta/teta
  Stable convenience entrypoint that re-exports the intended public surface
```

The package can still provide a single main entrypoint. The split is mainly an ownership boundary for keeping core types small.

## Type Strategy

Use callback selectors as the strongest inference boundary:

```ts
map((row) => ({ id: row.id }))
extend((row) => ({ lower_email: lower(row.email) }))
filter((row) => eq(row.active, true))
leftJoin(orders, (left, right) => eq(left.id, right.user_id))
```

This preserves autocomplete and exact row types without deferred dependency tracking.

Public helper types should favor a few predictable shapes:

```ts
type RowOf<T> = T extends Query<infer Row> ? Row : never;
type QueryStep<Input, Output> = (query: Query<Input>) => Query<Output>;
type RowSelector<Row, Value> = (row: ColumnRefs<Row>) => Value;
type JoinSelector<Left, Right, Value> =
  (left: ColumnRefs<Left>, right: ColumnRefs<Right>) => Value;
```

String-name helpers such as `pick(...)`, `drop(...)`, and `onEq(...)` should validate known keys at type level where practical and provide user-facing runtime errors where TypeScript cannot help.

## Internal Architecture

Separate the EDSL into layers:

```txt
core/
  query.ts       Query value, QueryStep, primitive constructors
  expr.ts        Expr value, expression constructors
  schema.ts      table and values constructors

query/
  map.ts
  extend.ts
  filter.ts
  fold.ts
  sort.ts
  take.ts
  join.ts

helpers/
  projection.ts
  filter_comparison.ts
  join_merge.ts

compiler/
  lower.ts       Query -> @teta/sql IR
```

The core should not know about convenience helper overloads. Helpers should lower into a small set of primitive query transforms.

The SQL backend package remains responsible for SQL IR rendering and dialect behavior. This redesign concerns the frontend EDSL.

## Error Handling

Removed public APIs should fail clearly if called at runtime through untyped code:

```text
col() was removed. Use a row callback such as filter((row) => eq(row.name, "Ada")).
```

Data-first query helpers should continue to fail with existing curried-only style errors.

Unknown column names in string helpers should report the available columns.

## Documentation

Update public docs around the new canonical style:

```ts
pipe(
  users,
  filter((user) => eq(user.active, true)),
  extend((user) => ({
    normalized_email: lower(user.email),
  })),
  map((user) => ({
    id: user.id,
    normalized_email: user.normalized_email,
  }))
)
```

Docs should explicitly state that columns are accessed through callback parameters. There is no `col(...)`, `leftCol(...)`, or `rightCol(...)` shorthand.

Join docs should emphasize fixed positional helpers and separate helpers for mapped or merged join output.

## Testing

Add or update tests for:

- plain tagged query and expression values replacing public class checks
- callback-only `filter`, `map`, `extend`, `fold`, `sort`, and `unnest`
- fixed positional join helpers
- mapped join helpers such as `leftJoinMap` if introduced
- merge-specific join helpers such as `leftJoinMerge` if introduced
- helper-module APIs rebuilt without `col(...)`
- runtime errors for removed `col(...)`, `leftCol(...)`, and `rightCol(...)` when reachable through untyped imports
- type failures for old deferred column helper usage

Type tests should confirm:

- callback row parameters preserve exact input row fields
- `map` replaces row shape
- `extend` preserves existing fields and replaces overlapping keys
- fixed join helpers infer left and right row parameters
- helper functions such as `filterEq` and `onEq` validate keys or operand types

## Non-Goals

- Do not add method-chain APIs.
- Do not reintroduce data-first query helpers.
- Do not keep `col(...)`, `leftCol(...)`, or `rightCol(...)`.
- Do not rename the core vocabulary to SQL clause names.
- Do not redesign the SQL backend renderer in this change.
- Do not require object-based join configuration.

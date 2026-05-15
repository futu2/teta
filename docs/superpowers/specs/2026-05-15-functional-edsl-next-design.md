# Functional EDSL Next-Step Design

## Goal

Move the current SQL EDSL further toward a small functional core with immutable values, predictable curried combinators, and less runtime overload machinery. Backward compatibility is not required.

The current callback-only query style is the right public direction and should remain the canonical API:

```ts
pipe(
  users,
  filter((user) => eq(user.active, true)),
  extend((user) => ({ normalized_email: lower(user.email) })),
  pick("id", "normalized_email"),
  take(50)
);
```

This design focuses on simplifying the implementation and public model behind that style.

## Decisions

- Keep curried, data-last query helpers as the only public helper shape.
- Keep callback row access as the only column access model.
- Replace public classes with immutable tagged values.
- Replace `instanceof` checks with structural guards.
- Remove legacy/data-first overload detection and ambiguous join parsing.
- Prefer fixed join helpers over a generic options-driven `join(...)`.
- Split the primitive EDSL core from convenience helpers.
- Make callback row proxies reject unknown runtime column access.

## Public Value Model

Expose query and expression values as tagged immutable objects:

```ts
type Query<Row> = Readonly<{
  kind: "query";
  state: QueryState<Row>;
}>;

type Expr<Value> = Readonly<{
  kind: "expr";
  node: ExprNode<Value>;
}>;

type Column<Value, Name extends string> = Readonly<{
  kind: "column";
  node: ExprNode<Value>;
  table: ColumnTableRef;
  name: Name;
}>;
```

The public package should export types and guards, not classes:

```ts
isQuery(value): value is Query<unknown>
isExpr(value): value is Expr<unknown>
isColumn(value): value is Column<unknown, string>
```

Constructors can remain private functions such as `queryOf(...)`, `exprOf(...)`, and `columnOf(...)`. Public users should not instantiate EDSL values directly.

## Query Composition

The public composition model remains:

```ts
type QueryStep<Input, Output> = (query: Query<Input>) => Query<Output>;
```

Primitive helpers keep one public call shape:

```ts
filter(predicate)
map(selector)
extend(selector)
fold(selector)
sort(selector)
take(count)
union(right)
unionAll(right)
unnest(selector, selection, options?)
loop(step)
```

Data-first helper forms are removed rather than detected. Runtime errors should validate malformed current API usage, not probe for retired APIs.

## Joins

Use fixed helpers as the primary public API:

```ts
innerJoin(right, on)
leftJoin(right, on)
rightJoin(right, on)
fullJoin(right, on)

innerJoinMap(right, on, selector)
leftJoinMap(right, on, selector)
rightJoinMap(right, on, selector)
fullJoinMap(right, on, selector)

innerJoinMerge(right, on, merge)
leftJoinMerge(right, on, merge)
rightJoinMerge(right, on, merge)
fullJoinMerge(right, on, merge)
```

The generic `join(...)` helper should be removed from the public convenience surface. If a lower-level generic helper is kept internally, it should take an explicit join type in a fixed position and should not accept an options object that changes output meaning.

Lateral joins remain supported through fixed options:

```ts
leftJoin((outer) => ordersFor(outer.id), on, { lateral: true })
```

The only allowed fixed join option is `lateral?: boolean`.

## Column Access

Typed row callbacks remain the inference boundary:

```ts
filter((user) => eq(user.id, 1))
leftJoin(orders, (user, order) => eq(user.id, order.user_id))
```

The row proxy should only expose known columns at runtime. Accessing an unknown property through untyped code should throw a user-facing error:

```text
Unknown column 'missing'. Available columns: id, name, email.
```

This makes JavaScript usage and `as any` escape hatches fail early instead of silently building invalid references.

## Helper Layer

Convenience helpers stay, but they are not part of the primitive core:

```ts
pick("id", "email")
drop("internal_id")
rename((key) => `user_${key}`)
filterEq((user) => user.active, true)
onEq({ id: "user_id" })
prefixOverlapRight("order_")
```

Helpers should lower into primitive query steps and expression constructors. They should not need special paths inside core query construction.

## Module Shape

Refactor toward these ownership boundaries:

```txt
edsl/core/query.ts
  Query type, QueryStep type, query constructors, guards, derive helpers

edsl/core/expr.ts
  Expr and Column types, expression constructors, guards, node conversion

edsl/core/columns.ts
  Row callback proxy construction and strict runtime column lookup

edsl/query/filter.ts
edsl/query/project.ts
edsl/query/fold.ts
edsl/query/sort.ts
edsl/query/take.ts
edsl/query/join.ts
edsl/query/union.ts
edsl/query/unnest.ts
edsl/query/loop.ts
  Primitive query steps

edsl/query/render.ts
  toIR, toAst, toSql, toSqlResult, explain

edsl/helpers/*.ts
  pick, drop, rename, filter comparison helpers, join merge helpers
```

The top-level package entrypoint can continue to re-export the intended public surface, but it should no longer expose constructor values for `Query` or `ExprRef`.

## Error Handling

Runtime validation should focus on current API contracts:

- A row callback helper receives a non-function.
- A projection helper returns an invalid or empty object shape.
- A fixed join helper receives invalid options.
- A row callback accesses an unknown column.
- `values(...)` receives empty rows, undefined values, or mismatched row shapes.

Runtime validation should not execute user callbacks just to infer whether a retired data-first overload was attempted.

## Testing

Keep the existing SQL rendering and typecheck tests, then add focused tests for:

- `isQuery`, `isExpr`, and `isColumn` structural guards.
- Public values being immutable from the caller perspective.
- `toExprNode(...)` accepting tagged expressions and rejecting malformed values.
- Unknown runtime column access failing with available column names.
- Fixed join helpers replacing public `join(...)` behavior.
- Removal of public constructor exports from the top-level entrypoint.

## Migration Scope

Backward compatibility is intentionally out of scope. The implementation can update tests, docs, examples, and public exports to the new API in one coordinated change.

The SQL backend package is out of scope except where frontend lowering needs type updates. SQL IR shape, renderer behavior, and dialect behavior should remain unchanged.

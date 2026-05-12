# Typed Column Reference API

## Context

The deferred row proxy API uses `$`, `$left`, and `$right`:

```ts
filter(eq($.active, true))
leftJoin(orders, eq($left.id, $right.user_id))
```

This is concise, but proxy property access is typed as an arbitrary string key. TypeScript and the LSP cannot reject a misspelled column name at author time. The error is only raised when Teta resolves the deferred expression at runtime.

The callback API remains fully typed:

```ts
leftJoin(orders, (user, order) => eq(user.id, order.user_id))
```

The goal is to add a concise API that can also participate in query-context type checking.

## Public API

Add three string-literal column reference helpers:

```ts
col("id")
leftCol("id")
rightCol("user_id")
```

`col(...)` addresses the current row in single-input helpers:

```ts
pipe(
  users,
  filter(eq(col("active"), true)),
  map({
    id: col("id"),
    name: upper(col("name")),
  }),
  sort(asc(col("name")))
);
```

`leftCol(...)` and `rightCol(...)` address join sides:

```ts
pipe(
  users,
  leftJoin(
    orders,
    eq(leftCol("id"), rightCol("user_id")),
    {
      user_id: leftCol("id"),
      order_total: rightCol("total"),
    }
  )
);
```

The existing `$`, `$left`, and `$right` exports stay available as runtime-checked shorthand. Documentation should steer users toward `col`, `leftCol`, and `rightCol` when they want LSP/type errors for bad column names.

## Type Behavior

The new helpers return deferred expression refs that carry phantom dependency metadata:

- `col("name")` records a current-row dependency on `"name"`.
- `leftCol("id")` records a join-left dependency on `"id"`.
- `rightCol("user_id")` records a join-right dependency on `"user_id"`.

Expression helpers preserve this metadata when composing expressions, so this can be checked later:

```ts
eq(leftCol("id"), rightCol("user_id"))
upper(col("name"))
and(eq(col("active"), true), gt(col("age"), 18))
```

Query helper overloads validate dependency metadata against the query columns in context. Misspelled columns should fail in `tsc` and the LSP:

```ts
// @ts-expect-error unknown current-row column
pipe(users, filter(eq(col("actve"), true)));

// @ts-expect-error unknown join-right column
pipe(users, leftJoin(orders, eq(leftCol("id"), rightCol("usr_id"))));
```

## Runtime Behavior

Runtime resolution remains the same deferred-column mechanism used by `$`, `$left`, and `$right`:

- `col(...)` resolves against the current query row.
- `leftCol(...)` resolves against join-left columns.
- `rightCol(...)` resolves against join-right columns.
- using `leftCol(...)` or `rightCol(...)` outside a join helper raises the existing deferred scope error.
- runtime unknown-column errors remain for JavaScript users and any values that escape static checking.

## Compatibility

This is additive.

Existing callback selectors and proxy shorthand continue to work. No SQL rendering behavior changes. The SQL renderer should still only receive resolved expression refs, projection shapes, and order items.

Docs should present `col`, `leftCol`, and `rightCol` as the recommended no-callback API. `$`, `$left`, and `$right` can be documented as concise runtime-checked shorthand.

## Testing

Add typecheck cases for:

- `col("missing")` rejected in `filter`, `map`, `fold`, `sort`, and `unnest` query contexts.
- `leftCol("missing")` rejected in join predicates and merge shapes.
- `rightCol("missing")` rejected in join predicates and merge shapes.
- composed expressions preserve column dependencies through common helpers such as `eq`, `and`, `upper`, `sum`, `group`, `asc`, and `desc`.

Add runtime equivalence tests comparing callback, proxy, and `col` forms for:

- filter
- map
- fold
- sort
- unnest
- join predicate
- join merge shape


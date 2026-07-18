# @teta/teta

Type-safe SQL EDSL frontend for TypeScript.

`@teta/teta` builds typed query IR and keeps direct convenience helpers such as `toSql(...)`. The reusable SQL backend lives in `@teta/sql`.

When another language needs to produce the same query representation, use the
[Portable IR v1 guide](../../doc/PORTABLE_IR.md) and render it through
`@teta/sql`.

## Install

### Deno

```bash
deno add jsr:@teta/teta
```

### Bun

```bash
bunx jsr add @teta/teta
```

### Node.js

```bash
npx jsr add @teta/teta
```

## Quick start

```ts
import { and, asc, eq, filter, gte, map, sort, table, t, take, toSql, pipe } from "@teta/teta";

const users = table("users", {
  id: t.int(),
  email: t.string(),
  active: t.boolean(),
  age: t.int(),
});

const activeUsers = pipe(
  users,
  filter((user) => and(eq(user.active, true), gte(user.age, 18))),
  map((user) => ({ id: user.id, email: user.email })),
  sort((user) => asc(user.email)),
  take(10)
);

console.log(toSql(activeUsers, { dialect: "postgresql", format: "pretty" }));
```

The root entrypoint remains the easiest import path. For narrower module
boundaries, the package also exposes subpath entrypoints:

```ts
import { table, t, filter } from "@teta/teta/query";
import { eq } from "@teta/teta/expr";
import { pipe } from "@teta/teta/pipe";
import { fn, windowFn } from "@teta/teta/advanced";
import { toAst } from "@teta/teta/inspect";
```

The default entrypoint intentionally excludes compiler-node constructors,
database-specific function builders, and parser-specific AST inspection. Use
`@teta/teta/advanced` for validated custom `fn(...)` and `windowFn(...)` calls,
`@teta/teta/inspect` when you explicitly need the backend parser AST, and
`@teta/sql` directly when building or rendering public IR from another
frontend.

Reusable functional pipelines can be saved with `flow(...)`, while `map(...)` selects and computes output columns:

```ts
import { composeSteps, filterEq, flow, lower, map, pipe, take, whenStep } from "@teta/teta";

const activePublicUsers = flow(
  filterEq((user) => user.active, true),
  map((user) => ({ id: user.id, normalized_email: lower(user.email) })),
  whenStep(includeLimit, take(50))
);
```

`flow(...)` remains the general-purpose function composer. Use
`composeSteps(...)` when compatible query transforms should become one frozen,
metadata-bearing query step, including when the result will be passed to
`whenStep(...)` or `unlessStep(...)`:

```ts
const activePage = composeSteps(
  filterEq((user: typeof users.columns) => user.active, true),
  take(50)
);

const usersQuery = pipe(users, whenStep(includeActivePage, activePage));
```

Query values expose `columns` for typed expression reuse, but internal compiler details such as sources, stages, CTEs, and generated names are intentionally opaque. Use `toIR(query)` or `explain(query, ...)` when you need to inspect lowered query structure. Query steps are callable values with lightweight `kind` and `stepName` metadata for tooling/debugging.

Query construction is immutable and normalization is handled as a pure compiler
pass. Newly allocated query and expression nodes are frozen once, while
previously frozen plan structure is shared between derived queries.

Row shapes are constrained to SQL value types, and table schemas must be non-empty objects built from `t.*` column helpers. Aggregate projections are checked separately from row projections. In `fold(...)`, use `group(...)` / `groupShape(...)` for grouping keys and aggregate helpers such as `count(...)`, `sum(...)`, or `arrayAgg(...)` for aggregate outputs.

Comparison filter helpers require at least one row callback; direct values are allowed only as the other operand.
`distinct()` removes duplicate rows without changing the query's row type.

`whenStep(...)` and `unlessStep(...)` use host-language booleans to include or skip schema-preserving steps while building a query; use `filter(...)` and predicate expressions for conditions evaluated by SQL.

Use `map(...)` for explicit object-shaped projections. `pick(...)`, `drop(...)`,
and `rename(...)` are pure record helpers that compose inside `map(...)`:

```ts
import { drop, map, pick, rename, upper } from "@teta/teta";

const publicUsers = pipe(
  users,
  map((user) => ({
    id: user.id,
    email_upper: upper(user.email),
  }))
);
```

Use `pick(...)` to retain existing fields in a specific order. Pass names either
as variadic arguments or as a key array:

```ts
const publicUsers = pipe(users, map(pick("id", "email")));
const sameUsers = pipe(users, map(pick(["id", "email"])));
```

Use `drop(...)` to remove fields while preserving the order of everything else:

```ts
const safeUsers = pipe(
  users,
  map(drop("password_hash", "recovery_token"))
);
```

Use `rename(...)` when every field name follows the same mapping rule:

```ts
const prefixedUsers = pipe(
  users,
  map(rename((key) => `user_${key}`))
);
```

Use `join(...)` with a join-kind specification. The optional second argument to
the specification selects or merges the output columns:

```ts
import { eq, join, left } from "@teta/teta";

const orders = table("orders", {
  order_id: t.int(),
  user_id: t.int(),
  total: t.float(),
});

const usersWithOrders = pipe(
  users,
  join(orders, left(
    (user, order) => eq(user.id, order.user_id),
    (user, order) => ({
      user_id: user.id,
      order_total: order.total,
    })
  ))
);
```

The available specifications are `inner(on, select?)`, `left(on, select?)`,
`right(on, select?)`, and `full(on, select?)`. Merge helpers such as
`dropOverlapRight()` can be passed in the same position as a selector.

Predicates involving nullable expressions are typed as `Expr<SqlBoolean | null>` and are accepted by `filter(...)`, matching SQL's three-valued boolean behavior.

For explicit frontend/backend use, lower the query to IR and render it through `@teta/sql`:

```ts
import { irToSql } from "@teta/sql";
import { toIR, toSql } from "@teta/teta";

const direct = toSql(activeUsers, { dialect: "postgresql" });
const explicit = irToSql(toIR(activeUsers), { dialect: "postgresql" });
```

For a standalone placeholder, provide a runtime SQL type descriptor and pass its value when rendering:

```ts
import { eq, filter, param, pipe, t, toSqlResult } from "@teta/teta";

const byId = pipe(
  users,
  filter((user) => eq(user.id, param("id", t.int())))
);

const result = toSqlResult(byId, {
  dialect: "postgresql",
  params: { id: 42 },
});
```

For positional driver placeholders, use numeric parameter names with array bindings:

```ts
const byPosition = pipe(
  users,
  filter((user) => eq(user.id, param("1", t.int())))
);

const positional = toSqlResult(byPosition, {
  dialect: "postgresql",
  parameterMode: "positional",
  parameterPrefix: "$",
  params: [42],
});
```

Prefer `prepare(...)` for reusable application queries. Its descriptor schema
creates typed parameter expressions, requires exact binding keys, and validates
values before rendering:

```ts
import { eq, filter, gte, pipe, prepare, t, toSqlResult } from "@teta/teta";

const byUserCriteria = prepare(
  { userId: t.int(), minimumAge: t.int() },
  (params) => pipe(
    users,
    filter((user) => eq(user.id, params.userId)),
    filter((user) => gte(user.age, params.minimumAge)),
  ),
);

const prepared = toSqlResult(byUserCriteria, {
  dialect: "postgresql",
  params: { userId: 42, minimumAge: 18 },
});
```

The callback form gives autocomplete and compile-time column checks while keeping query steps reusable:

```ts
import { and, asc, eq, filter, gte, map, sort, pipe } from "@teta/teta";

const activeUsers = pipe(
  users,
  filter((user) => and(eq(user.active, true), gte(user.age, 18))),
  map((user) => ({ id: user.id, email: user.email })),
  sort((user) => asc(user.email))
);
```

Additional predicate helpers include `between(...)`, `isNotIn(...)`/`notIn(...)`, and `isDistinctFrom(...)`:

```ts
import { and, between, filter, isDistinctFrom, isNotIn } from "@teta/teta";

const adultUsers = pipe(
  users,
  filter((user) => and(
    between(user.age, 18, 64),
    isNotIn(user.email, ["bot@example.com"]),
    isDistinctFrom(user.email, "anonymous@example.com"),
  ))
);
```

More docs:

- [Getting Started](https://github.com/futu2/teta/blob/master/doc/GETTING_STARTED.md) — first query in 5 minutes
- [Tutorial](https://github.com/futu2/teta/blob/master/doc/TUTORIAL.md) — progressive examples with generated SQL
- [Design Philosophy](https://github.com/futu2/teta/blob/master/doc/DESIGN.md) — why function-first, dialect-neutral, immutable
- [API Reference](https://github.com/futu2/teta/blob/master/doc/API.md) — complete typed API with signatures
- [Cheatsheet](https://github.com/futu2/teta/blob/master/doc/cheatsheet.md)
- [Type guide](https://github.com/futu2/teta/blob/master/doc/TYPES.md)
- [Type system](https://github.com/futu2/teta/blob/master/doc/TYPE_SYSTEM.md)

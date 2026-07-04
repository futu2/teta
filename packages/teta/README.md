# @teta/teta

Type-safe SQL EDSL frontend for TypeScript.

`@teta/teta` builds typed query IR and keeps direct convenience helpers such as `toSql(...)`. The reusable SQL backend lives in `@teta/sql`.

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
import { and, asc, eq, filter, gte, pick, sort, table, t, take, toSql, pipe } from "@teta/teta";

const users = table("users", {
  id: t.int(),
  email: t.string(),
  active: t.boolean(),
  age: t.int(),
});

const activeUsers = pipe(
  users,
  filter((user) => and(eq(user.active, true), gte(user.age, 18))),
  pick("id", "email"),
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
import { toSql } from "@teta/teta/sql";
```

Reusable functional pipelines can be saved with `flow(...)`, and `extend(...)` keeps existing columns while adding computed ones:

```ts
import { extend, filterEq, flow, lower, pick, take, whenStep } from "@teta/teta";

const activePublicUsers = flow(
  filterEq((user) => user.active, true),
  extend("normalized_email", (user) => lower(user.email)),
  pick("id", "normalized_email"),
  whenStep(includeLimit, take(50))
);
```

Query values expose `columns` for typed expression reuse, but internal compiler details such as sources, stages, CTEs, and generated names are intentionally opaque. Use `toIR(query)` or `explain(query, ...)` when you need to inspect lowered query structure. Query steps are callable values with lightweight `kind` and `stepName` metadata for tooling/debugging.

Query construction is immutable and normalization is handled as a pure compiler
pass. Runtime deep-freezing is enabled by default outside
`NODE_ENV=production`; set `TETA_FREEZE_QUERY_VALUES` or
`TETA_FREEZE_EXPR_VALUES` to `1`/`0` to override that behavior explicitly.

Row shapes are constrained to SQL value types, and table schemas must be non-empty objects built from `t.*` column helpers. Aggregate projections are checked separately from row projections. In `fold(...)`, use `group(...)` / `groupShape(...)` for grouping keys and aggregate helpers such as `count(...)`, `sum(...)`, or `arrayAgg(...)` for aggregate outputs.

Comparison filter helpers require at least one row callback; direct values are allowed only as the other operand.
`whenStep(...)` and `unlessStep(...)` use host-language booleans to include or skip schema-preserving steps while building a query; use `filter(...)` and predicate expressions for conditions evaluated by SQL.

Use `map(...)` for explicit object-shaped projections:

```ts
import { map, upper } from "@teta/teta";

const publicUsers = pipe(
  users,
  map((user) => ({
    id: user.id,
    email_upper: upper(user.email),
  }))
);
```

Use `join(...)` for joins; the older join-kind helpers are convenience wrappers over the same primitive:

```ts
import { eq, join } from "@teta/teta";

const orders = table("orders", {
  order_id: t.int(),
  user_id: t.int(),
  total: t.float(),
});

const usersWithOrders = pipe(
  users,
  join(orders, {
    type: "left",
    on: (user, order) => eq(user.id, order.user_id),
    select: (user, order) => ({
      user_id: user.id,
      order_total: order.total,
    }),
  })
);
```

`join(...)` accepts lowercase join types only (`"inner"`, `"left"`, `"right"`, `"full"`). The `JoinKind` and `JoinOptions` types are exported for reusable helper wrappers.

Predicates involving nullable expressions are typed as `Expr<SqlBoolean | null>` and are accepted by `filter(...)`, matching SQL's three-valued boolean behavior.

For explicit frontend/backend use, lower the query to IR and render it through `@teta/sql`:

```ts
import { irToSql } from "@teta/sql";
import { toIR, toSql } from "@teta/teta";

const direct = toSql(activeUsers, { dialect: "postgresql" });
const explicit = irToSql(toIR(activeUsers), { dialect: "postgresql" });
```

Use `param<T>(name)` for reusable placeholders and pass runtime values when rendering:

```ts
import { eq, filter, param, pipe, toSqlResult, type SqlInt } from "@teta/teta";

const byId = pipe(
  users,
  filter((user) => eq(user.id, param<SqlInt>("id")))
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
  filter((user) => eq(user.id, param<SqlInt>("1")))
);

const positional = toSqlResult(byPosition, {
  dialect: "postgresql",
  parameterMode: "positional",
  parameterPrefix: "$",
  params: [42],
});
```

The callback form gives autocomplete and compile-time column checks while keeping query steps reusable:

```ts
import { and, asc, eq, filter, gte, pick, sort, pipe } from "@teta/teta";

const activeUsers = pipe(
  users,
  filter((user) => and(eq(user.active, true), gte(user.age, 18))),
  pick("id", "email"),
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

- [Tutorial](https://github.com/futu2/teta/blob/master/doc/TUTORIAL.md)
- [Cheatsheet](https://github.com/futu2/teta/blob/master/doc/cheatsheet.md)
- [Type guide](https://github.com/futu2/teta/blob/master/doc/TYPES.md)
- [Type system](https://github.com/futu2/teta/blob/master/doc/TYPE_SYSTEM.md)

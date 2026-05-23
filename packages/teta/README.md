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

Reusable functional pipelines can be saved with `flow(...)`, and `extend(...)` keeps existing columns while adding computed ones:

```ts
import { extend, filterEq, flow, lower, pick, take, whenStep } from "@teta/teta";

const activePublicUsers = flow(
  filterEq((user) => user.active, true),
  extend((user) => ({
    normalized_email: lower(user.email),
  })),
  pick("id", "normalized_email"),
  whenStep(includeLimit, take(50))
);
```

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

Predicates involving nullable expressions are typed as `Expr<boolean | null>` and are accepted by `filter(...)`, matching SQL's three-valued boolean behavior.

For explicit frontend/backend use, lower the query to IR and render it through `@teta/sql`:

```ts
import { irToSql } from "@teta/sql";
import { toIR, toSql } from "@teta/teta";

const direct = toSql(activeUsers, { dialect: "postgresql" });
const explicit = irToSql(toIR(activeUsers), { dialect: "postgresql" });
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

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
import { and, asc, eq, filter, gte, map, pick, sort, table, t, take, toSql, pipe } from "@teta/teta";

const users = table("users", {
  id: t.int(),
  email: t.string(),
  active: t.boolean(),
  age: t.int(),
});

const activeUsers = pipe(
  users,
  filter((user) => and(eq(user.active, true), gte(user.age, 18))),
  map(pick("id", "email")),
  sort((user) => asc(user.email)),
  take(10)
);

console.log(toSql(activeUsers, { dialect: "postgresql", format: "pretty" }));
```

For explicit frontend/backend use, lower the query to IR and render it through `@teta/sql`:

```ts
import { irToSql } from "@teta/sql";
import { toIR, toSql } from "@teta/teta";

const direct = toSql(activeUsers, { dialect: "postgresql" });
const explicit = irToSql(toIR(activeUsers), { dialect: "postgresql" });
```

The callback form gives the strongest autocomplete and compile-time column checks. For compact query code, Teta also exports typed deferred column refs:

```ts
import { and, asc, col, eq, filter, gte, map, pick, sort, pipe } from "@teta/teta";

const activeUsers = pipe(
  users,
  filter(and(eq(col("active"), true), gte(col("age"), 18))),
  map(pick("id", "email")),
  sort(asc(col("email")))
);
```

Use `col("name")`, `leftCol("name")`, and `rightCol("name")` for no-callback column refs that can be checked by TypeScript in query context. `$`, `$left`, and `$right` remain available as runtime-checked shorthand.

More docs:

- [Tutorial](https://github.com/futu2/teta/blob/master/doc/TUTORIAL.md)
- [Cheatsheet](https://github.com/futu2/teta/blob/master/doc/cheatsheet.md)
- [Type guide](https://github.com/futu2/teta/blob/master/doc/TYPES.md)

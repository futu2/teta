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
import { pipe } from "remeda";
import { and, asc, eq, filter, gte, map, pickCols, sort, table, t, take, toSql } from "@teta/teta";

const users = table("users", {
  id: t.int(),
  email: t.string(),
  active: t.boolean(),
  age: t.int(),
});

const activeUsers = pipe(
  users,
  filter((user) => and(eq(user.active, true), gte(user.age, 18))),
  map(pickCols("id", "email")),
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

The callback form gives the strongest autocomplete and compile-time column checks. For compact query code, Teta also exports deferred row proxies:

```ts
import { pipe } from "remeda";
import { $, and, asc, eq, filter, gte, map, pickCols, sort } from "@teta/teta";

const activeUsers = pipe(
  users,
  filter(and(eq($.active, true), gte($.age, 18))),
  map(pickCols("id", "email")),
  sort(asc($.email))
);
```

Use callback selectors when you want `row.` autocomplete and immediate TypeScript errors for unknown columns. Use `$` when you prefer the shortest expression form and are comfortable with unknown columns being reported when the query helper resolves the expression.

More docs:

- [Tutorial](https://github.com/futu2/teta/blob/master/doc/TUTORIAL.md)
- [Cheatsheet](https://github.com/futu2/teta/blob/master/doc/cheatsheet.md)
- [Type guide](https://github.com/futu2/teta/blob/master/doc/TYPES.md)

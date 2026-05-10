# @teta/teta

Type-safe SQL EDSL and SQL compiler for TypeScript.

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
import { and, asc, eq, filter, gte, map, sort, table, t, take, toSql } from "@teta/teta";

const users = table("users", {
  id: t.int(),
  email: t.string(),
  active: t.boolean(),
  age: t.int(),
});

const query = pipe(
  users,
  filter((user) => and(eq(user.active, true), gte(user.age, 18))),
  map((user) => ({
    id: user.id,
    email: user.email,
  })),
  sort((user) => asc(user.email)),
  take(10)
);

console.log(toSql(query, { dialect: "postgresql", format: "pretty" }));
```

The callback form gives the strongest autocomplete and compile-time column checks. For compact query code, Teta also exports deferred row proxies:

```ts
import { $, and, asc, eq, filter, gte, map, pickCols, sort } from "@teta/teta";

const compact = pipe(
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

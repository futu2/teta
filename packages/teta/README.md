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

More docs:

- [Tutorial](../../doc/TUTORIAL.md)
- [Cheatsheet](../../doc/cheatsheet.md)
- [Type guide](../../doc/TYPES.md)

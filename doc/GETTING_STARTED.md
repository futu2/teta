# Getting Started

This guide gets you from zero to your first Teta query in under 5 minutes.

## Installation

```bash
# bun
bun add @teta/teta

# deno
deno add jsr:@teta/teta

# npm / pnpm / yarn
npx jsr add @teta/teta
```

## Your first query

The core idea: **build queries with functions, render them to SQL at the end.**

```ts
import { and, eq, filter, gte, map, pipe, sort, asc, t, table, take, toSql } from "@teta/teta";

// 1. Define a table schema
const users = table("users", {
  id: t.int(),
  name: t.string(),
  age: t.int(),
  active: t.boolean(),
});

// 2. Build a query pipeline
const adults = pipe(
  users,
  filter((u) => and(eq(u.active, true), gte(u.age, 18))),
  map((u) => ({ id: u.id, name: u.name })),
  sort((u) => asc(u.name)),
  take(10),
);

// 3. Render to SQL
console.log(toSql(adults, { dialect: "postgresql" }));
```

That's it. No `.select().where().orderBy()` chains — just functions composed with `pipe()`.

## The mental model

Teta separates **building** from **rendering**:

```
table("users", schema)  →  pipe(filter, map, sort, take)  →  toSql(options)  →  SQL string
    (dialect-neutral)          (dialect-neutral)               (dialect-aware)
```

Every query step (`filter`, `map`, `sort`, `take`) is a **curried function** that returns a `QueryStep`. You compose them with `pipe()`. The result is a `Query` — an opaque value that doesn't contain SQL yet. Call `toSql()` to render it.

## Navigating the docs

Now that you have the basics, here's where to go next:

| You want to... | Read |
|---|---|
| See more query patterns with generated SQL | [Tutorial](./TUTORIAL.md) |
| Understand the design choices | [Design Philosophy](./DESIGN.md) |
| Look up a function's signature | [API Reference](./API.md) |
| Quick lookup of all exports | [Cheatsheet](./cheatsheet.md) |
| Understand `Expr<T>`, `Query<T>`, and brands | [Types Guide](./TYPES.md) |
| See what SQL functions each dialect supports | [Language Spec](./LANGUAGE_SPEC.md) |
| Understand the internal architecture | [Dev Guide](./DEV_GUIDE.md) |
| Run complete examples | [examples/](../examples/) |

## Try it in your editor

All query callbacks get full autocomplete and type-checking:

```ts
const users = table("users", { id: t.int(), email: t.string() });

pipe(
  users,
  filter((u) => eq(u.email, "test@example.com")),
  //         ^? (property) email: Column<SqlString, "email">
  //            ← TypeScript autocompletes: id, email
)
```

Mistakes are caught at compile time, not at runtime.

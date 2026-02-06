# teta

Type-safe SQL EDSL for TypeScript with composable query pipelines.

## Features

- Typed column refs with autocomplete
- Composable pipeline steps (each step compiles to a CTE)
- Fluent expression helpers (filters, aggregates, windows, functions)
- Dialect-aware SQL rendering (pretty or compact)

## Playground

- https://futu2.github.io/teta-tutorial/

## Install

```bash
bun install
```

## Quick start

Note: `table(...)` requires a schema to avoid `SELECT *` and keep column names explicit.
Generated SQL always uses auto-generated aliases (e.g., `users_0`, `orders_1`) and fully
qualified column references.

```ts
import { table, t } from "./src/edsl";

const users = table("users", {
  id: t.int(),
  name: t.string(),
  age: t.int(),
  active: t.boolean(),
});

const q = users
  .filter((u) => u.active.eq(true).and(u.age.gte(18)))
  .select((u) => ({
    id: u.id,
    name: u.name.replace(" ", "_").coalesce("unknown"),
    age: u.age,
  }))
  .orderBy((u) => [u.name.asc(), u.id.desc()])
  .limit(20);

console.log(q.toSql("Postgresql", "pretty"));
```

## Tutorial

See `TUTORIAL.md` for a full walkthrough, generated SQL, and more examples.

## License

See `LICENSE`.

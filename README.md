# teta

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![JSR](https://img.shields.io/badge/JSR-@teta%2Fteta-F7DF1E?logo=javascript&logoColor=000)](https://jsr.io/@teta/teta)
[![CI](https://img.shields.io/github/actions/workflow/status/futu2/teta/ci.yaml?label=CI)](https://github.com/futu2/teta/actions/workflows/ci.yaml)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-22c55e)](https://github.com/futu2/teta/pulls)
[![Runtimes](https://img.shields.io/badge/Runtimes-Node%20%7C%20Deno%20%7C%20Bun-111827)](https://jsr.io/@teta/teta)
[![Playground](https://img.shields.io/badge/Playground-live-22c55e)](https://futu2.github.io/teta-tutorial/)
[![License](https://img.shields.io/badge/License-BSD--2--Clause--Patent-2563EB)](./LICENSE)

Type-safe SQL EDSL and SQL compiler for TypeScript.

Build typed queries, inspect how they lower, and render SQL for PostgreSQL, SQLite, DuckDB, and custom dialects.

## Getting started in 30 seconds

1. Install `@teta/teta` from JSR.
2. Add `remeda` if you want the same `pipe(...)` style used in the docs.
3. Copy the quick-start example below.
4. If you want more, open the playground or jump into `doc/TUTORIAL.md`.

- Playground: https://futu2.github.io/teta-tutorial/
- Examples: `examples/README.md`
- API reference: `doc/cheatsheet.md`

## Quick start

```ts
import { pipe } from "remeda";
import { and, asc, eq, filter, gte, take, sort, map, table, t, toSql } from "@teta/teta";

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

const sql = toSql(query, {
  dialect: "postgresql",
  format: "pretty",
});

console.log(sql);
```

Typical output:

```sql
SELECT users_0.id, users_0.email
FROM users AS users_0
WHERE users_0.active = TRUE AND users_0.age >= 18
ORDER BY email ASC
LIMIT 10
```

## Why Teta?

- SQL-first: Teta produces SQL instead of hiding it behind ORM entities.
- Typed query building: schemas, columns, and expressions stay strongly typed.
- Functional composition: query helpers are ordinary functions, so they fit naturally into Remeda `pipe(...)` pipelines and are easy to extract, reuse, and compose.
- Dialect-neutral authoring: choose `postgresql`, `sqlite`, `duckdb`, or a custom dialect at render time.
- Inspectable lowering: debug with `toIR(query)`, `toAst(query)`, `explain(query)`, and `toSqlResult(query, ...)`.
- Predictable rendering: use `optimized` for compact SQL or `readable` for stage-shaped SQL.

Teta is a good fit for reporting endpoints, analytics queries, internal tools,
and libraries that need composable SQL without adopting a full ORM.

The functional style is intentional: each query step is just a plain function from one query state to the next. That makes it easy to compose pipelines, reuse stage fragments, and refactor query logic without committing to fluent classes or hidden builder state.

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

If your package manager supports `jsr:` directly:

```bash
pnpm add jsr:@teta/teta
# or
yarn add jsr:@teta/teta
```

Or use the JSR CLI:

```bash
npx jsr add @teta/teta
```

JSR may create or update `.npmrc` for Node-based setups. Commit that file if your package manager needs it.

### Optional: Remeda

The examples in this README and `doc/TUTORIAL.md` use named Remeda imports such as `pipe`, `pick`, and `omit`.
Add it to your app if you want the same functional composition style.

```bash
pnpm add remeda
# or
bun add remeda
# or
deno add npm:remeda
```

Published package import:

```ts
import { table, t } from "@teta/teta";
```

Deno import:

```ts
import { table, t } from "jsr:@teta/teta";
```

## Core ideas

### Dialect at render time

Using the `query` from the quick start, render for the target backend:

```ts
toSql(query, { dialect: "postgresql" });
toSql(query, { dialect: "sqlite" });
```

### Safe runtime parameters

Using the same `users` table, use `param(...)` and `toSqlResult(...)` when you need SQL plus bound params:

```ts
import { pipe } from "remeda";
import { eq, filter, param, map, toSqlResult } from "@teta/teta";

const result = toSqlResult(
  pipe(
    users,
    filter((user) => eq(user.active, param(true, "active"))),
    filter((user) => eq(user.email, param("ada@example.com", "email"))),
    map((user) => ({
      id: user.id,
      email: user.email,
    }))
  ),
  {
    dialect: "postgresql",
    parameterMode: "named",
  })
);

console.log(result.sql);
console.log(result.params);
```

Typical result:

```ts
result.sql;
// "SELECT users_0.id, users_0.email FROM users AS users_0 WHERE users_0.active = :active AND users_0.email = :email"

result.params;
// [{ value: true, index: 1, name: "active" }, { value: "ada@example.com", index: 2, name: "email" }]
```

### Inspect lowering with `explain()`

Again using the same `query`, inspect the intermediate shape instead of guessing from the final string:

```ts
import { explain } from "@teta/teta";

const info = explain(query, {
  dialect: "postgresql",
  renderStrategy: "readable",
});

console.log(info.stages);
console.log(info.ctes);
console.log(info.sql);
```

Typical `stages` value:

```ts
[
  { index: 0, kind: "filter" },
  { index: 1, kind: "map" },
  { index: 2, kind: "sort" },
  { index: 3, kind: "take" },
]
```

Quick rule of thumb:

- `optimized` may fuse simple pipelines into one `SELECT`
- `readable` preserves stage boundaries as `cte_0`, `cte_1`, ...
- nested derived tables usually mean the compiler introduced a deliberate scope barrier

### Projection shaping with Remeda

Because `map(...)` and `fold(...)` work with plain objects, Remeda helpers compose naturally.

```ts
import { merge, omit, pick, pipe } from "remeda";
import { replace, map, upper } from "@teta/teta";

const compactUsers = map(users, pipe(
  pick(["id", "email"] as const),
  (base) => merge(base, {
    email_normalized: upper(replace(base.email, "@", "_at_")),
  })
));

const internalUsers = map(users, omit(["active"] as const));
```

## Examples

See `examples/README.md` for runnable examples.

- `examples/node/tenant_orders.ts` builds `{ text, values }` for a typical Node DB client.
- `examples/node/api_orders.ts` shows request/session-driven parameter binding.
- `examples/node/custom_dialect.ts` shows custom dialect language mappings and fallbacks.
- `examples/bun/dialect_report.ts` renders the same query for multiple engines.
- `examples/deno/runtime_smoke.ts` shows a minimal Deno-friendly module.

## Learn more

- `doc/TUTORIAL.md` — end-to-end examples
- `doc/cheatsheet.md` — compact API reference
- `doc/LANGUAGE_SPEC.md` — canonical SQL operation coverage and dialect notes
- `doc/DEV_GUIDE.md` — internals, lowering stages, and dev utilities

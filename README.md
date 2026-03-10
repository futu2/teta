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
2. Copy the quick-start example below.
3. If you want more, open the playground or jump into `TUTORIAL.md`.

- Playground: https://futu2.github.io/teta-tutorial/
- Examples: `examples/README.md`
- API reference: `cheatsheet.md`

## Quick start

```ts
import { sqlRenderer, table, t } from "@teta/teta";

const users = table("users", {
  id: t.int(),
  email: t.string(),
  active: t.boolean(),
});

const query = users
  .filter((user) => user.active.eq(true))
  .select((user) => ({
    id: user.id,
    email: user.email,
  }))
  .orderBy((user) => user.email.asc())
  .limit(10);

const sql = query.toSql(sqlRenderer({
  dialect: "postgresql",
  format: "pretty",
}));

console.log(sql);
```

Typical output:

```sql
SELECT users_0.id, users_0.email
FROM users AS users_0
WHERE users_0.active = TRUE
ORDER BY email ASC
LIMIT 10
```

## Why Teta?

- SQL-first: Teta produces SQL instead of hiding it behind ORM entities.
- Typed query building: schemas, columns, and expressions stay strongly typed.
- Dialect-neutral authoring: choose `postgresql`, `sqlite`, `duckdb`, or a custom dialect at render time.
- Inspectable lowering: debug with `toIR()`, `toAst()`, `explain()`, and `toSqlResult(...)`.
- Predictable rendering: use `optimized` for compact SQL or `readable` for stage-shaped SQL.

Teta is a good fit for reporting endpoints, analytics queries, internal tools,
and libraries that need composable SQL without adopting a full ORM.

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

Published package import:

```ts
import { sqlRenderer, table, t } from "@teta/teta";
```

Deno import:

```ts
import { sqlRenderer, table, t } from "jsr:@teta/teta";
```

## Core ideas

### Dialect at render time

Using the `query` from the quick start, render for the target backend:

```ts
query.toSql(sqlRenderer({ dialect: "postgresql" }));
query.toSql(sqlRenderer({ dialect: "sqlite" }));
```

### Safe runtime parameters

Using the same `users` table, use `param(...)` and `toSqlResult(...)` when you need SQL plus bound params:

```ts
import { param, sqlRenderer } from "@teta/teta";

const result = users
  .filter((user) =>
    user.active.eq(param(true, "active")).and(
      user.email.eq(param("ada@example.com", "email"))
    )
  )
  .select((user) => ({
    id: user.id,
    email: user.email,
  }))
  .toSqlResult(sqlRenderer({
    dialect: "postgresql",
    parameterMode: "named",
  }));

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
const info = query.explain({
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
  { index: 1, kind: "select" },
  { index: 2, kind: "orderBy" },
  { index: 3, kind: "limit" },
]
```

Quick rule of thumb:

- `optimized` may fuse simple pipelines into one `SELECT`
- `readable` preserves stage boundaries as `cte_0`, `cte_1`, ...
- nested derived tables usually mean the compiler introduced a deliberate scope barrier

### Stable error types

Use `TetaUserError` for invalid query usage or config, and `TetaInternalError` for compiler/runtime failures that likely indicate a bug.

## Examples

See `examples/README.md` for runnable examples.

- `examples/node/tenant_orders.ts` builds `{ text, values }` for a typical Node DB client.
- `examples/node/api_orders.ts` shows request/session-driven parameter binding.
- `examples/node/custom_dialect.ts` shows custom dialect language mappings and fallbacks.
- `examples/bun/dialect_report.ts` renders the same query for multiple engines.
- `examples/deno/runtime_smoke.ts` shows a minimal Deno-friendly module.

## Learn more

- `TUTORIAL.md` — end-to-end examples
- `cheatsheet.md` — compact API reference
- `LANGUAGE_SPEC.md` — function support and dialect notes
- `DEV_GUIDE.md` — internal architecture and lowering flow
- `ROADMAP.md` — shipped milestone snapshot
- Playground — https://futu2.github.io/teta-tutorial/

Local dev helpers such as source watching and clipboard output live under `@teta/teta/dev`.
See `cheatsheet.md` for the dev utility API.

## Contributing

Contributions are very welcome.
Docs fixes, examples, bug reports, regression tests, dialect work, and compiler improvements are all useful.

Good places to start:

- `README.md`, `TUTORIAL.md`, and `cheatsheet.md` for docs and examples
- `tests/` for behavior-first bug fixes and regression coverage
- `examples/` for runtime-specific usage patterns
- `DEV_GUIDE.md` for the lowering pipeline and internal architecture

Before opening a PR, run:

```bash
bun run check
```

For larger changes, opening an issue or draft PR first is a great way to align on direction.

## Developing Teta

Install dependencies:

```bash
bun install
```

Run tests and typecheck:

```bash
bun run check
```

Run render benchmarks:

```bash
bun run bench:render
bun run bench:render:check
```

Optional Nix shell:

```bash
nix develop
```

## License

See `LICENSE`.

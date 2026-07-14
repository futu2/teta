<div align="center">

# <img src="" width="0" alt=""> Teta

### The functional SQL EDSL for TypeScript

*Type-safe query composition. Multi-dialect rendering. No ORM.*

</div>

---

```ts
import { and, asc, eq, filter, gte, map, pipe, sort, t, table, take, toSql } from "@teta/teta";

const users = table("users", {
  id: t.int(),
  name: t.string(),
  age: t.int(),
  active: t.boolean(),
});

const adults = pipe(
  users,
  filter((u) => and(eq(u.active, true), gte(u.age, 18))),
  map((u) => ({ id: u.id, name: u.name })),
  sort((u) => asc(u.name)),
  take(10),
);

// One query, any dialect:
toSql(adults, { dialect: "postgresql" }); // → PostgreSQL SQL
toSql(adults, { dialect: "sqlite" });     // → SQLite SQL
toSql(adults, { dialect: "mysql" });      // → MySQL SQL
```

<br>

## What makes Teta different

Teta is **not** a builder-pattern query library. It's a functional EDSL where every operation is a plain function composed with `pipe()`. The result: queries that are reusable, testable, and type-checked end-to-end — from schema definition to SQL rendering.

### Three things that set it apart

<table>
<tr>
<td width="33%">

**1. True autocomplete through every step**

```ts
const users = table("users", {
  id: t.int(),
  name: t.string(),
  age: t.int(),
  active: t.boolean(),
});

pipe(
  users,
  filter((u) => u.|
//               ^? id, name, age, active
//                  ← IDE autocompletes column names
  map((u) => ({ id: u.id, name: u.|
//                                ^? id, name, age, active
  })),
);
```

Callback parameters carry the exact row shape from the current pipeline stage. No string-based column references. No proxy magic that breaks in nested scopes.

</td>
<td width="33%">

**2. Type errors caught at compile time**

```ts
const users = table("users", {
  id: t.int(),
  name: t.string(),
  active: t.boolean(),
});

pipe(
  users,
  // ❌ TypeScript error:
  // SqlBoolean is not comparable with string
  filter((u) => eq(u.active, "yes")),

  // ❌ TypeScript error:
  // Expr<SqlInt> is not comparable with Expr<SqlString>
  filter((u) => eq(u.id, u.name)),
);
```

Teta tracks SQL types through branded types (`SqlInt`, `SqlString`, `SqlBoolean`, `SqlTimestamp`, etc.). The compiler catches mismatches before your query ever reaches the database.

</td>
<td width="33%">

**3. Build once, target anywhere**

```ts
const q = pipe(
  users,
  map((u) => ({ name_len: charLength(u.name) })),
);

toSql(q, { dialect: "postgresql" });
// → CHAR_LENGTH("name")

toSql(q, { dialect: "sqlite" });
// → LENGTH("name")    ← auto-mapped

toSql(q, { dialect: "duckdb" });
// → CHAR_LENGTH("name")
```

Dialect resolution happens at render time. Function names, fallback expressions, and feature flags are handled by the backend — your query code never mentions a dialect.

</td>
</tr>
</table>

### Why function-first matters

Most SQL builders chain methods on a mutable builder object. Teta uses curried functions composed with `pipe()`:

```ts
// Traditional builder:
db.select("id", "name")
  .from("users")
  .where("active", true)
  .orderBy("name")
  .limit(10);

// Teta: filter is a standalone, reusable query
const activeUsers = pipe(
  users,
  filter((u) => eq(u.active, true)),
);

// Compose anywhere, test in isolation, branch without cloning
const byName = pipe(activeUsers, map((u) => ({ name: u.name })), sort((u) => asc(u.name)));

// Or keep all columns and sort by age
const byAge = pipe(activeUsers, sort((u) => asc(u.age)));
```

`filter`, `map`, `sort`, `pick` — each is a curried `QueryStep` you can assign to a variable, pass to a higher-order function, or compose further. No builder to clone, no mutation to worry about.

<br>

## Comparison

|  | Teta | Knex | Kysely | Drizzle | Raw SQL |
|---|---|---|---|---|---|
| **Style** | Functional (`pipe`) | Builder chain | Builder chain | Builder chain | Strings |
| **Column access** | Typed callbacks | Strings | Strings | Proxy objects | N/A |
| **Autocomplete** | ✅ Full | ❌ | ❌ | ✅ Limited | ❌ |
| **Type-safe expressions** | ✅ `SqlInt` ≠ `SqlString` | ❌ | ❌ | ⚠️ Partial | ❌ |
| **Multi-dialect** | ✅ Build once, render anywhere | ⚠️ Manual | ⚠️ Manual | ⚠️ Manual | ❌ Per-dialect |
| **Immutable** | ✅ Every step returns new `Query` | ⚠️ Clone-based | ⚠️ Clone-based | ⚠️ Clone-based | N/A |
| **Reusable fragments** | ✅ `pipe()` composition | ❌ | ❌ | ❌ | ❌ |
| **Opaque internals** | ✅ Stable public API | ❌ Mutable state | ❌ Mutable state | ❌ Mutable state | N/A |
| **ORM** | ❌ SQL output only | ❌ | ❌ | ✅ | ❌ |
| **Injection-safe** | ✅ By construction | ⚠️ Manual | ⚠️ Manual | ✅ | ❌ |

**Teta is not an ORM.** It doesn't manage connections, execute queries, or map results. It's a type-safe query builder that gives you a SQL string at the end — you use your existing database driver to run it.

<br>

## Quick start

```bash
bun add @teta/teta        # Bun
deno add jsr:@teta/teta   # Deno
npx jsr add @teta/teta    # npm / pnpm / yarn
```

Then write your first query — [Getting Started →](./doc/GETTING_STARTED.md)

```ts
import { and, eq, filter, map, not, pipe, t, table, take, toSql } from "@teta/teta";

const todos = table("todos", {
  id: t.int(),
  title: t.string(),
  done: t.boolean(),
});

const pending = pipe(
  todos,
  filter((t) => not(eq(t.done, true))),
  map((t) => ({ id: t.id, title: t.title })),
  take(5),
);

console.log(toSql(pending, { dialect: "postgresql" }));
```

<br>

## Packages

| Package | Description |
|---|---|
| [`@teta/teta`](./packages/teta/) | The EDSL frontend — `table()`, `pipe()`, `filter()`, `map()`, `join()`, `fold()`, `toSql()` |
| [`@teta/sql`](./packages/sql/) | Backend — IR lowering, dialect resolution, SQL rendering |
| [`@teta/dev`](./packages/dev/) | Dev tooling — file watching, clipboard workflows, source rendering |

<br>

## Documentation

| Document | What it covers |
|---|---|
| **[Getting Started](./doc/GETTING_STARTED.md)** | Install, first query, mental model — 5 minutes |
| **[Tutorial](./doc/TUTORIAL.md)** | Progressive examples: basics → joins → aggregation → window functions → recursive CTEs |
| **[Design Philosophy](./doc/DESIGN.md)** | Why function-first, dialect-neutral, immutable, and layered |
| **[API Reference](./doc/API.md)** | Every public function with TypeScript signatures and examples |
| **[Cheatsheet](./doc/cheatsheet.md)** | Quick lookup of all exports |
| **[Types Guide](./doc/TYPES.md)** | `Expr<T>`, `Query<T>`, branded SQL types, type phases |
| **[Type System](./doc/TYPE_SYSTEM.md)** | Formal type judgments and preservation rules |
| **[Language Spec](./doc/LANGUAGE_SPEC.md)** | SQL function coverage and per-dialect support matrix |
| **[Portable IR v1](./doc/PORTABLE_IR.md)** | Versioned cross-language query contract, validation, and rendering |
| **[Dev Guide](./doc/DEV_GUIDE.md)** | Internal architecture, rendering pipeline, extension points |
| **[Examples](./examples/)** | Runnable application-style examples |

**New to Teta?** Start with [Getting Started](./doc/GETTING_STARTED.md), then work through the [Tutorial](./doc/TUTORIAL.md).

<br>

## Supported dialects

Built-in: `postgresql`, `sqlite`, `mysql`, `mariadb`, `duckdb`, `trino`, `hive`, `flinksql`, `bigquery`, `athena`, `db2`, `noql`, `redshift`, `snowflake`, `transactsql`.

Use `getDialectCapabilityMatrix()` from `@teta/sql` to inspect whether each
catalog operation is native, rewritten, emulated, or unsupported for a target.

Custom: pass a `DialectSpec` with your own function mappings, expression fallbacks, and feature flags.

```ts
toSql(q, {
  dialect: {
    name: "my_sqlite",
    parserDialect: "SQLite",
    language: {
      functions: { CHARACTER_LENGTH: "LENGTH" },
      fallbacks: { BIT_LENGTH: "bit_length_via_length_x8" },
    },
  },
});
```

See [Language Spec](./doc/LANGUAGE_SPEC.md) for the full support matrix.

<br>

## Development

```bash
bun install
bun run check              # type-check + test all packages
bun run test               # run all tests
bun run test:runtime:bun   # runtime smoke tests (bun)
bun run test:runtime:node  # runtime smoke tests (node)
bun run test:runtime:deno  # runtime smoke tests (deno)
```

<br>

## License

BSD-2-Clause-Patent — see [LICENSE](./LICENSE).

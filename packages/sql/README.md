# @teta/sql

Reusable SQL IR, dialects, and rendering backend for Teta frontends.

## Install

### Deno

```bash
deno add jsr:@teta/sql
```

### Bun

```bash
bunx jsr add @teta/sql
```

### Node.js

```bash
npx jsr add @teta/sql
```

## Render Query IR

`@teta/sql` renders portable IR. Any frontend can target the same IR contract.
Query IR arrays such as `stages`, projection items, and CTE lists are treated as
readonly inputs by the renderer; optimizer/build phases allocate fresh arrays
when they need to rewrite a plan.

The portable contract is **Teta Query IR v1**. Every renderable query target
must include `version: 1`; all `irTo*` entrypoints strictly decode it before
rendering and throw `TetaUserError` with `INVALID_QUERY_IR` for invalid input.
The JSON Schema for non-TypeScript frontends is exported as
`@teta/sql/ir-v1.schema.json`. The decoder additionally checks semantic
invariants such as projection metadata and safe SQL tokens. Physical
`columnIdentifiers` are renderer-plan metadata, not portable IR: the backend
derives them from logical column names and projection aliases during
`lowerPortableQueryIR(...)`.

Portable `builtin` expressions are canonical uppercase operations. Their
accepted argument counts are published as `BUILTIN_FUNCTION_ARITIES` and are
validated by both EDSL constructors and the IR decoder.

Portable table join sources declare their logical `columnNames`. The renderer
uses those names to derive its private physical identifier map.

The decoder also tracks each stage's row scope and shaped output columns. It
rejects references to unavailable scopes, stale pre-projection scopes, and
declared join columns that do not exist.

See the [Portable IR v1 guide](../../doc/PORTABLE_IR.md) for the complete
cross-language contract, JSON Schema, validation rules, and lowering boundary.

```ts
import { irToSql, type PortableQueryIR } from "@teta/sql";

const query = {
  version: 1,
  source: {
    db: null,
    schema: null,
    table: { name: "users", quoted: false },
    as: null,
  },
  stages: [],
  scopeId: "__teta_scope_users",
  columnNames: ["id"],
  withs: [],
} as PortableQueryIR;

const sql = irToSql(query, {
  dialect: "postgresql",
  format: "compact",
});
```

## Backend APIs

- `irToAst(...)`
- `irToSql(...)`
- `irToSqlResult(...)`
- `exprToSql(...)`
- `exprToSqlResult(...)`
- `explainIR(...)`
- `validateQueryIR(...)`
- `lowerPortableQueryIR(...)`
- `ir` helper namespace

`@teta/sql` has no dependency on any frontend package.

Dialect operation capabilities and dialect verification confidence are separate
contracts. `getDialectCapabilities(...)` describes lowering (`native`,
`rewritten`, `emulated`, or `unsupported`), while `getDialectSupportTier(...)`
reports whether the repository only configured the dialect, parser-checked it,
or verified it against a live database. The currently live-verified built-ins
are PostgreSQL, SQLite, and DuckDB.

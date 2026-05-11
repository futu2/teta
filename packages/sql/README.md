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

`@teta/sql` renders backend IR. Any frontend can target the same IR contract.

```ts
import { irToSql, type QueryIRSqlTarget } from "@teta/sql";

const query = {
  source: {
    db: null,
    schema: null,
    table: { name: "users", quoted: false },
    as: null,
  },
  stages: [],
  scopeId: "__teta_scope_users",
  columnNames: ["id"],
  columnIdentifiers: {
    id: { name: "id", quoted: false },
  },
  withs: [],
} as QueryIRSqlTarget;

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
- `ir` helper namespace

`@teta/sql` has no dependency on any frontend package.

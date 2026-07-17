# Portable IR v1

`@teta/sql` accepts a versioned, JSON-ready query representation named **Teta
Query IR v1**. It is the boundary for frontends that are not implemented with
`@teta/teta`, including frontends written in another language.

The TypeScript EDSL produces this representation with `toIR(query)`. Other
frontends can construct it directly, validate it with `@teta/sql`, and render
it for any supported SQL dialect.

## Contract and entrypoints

The machine-readable contract is published at
[`packages/sql/ir.v1.schema.json`](../packages/sql/ir.v1.schema.json). The
runtime decoder is still required: it checks semantic rules that JSON Schema
cannot express, such as scope visibility and projection output shapes.

| API | Purpose |
|---|---|
| `validateQueryIR(value)` | Validate unknown JSON at the public boundary. |
| `lowerPortableQueryIR(value)` | Validate and derive the backend's private render plan. |
| `irToSql(value, options)` | Validate, lower, and render SQL. |
| `irToSqlResult(value, options)` | Render SQL with parameter bindings. |
| `toPortableQueryIR(value)` | Remove private plan metadata from a lowered target. |

Invalid input throws `TetaUserError` with code `INVALID_QUERY_IR`. Applications
accepting IR from untrusted or separately deployed producers should call
`validateQueryIR` before storing or rendering it.

## Minimal query

Every root query has a version, source, current scope, output columns, and a
stage list. `withs` is optional; use an empty array when a producer prefers a
uniform serialized shape.

```ts
import { irToSql, validateQueryIR, type PortableQueryIR } from "@teta/sql";

const users: PortableQueryIR = {
  version: 1,
  source: {
    db: null,
    schema: null,
    table: { name: "users", quoted: false },
    as: null,
  },
  stages: [],
  scopeId: "users",
  columnNames: ["id", "email"],
  withs: [],
};

validateQueryIR(users);
const sql = irToSql(users, { dialect: "postgresql" });
```

`scopeId` is a logical row-source identifier, not a SQL table name. A column
expression references its current row source with that ID:

```json
{
  "kind": "column",
  "table": "users",
  "name": "id"
}
```

Use distinct scope IDs whenever a stage introduces a new row shape. Producers
should treat scope IDs as opaque compiler names rather than user-facing SQL
aliases.

## Query structure

The root fields are deliberately small:

| Field | Meaning |
|---|---|
| `version` | Must be the number `1`. |
| `source` | A structured table source or an inline `values` source. |
| `stages` | Ordered relational operations. |
| `scopeId` | Logical scope of the source row. |
| `columnNames` | Logical output shape of the complete query. |
| `withs` | Optional ordinary or recursive CTE definitions. |

Logical column names must be non-empty and unique. The final `columnNames`
array must exactly match the output shape created by the final stage. Use the
JSON Schema for the full expression, identifier, source, and stage shapes.

Stages use these discriminators:

| Kind | Effect on row shape |
|---|---|
| `filter`, `sort`, `distinct`, `take` | Preserve the current scope and project the current columns. |
| `map`, `fold` | Create an explicit output projection and a fresh `outputScopeId`. |
| `join`, `unnest` | Introduce a temporary right scope, then create a fresh output scope. |
| `union` | Requires matching output column names on both sides and creates a fresh output scope. |

For a table join, `source.columnNames` is required. It declares the logical
columns visible through `rightScopeId`; the renderer derives its own physical
SQL identifier map from those names. For a subquery join, the nested query's
`columnNames` provides that shape instead.

## Validation rules

The decoder rejects malformed and internally inconsistent IR before SQL is
generated. In particular, it enforces all of the following:

- The payload uses only fields defined by IR v1 and declares `version: 1`.
- SQL identifiers, casts, function names, parameter names, and raw SQL tokens
  meet the backend's token rules.
- Builtin operations are canonical uppercase names with their required arity.
- Column expressions reference a scope and column visible at that stage.
- Projection stages retire the previous scope; later stages cannot refer to
  stale pre-projection columns.
- Join, unnest, union, CTE, and recursive-query shapes agree with their
  declared columns and scopes.

Validation is structural and semantic, but it is not a database schema check.
For example, the backend can verify that a join references a declared
`user_id` column, but it cannot verify that the physical database contains an
`orders` table.

## Portable data versus renderer plans

The portable contract intentionally does **not** contain `columnIdentifiers`.
That field is renderer-private metadata used to preserve physical SQL quoting
and aliases. Supplying it at the root, in a table join, or in an `unnest` stage
is an IR validation error.

`lowerPortableQueryIR(...)` derives that metadata after validation. This keeps
serialized IR independent of the TypeScript renderer and gives every frontend
the same portable input contract. Conversely, use `toPortableQueryIR(...)` to
serialize a lowered internal target back to portable v1 data.

## Compatibility

The `version` field is the protocol boundary. A producer and renderer must
agree on the same IR major version. Future incompatible IR changes should use
a new version and schema rather than relying on ignored fields; v1 rejects
unknown properties at every validated object boundary.

For ordinary TypeScript applications, use `@teta/teta` and its `toSql(...)`
helper. Use this contract directly only when building a frontend, a persisted
IR workflow, or language-neutral tooling around `@teta/sql`.

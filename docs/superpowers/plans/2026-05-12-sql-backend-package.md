# SQL Backend Package Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract a reusable `@teta/sql` package that owns IR, dialects, and SQL rendering, while `@teta/teta` remains the TypeScript EDSL frontend with direct `toSql(...)` convenience helpers.

**Architecture:** Add `packages/sql` as the backend package and make `packages/teta` depend on it. Move neutral IR types, backend utilities, dialects, language rewrites, and render code to `@teta/sql`; keep query construction, row proxies, and frontend expression ergonomics in `@teta/teta`. `@teta/teta` lowers queries with `toIR(query)` and delegates rendering to `@teta/sql`.

**Tech Stack:** TypeScript, Bun workspaces, JSR package metadata, `node-sql-parser`, existing Bun test suites.

---

## File Structure

### New Files

- `packages/sql/package.json` - workspace metadata, scripts, runtime dependencies for the backend package.
- `packages/sql/jsr.json` - JSR publish metadata for `@teta/sql`.
- `packages/sql/tsconfig.json` - package-local TypeScript config.
- `packages/sql/mod.ts` - public backend package entrypoint.
- `packages/sql/src/ir/types_internal.ts` - scope ID and internal name brands/constants.
- `packages/sql/src/ir/types_expr.ts` - expression IR node/value/type definitions.
- `packages/sql/src/ir/types_query.ts` - query IR, source, stage, CTE definitions.
- `packages/sql/src/ir/types.ts` - re-export of IR type modules.
- `packages/sql/src/ir/utils.ts` - backend-safe identifier/source/projection/stage utility helpers.
- `packages/sql/src/ir/builders.ts` - small public `ir` helper namespace implementation.
- `packages/sql/src/ir/validate.ts` - `validateQueryIR(...)` shape checks.
- `packages/sql/src/errors.ts` - shared `TetaError`, `TetaUserError`, `TetaInternalError`, and helper functions.
- `packages/sql/src/dialect/**` - moved SQL dialect implementation.
- `packages/sql/src/language/**` - moved SQL language rewrite/fallback implementation.
- `packages/sql/src/render/**` - moved SQL AST lowering and string rendering implementation.
- `packages/sql/src/renderer.ts` - backend render entrypoints.
- `packages/sql/src/renderer_output.ts` - AST/expression SQL stringification support.
- `packages/sql/src/renderer_target.ts` - IR/expression-target rendering.
- `packages/sql/src/renderer_types.ts` - backend render target/state types.
- `packages/sql/src/types.ts` - SQL option/result/dialect public types.
- `packages/sql/tests/public_api.test.ts` - backend package export and dependency-boundary tests.
- `packages/sql/tests/renderer.test.ts` - direct IR/expression backend render tests.
- `packages/sql/tests/pipeline.test.ts` - backend pipeline AST tests moved from `packages/teta`.

### Modified Files

- `package.json` - add `test:sql`, `check:sql`, `typecheck:sql`, include SQL package in root checks.
- `tsconfig.json` - add `@teta/sql` and `jsr:@teta/sql` path mappings.
- `tests/package_metadata.test.ts` - include `packages/sql/package.json` and `packages/sql/jsr.json`.
- `.github/workflows/ci.yaml` - add `@teta/sql` checks and JSR dry-run.
- `.github/workflows/publish.yaml` - detect and publish `@teta/sql`.
- `packages/teta/package.json` - add dependency on `@teta/sql`, remove backend runtime dependencies that move to `@teta/sql`.
- `packages/teta/jsr.json` - add import mapping for `@teta/sql`.
- `packages/teta/mod.ts` - re-export frontend API plus selected backend public types/errors from `@teta/sql`.
- `packages/teta/src/edsl/query/builder.ts` - keep frontend query construction and convert render entrypoints to facades.
- `packages/teta/src/edsl/query/utils.ts` - keep frontend-only helpers; import backend-safe utilities from `@teta/sql`.
- `packages/teta/src/edsl/query/schema.ts` - import SQL type brands from `@teta/sql`.
- `packages/teta/src/edsl/core/expr/**` - import IR types/constants/errors from `@teta/sql`.
- `packages/teta/src/edsl/expr.ts` - keep frontend expression helper exports; import backend IR types from `@teta/sql`.
- `packages/teta/src/edsl/types.ts` - re-export IR and SQL public types from `@teta/sql`.
- `packages/teta/tests/**` - move backend-only tests to `packages/sql/tests`, update frontend tests to use `toIR(...)` plus `@teta/sql` where testing backend equality.
- `packages/dev/package.json` - keep dependency on `@teta/teta`; do not add `@teta/sql`.
- `packages/dev/deno.json` - keep the `@teta/teta` import; do not add `@teta/sql`.
- `packages/dev/src/render_source_shared.ts` - keep using `toSql(...)` from `@teta/teta`, update `QueryLike` to query-only frontend shape.
- `doc/DEV_GUIDE.md`, `doc/TUTORIAL.md`, `doc/TYPES.md`, `doc/cheatsheet.md`, `packages/teta/README.md`, `packages/dev/README.md` - document the frontend/backend split and new package.

---

### Task 1: Scaffold `@teta/sql` Package And Metadata Checks

**Files:**
- Create: `packages/sql/package.json`
- Create: `packages/sql/jsr.json`
- Create: `packages/sql/tsconfig.json`
- Create: `packages/sql/mod.ts`
- Create: `packages/sql/tests/public_api.test.ts`
- Modify: `package.json`
- Modify: `tsconfig.json`
- Modify: `tests/package_metadata.test.ts`

- [ ] **Step 1: Write the failing metadata and package export tests**

Create `packages/sql/tests/public_api.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import * as sql from "../mod.ts";

const MOD_PATH = fileURLToPath(new URL("../mod.ts", import.meta.url));

describe("sql backend public api", () => {
  test("exports backend rendering entrypoints", () => {
    expect(typeof sql.irToSql).toBe("function");
    expect(typeof sql.irToSqlResult).toBe("function");
    expect(typeof sql.irToAst).toBe("function");
    expect(typeof sql.exprToSql).toBe("function");
    expect(typeof sql.exprToSqlResult).toBe("function");
    expect(typeof sql.explainIR).toBe("function");
  });

  test("exports the ir helper namespace", () => {
    expect(typeof sql.ir).toBe("object");
    expect(typeof sql.ir.validateQueryIR).toBe("function");
  });

  test("public backend entrypoint does not import the frontend package", () => {
    const source = readFileSync(MOD_PATH, "utf8");
    expect(source.includes("@teta/teta")).toBe(false);
    expect(source.includes("../teta")).toBe(false);
  });
});
```

Update `tests/package_metadata.test.ts` by adding the SQL package block before the existing `tetaPackage` block:

```ts
  const sqlPackage = readJson<{
    name: string;
    version: string;
    exports: Record<string, string>;
  }>("packages/sql/package.json");
  const sqlJsr = readJson<{
    name: string;
    version: string;
    exports: Record<string, string>;
  }>("packages/sql/jsr.json");

  expect(sqlPackage.name).toEqual(sqlJsr.name);
  expect(sqlPackage.version).toEqual(sqlJsr.version);
  expect(sqlPackage.exports).toEqual(sqlJsr.exports);
```

- [ ] **Step 2: Run tests to verify the scaffold is missing**

Run:

```bash
bun test tests/package_metadata.test.ts packages/sql/tests/public_api.test.ts
```

Expected: FAIL because `packages/sql/package.json`, `packages/sql/jsr.json`, `packages/sql/mod.ts`, and the backend exports do not exist.

- [ ] **Step 3: Add package metadata and temporary throwing exports**

Create `packages/sql/package.json`:

```json
{
  "name": "@teta/sql",
  "module": "./mod.ts",
  "version": "0.1.0",
  "exports": {
    ".": "./mod.ts"
  },
  "types": "./mod.ts",
  "type": "module",
  "scripts": {
    "test": "bun test tests --pass-with-no-tests",
    "test:all": "bun test",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "check": "bun run test && bun run typecheck"
  },
  "dependencies": {
    "node-sql-parser": "^5.4.0"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "^5.9.3"
  }
}
```

Create `packages/sql/jsr.json`:

```json
{
  "name": "@teta/sql",
  "version": "0.1.0",
  "description": "Reusable SQL IR and rendering backend for Teta frontends.",
  "license": "BSD-2-Clause-Patent",
  "exports": {
    ".": "./mod.ts"
  },
  "compatibility": {
    "deno": true,
    "node": true,
    "bun": true
  }
}
```

Create `packages/sql/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["mod.ts", "src/**/*.ts", "tests/**/*.ts"],
  "exclude": ["node_modules"]
}
```

Create `packages/sql/mod.ts`:

```ts
function backendNotMigrated(name: string): never {
  throw new Error(`${name} is not migrated yet`);
}

export const ir = {
  validateQueryIR: (value: unknown): void => {
    if (typeof value !== "object" || value === null) {
      backendNotMigrated("validateQueryIR");
    }
  },
};

export function irToAst(): never {
  backendNotMigrated("irToAst");
}

export function irToSql(): never {
  backendNotMigrated("irToSql");
}

export function irToSqlResult(): never {
  backendNotMigrated("irToSqlResult");
}

export function exprToSql(): never {
  backendNotMigrated("exprToSql");
}

export function exprToSqlResult(): never {
  backendNotMigrated("exprToSqlResult");
}

export function explainIR(): never {
  backendNotMigrated("explainIR");
}
```

- [ ] **Step 4: Add root scripts and path aliases**

Modify root `package.json` scripts:

```json
{
  "scripts": {
    "test": "bun run test:metadata && bun run test:sql && bun run test:teta && bun run test:dev",
    "test:metadata": "bun test tests/package_metadata.test.ts",
    "test:sql": "bun run --cwd packages/sql test",
    "test:teta": "bun run --cwd packages/teta test",
    "test:dev": "bun run --cwd packages/dev test",
    "check:metadata": "bun run test:metadata",
    "typecheck": "bun run typecheck:repo && bun run typecheck:sql && bun run typecheck:teta && bun run typecheck:dev",
    "typecheck:repo": "tsc --noEmit -p tsconfig.json",
    "typecheck:sql": "bun run --cwd packages/sql typecheck",
    "typecheck:teta": "bun run --cwd packages/teta typecheck",
    "typecheck:dev": "bun run --cwd packages/dev typecheck",
    "check": "bun run check:metadata && bun run check:sql && bun run check:teta && bun run check:dev",
    "check:sql": "bun run --cwd packages/sql check",
    "check:teta": "bun run --cwd packages/teta check",
    "check:dev": "bun run --cwd packages/dev check",
    "test:runtime:bun": "bun run --cwd packages/teta test:runtime:bun",
    "test:runtime:node": "bun run --cwd packages/teta test:runtime:node",
    "test:runtime:deno": "deno run --node-modules-dir=auto packages/teta/tests/runtime_smoke.ts",
    "bench:render": "bun run --cwd packages/teta bench:render",
    "bench:render:check": "bun run --cwd packages/teta bench:render:check"
  }
}
```

Modify root `tsconfig.json` path mappings:

```json
{
  "compilerOptions": {
    "paths": {
      "@teta/sql": ["packages/sql/mod.ts"],
      "@teta/teta": ["packages/teta/mod.ts"],
      "@teta/dev": ["packages/dev/mod.ts"],
      "jsr:@teta/sql": ["packages/sql/mod.ts"],
      "jsr:@teta/teta": ["packages/teta/mod.ts"]
    }
  }
}
```

- [ ] **Step 5: Install workspace links and verify scaffold passes**

Run:

```bash
bun install
bun run check:metadata
bun run check:sql
```

Expected:

```text
package metadata stays in sync across publish manifests
2 pass
0 fail
```

- [ ] **Step 6: Commit scaffold**

Run:

```bash
git add package.json tsconfig.json tests/package_metadata.test.ts packages/sql
git commit -m "feat: scaffold sql backend package"
```

---

### Task 2: Move Shared Errors And IR Types To `@teta/sql`

**Files:**
- Create: `packages/sql/src/errors.ts`
- Create: `packages/sql/src/ir/types_internal.ts`
- Create: `packages/sql/src/ir/types_expr.ts`
- Create: `packages/sql/src/ir/types_query.ts`
- Create: `packages/sql/src/ir/types.ts`
- Create: `packages/sql/src/ir/validate.ts`
- Create: `packages/sql/src/ir/builders.ts`
- Modify: `packages/sql/mod.ts`
- Modify: `packages/teta/src/edsl/core/types.ts`
- Modify: `packages/teta/src/edsl/core/expr/**/*.ts`
- Modify: `packages/teta/src/edsl/errors.ts`
- Modify: `packages/teta/src/edsl/types.ts`
- Modify: `packages/teta/mod.ts`

- [ ] **Step 1: Write failing tests for exported IR types and errors**

Extend `packages/sql/tests/public_api.test.ts`:

```ts
  test("exports shared error classes", () => {
    expect(typeof sql.TetaError).toBe("function");
    expect(typeof sql.TetaUserError).toBe("function");
    expect(typeof sql.TetaInternalError).toBe("function");
  });

  test("validateQueryIR rejects non-IR values", () => {
    expect(() => sql.validateQueryIR(null)).toThrow(sql.TetaUserError);
    expect(() => sql.ir.validateQueryIR(null)).toThrow(sql.TetaUserError);
  });
```

- [ ] **Step 2: Run the focused failing test**

Run:

```bash
bun test packages/sql/tests/public_api.test.ts
```

Expected: FAIL because the error exports and top-level `validateQueryIR` do not exist.

- [ ] **Step 3: Move errors into `@teta/sql` and re-export from `@teta/teta`**

Move:

```bash
mkdir -p packages/sql/src/ir
git mv packages/teta/src/edsl/errors.ts packages/sql/src/errors.ts
```

Create `packages/teta/src/edsl/errors.ts` as a compatibility re-export for frontend source files:

```ts
export {
  TetaError,
  TetaInternalError,
  TetaUserError,
  internalError,
  userError,
} from "@teta/sql";
export type { TetaErrorCode, TetaErrorKind } from "@teta/sql";
```

- [ ] **Step 4: Move neutral IR type modules**

Run:

```bash
git mv packages/teta/src/edsl/core/types_internal.ts packages/sql/src/ir/types_internal.ts
git mv packages/teta/src/edsl/core/types_expr.ts packages/sql/src/ir/types_expr.ts
git mv packages/teta/src/edsl/core/types_query.ts packages/sql/src/ir/types_query.ts
git mv packages/teta/src/edsl/core/types.ts packages/sql/src/ir/types.ts
```

Create `packages/teta/src/edsl/core/types.ts`:

```ts
export * from "@teta/sql";
```

Update imports in `packages/sql/src/ir/types_query.ts` from relative local names so they point within `packages/sql/src/ir`:

```ts
import type {
  ExprNode,
  IdentifierInput,
  JoinType,
  OrderItem,
  ProjectionItem,
  SqlIdentifier,
  Value,
} from "./types_expr.ts";
import type { GeneratedCteName, InternalCteName, ScopeId } from "./types_internal.ts";
```

Update `packages/sql/src/ir/types.ts`:

```ts
export * from "./types_internal.ts";
export * from "./types_expr.ts";
export * from "./types_query.ts";
```

- [ ] **Step 5: Add basic IR validation**

Create `packages/sql/src/ir/validate.ts`:

```ts
import { TetaUserError } from "../errors.ts";
import type { QueryIR } from "./types_query.ts";

export function validateQueryIR(value: unknown): asserts value is QueryIR {
  if (typeof value !== "object" || value === null) {
    throw new TetaUserError("INVALID_TABLE_SOURCE", "Query IR must be an object");
  }
  if (!("source" in value) || !("stages" in value) || !("scopeId" in value)) {
    throw new TetaUserError(
      "INVALID_TABLE_SOURCE",
      "Query IR must include source, stages, and scopeId"
    );
  }
  const stages = (value as { stages?: unknown }).stages;
  if (!Array.isArray(stages)) {
    throw new TetaUserError("INVALID_TABLE_SOURCE", "Query IR stages must be an array");
  }
}
```

- [ ] **Step 6: Add minimal IR helper namespace**

Create `packages/sql/src/ir/builders.ts`:

```ts
export { generatedCteName } from "./types_internal.ts";
export {
  validateQueryIR,
} from "./validate.ts";
export {
  isValuesSource,
} from "./types_query.ts";
```

This task adds the namespace shell only. Later tasks add backend utility constructors after `query/utils.ts` is split.

- [ ] **Step 7: Update `@teta/sql` exports**

Replace `packages/sql/mod.ts` with:

```ts
export * from "./src/errors.ts";
export * from "./src/ir/types.ts";
export { validateQueryIR } from "./src/ir/validate.ts";
export * as ir from "./src/ir/builders.ts";

function backendNotMigrated(name: string): never {
  throw new Error(`${name} is not migrated yet`);
}

export function irToAst(): never {
  backendNotMigrated("irToAst");
}

export function irToSql(): never {
  backendNotMigrated("irToSql");
}

export function irToSqlResult(): never {
  backendNotMigrated("irToSqlResult");
}

export function exprToSql(): never {
  backendNotMigrated("exprToSql");
}

export function exprToSqlResult(): never {
  backendNotMigrated("exprToSqlResult");
}

export function explainIR(): never {
  backendNotMigrated("explainIR");
}
```

- [ ] **Step 8: Update frontend package imports and exports**

Update frontend source files that imported from `../core/types.ts` only for types/constants to import from `@teta/sql` directly, for example:

```ts
import type { ExprNode, ProjectionItem, SqlIdentifier } from "@teta/sql";
import { OUTER_TABLE_ALIAS } from "@teta/sql";
```

Keep `packages/teta/src/edsl/core/types.ts` as a re-export until all frontend imports are clean.

Update `packages/teta/mod.ts` error/type exports so public users still get shared errors and SQL type brands from `@teta/teta`:

```ts
export const TetaError: typeof import("@teta/sql").TetaError = sql.TetaError;
export type TetaError = import("@teta/sql").TetaError;
```

Use the same explicit pattern already used in `mod.ts` for each public class/type.

- [ ] **Step 9: Verify IR/errors extraction**

Run:

```bash
bun run check:sql
bun run check:teta
```

Expected: both commands exit `0`.

- [ ] **Step 10: Commit IR extraction**

Run:

```bash
git add packages/sql packages/teta
git commit -m "refactor: move shared ir and errors to sql package"
```

---

### Task 3: Move Backend-Safe Query Utilities To `@teta/sql`

**Files:**
- Create: `packages/sql/src/ir/utils.ts`
- Modify: `packages/sql/src/ir/builders.ts`
- Modify: `packages/teta/src/edsl/query/utils.ts`
- Modify: `packages/teta/tests/utils.test.ts`
- Create: `packages/sql/tests/ir_utils.test.ts`

- [ ] **Step 1: Write failing backend utility tests**

Create `packages/sql/tests/ir_utils.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import {
  columnNamesToIdentifierMap,
  normalizeIdentifier,
  normalizeJoinType,
  normalizeTableSource,
  shouldQuoteIdentifierName,
} from "../mod.ts";

describe("sql ir utilities", () => {
  test("normalizes identifiers and quotes invalid names", () => {
    expect(shouldQuoteIdentifierName("user_id")).toBe(false);
    expect(shouldQuoteIdentifierName("user id")).toBe(true);
    expect(normalizeIdentifier("user id", "column")).toEqual({
      name: "user id",
      quoted: true,
    });
  });

  test("normalizes table sources", () => {
    expect(normalizeTableSource("analytics.events")).toEqual({
      db: null,
      schema: { name: "analytics", quoted: false },
      table: { name: "events", quoted: false },
      as: null,
    });
  });

  test("normalizes join types", () => {
    expect(normalizeJoinType("left")).toBe("LEFT");
    expect(() => normalizeJoinType("semi")).toThrow();
  });

  test("builds identifier maps from column names", () => {
    expect(columnNamesToIdentifierMap(["id"])).toEqual({
      id: { name: "id", quoted: false },
    });
  });
});
```

- [ ] **Step 2: Run failing utility tests**

Run:

```bash
bun test packages/sql/tests/ir_utils.test.ts
```

Expected: FAIL because the utility exports do not exist from `@teta/sql`.

- [ ] **Step 3: Split `packages/teta/src/edsl/query/utils.ts`**

Create `packages/sql/src/ir/utils.ts` by moving these backend-safe functions from `packages/teta/src/edsl/query/utils.ts`:

```ts
shouldQuoteIdentifierName
normalizeIdentifier
identifierName
projectionItemOutputIdentifier
projectionItemOutputName
projectionItemsToIdentifierMap
columnNamesToIdentifierMap
normalizeTableSource
autoAlias
sourceAliasBase
normalizeJoinType
assertUnionCompatible
assertLoopColumns
mergeWiths
```

Keep this frontend-only function in `packages/teta/src/edsl/query/utils.ts`:

```ts
export function qualifyOuterColumns<TColumns extends Record<string, any>>(
  columns: ColumnRefs<TColumns>
): ColumnRefs<TColumns> {
  const result: Record<string, ColumnRef<any, string>> = {};
  for (const key of Object.keys(columns)) {
    result[key] = new ColumnRef<any, string>(OUTER_TABLE_ALIAS, key);
  }
  return result as ColumnRefs<TColumns>;
}
```

Re-export moved utilities from `packages/teta/src/edsl/query/utils.ts` so existing frontend imports keep working during the migration:

```ts
export {
  assertLoopColumns,
  assertUnionCompatible,
  autoAlias,
  columnNamesToIdentifierMap,
  identifierName,
  mergeWiths,
  normalizeIdentifier,
  normalizeJoinType,
  normalizeTableSource,
  projectionItemOutputIdentifier,
  projectionItemOutputName,
  projectionItemsToIdentifierMap,
  shouldQuoteIdentifierName,
  sourceAliasBase,
} from "@teta/sql";
```

- [ ] **Step 4: Export backend utilities and helper namespace entries**

Update `packages/sql/mod.ts`:

```ts
export * from "./src/ir/utils.ts";
```

Update `packages/sql/src/ir/builders.ts`:

```ts
export {
  assertLoopColumns,
  assertUnionCompatible,
  autoAlias,
  columnNamesToIdentifierMap,
  identifierName,
  mergeWiths,
  normalizeIdentifier,
  normalizeJoinType,
  normalizeTableSource,
  projectionItemOutputIdentifier,
  projectionItemOutputName,
  projectionItemsToIdentifierMap,
  shouldQuoteIdentifierName,
  sourceAliasBase,
} from "./utils.ts";
```

- [ ] **Step 5: Move utility tests to backend package**

Update `packages/teta/tests/utils.test.ts` so it only covers frontend-specific behavior or remove backend-only assertions from it.

The backend-only assertions now live in `packages/sql/tests/ir_utils.test.ts`.

- [ ] **Step 6: Verify utilities**

Run:

```bash
bun test packages/sql/tests/ir_utils.test.ts
bun run check:sql
bun run check:teta
```

Expected: all commands exit `0`.

- [ ] **Step 7: Commit utility split**

Run:

```bash
git add packages/sql packages/teta
git commit -m "refactor: move ir utilities to sql package"
```

---

### Task 4: Move SQL Backend Rendering To `@teta/sql`

**Files:**
- Move: `packages/teta/src/edsl/sql/**` to `packages/sql/src/**`
- Create: `packages/sql/tests/renderer.test.ts`
- Create: `packages/sql/tests/pipeline.test.ts`
- Modify: `packages/sql/mod.ts`
- Modify: `packages/sql/src/renderer.ts`
- Modify: `packages/sql/src/renderer_target.ts`
- Modify: `packages/sql/src/render/pipeline.ts`
- Modify: `packages/teta/src/edsl/sql.ts`
- Modify: `packages/teta/tests/renderer.test.ts`
- Modify: `packages/teta/tests/pipeline.test.ts`

- [ ] **Step 1: Write failing direct backend render tests**

Create `packages/sql/tests/renderer.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import {
  exprToSql,
  exprToSqlResult,
  ir,
  irToSql,
  irToSqlResult,
  type ExprNode,
  type QueryIR,
} from "../mod.ts";

const idColumn = {
  kind: "column",
  table: "users_0",
  name: "id",
} satisfies ExprNode<number>;

const simpleIR = {
  source: {
    db: null,
    schema: null,
    table: { name: "users", quoted: false },
    as: null,
  },
  stages: [],
  scopeId: "__teta_scope_test" as QueryIR["scopeId"],
  columnNames: ["id"],
  columnIdentifiers: {
    id: { name: "id", quoted: false },
  },
  withs: [],
} satisfies QueryIR & {
  columnNames: readonly string[];
  columnIdentifiers: Record<string, { name: string; quoted: boolean }>;
  withs: [];
};

describe("sql backend renderer", () => {
  test("renders expression IR directly", () => {
    expect(exprToSql(idColumn, { dialect: "postgresql" })).toBe("users_0.id");
    expect(exprToSqlResult(idColumn, { dialect: "postgresql" })).toEqual({
      sql: "users_0.id",
      params: [],
    });
  });

  test("renders query IR directly", () => {
    ir.validateQueryIR(simpleIR);
    expect(irToSql(simpleIR, { dialect: "postgresql", format: "compact" })).toBe(
      "SELECT users_0.id FROM users AS users_0"
    );
    expect(irToSqlResult(simpleIR, { dialect: "postgresql", format: "compact" })).toEqual({
      sql: "SELECT users_0.id FROM users AS users_0",
      params: [],
    });
  });
});
```

- [ ] **Step 2: Run failing backend render tests**

Run:

```bash
bun test packages/sql/tests/renderer.test.ts
```

Expected: FAIL because backend render functions still throw "not migrated yet".

- [ ] **Step 3: Move SQL backend directory**

Run:

```bash
git mv packages/teta/src/edsl/sql/dialect packages/sql/src/dialect
git mv packages/teta/src/edsl/sql/language packages/sql/src/language
git mv packages/teta/src/edsl/sql/render packages/sql/src/render
git mv packages/teta/src/edsl/sql/renderer.ts packages/sql/src/renderer.ts
git mv packages/teta/src/edsl/sql/renderer_output.ts packages/sql/src/renderer_output.ts
git mv packages/teta/src/edsl/sql/renderer_target.ts packages/sql/src/renderer_target.ts
git mv packages/teta/src/edsl/sql/renderer_types.ts packages/sql/src/renderer_types.ts
git mv packages/teta/src/edsl/sql/types.ts packages/sql/src/types.ts
git mv packages/teta/src/edsl/sql/dialect.ts packages/sql/src/dialect.ts
git mv packages/teta/src/edsl/sql/language.ts packages/sql/src/language.ts
```

Keep frontend expression helper files under `packages/teta/src/edsl/sql/expr/**`.

Create `packages/teta/src/edsl/sql.ts` as a frontend re-export shim:

```ts
export * from "@teta/sql";
```

- [ ] **Step 4: Fix moved backend imports**

In moved backend files under `packages/sql/src`, replace imports:

```ts
from "../core/types.ts"
from "../../core/types.ts"
from "../../query/utils.ts"
from "../errors.ts"
```

with imports from local backend modules:

```ts
from "./ir/types.ts"
from "../ir/types.ts"
from "../ir/utils.ts"
from "../errors.ts"
```

Use package-local relative paths inside `packages/sql/src`. Do not import `@teta/teta` anywhere in `packages/sql`.

- [ ] **Step 5: Implement backend render entrypoints**

Update `packages/sql/src/renderer.ts` so query rendering starts from backend IR shapes:

```ts
import nodeSqlParser from "node-sql-parser";
const { Parser } = nodeSqlParser;
import { buildSqlOptions } from "./dialect.ts";
import {
  renderExprTarget,
  renderQueryIRTarget,
} from "./renderer_target.ts";
import type {
  ExprSqlTarget,
  QueryIRSqlTarget,
  RendererState,
} from "./renderer_types.ts";
import type { SqlOptions, SqlResult } from "./types.ts";

export function irToSqlResult<TResult extends SqlResult = SqlResult>(
  target: QueryIRSqlTarget,
  options: SqlOptions = {}
): TResult {
  const state = createRendererState(options);
  return renderQueryIRTarget(target, state) as TResult;
}

export function irToSql(
  target: QueryIRSqlTarget,
  options: SqlOptions = {}
): string {
  return irToSqlResult(target, options).sql;
}

export function exprToSqlResult<TResult extends SqlResult = SqlResult>(
  target: ExprSqlTarget,
  options: SqlOptions = {}
): TResult {
  const state = createRendererState(options);
  return renderExprTarget(target, state) as TResult;
}

export function exprToSql(
  target: ExprSqlTarget,
  options: SqlOptions = {}
): string {
  return exprToSqlResult(target, options).sql;
}

function createRendererState(options: Parameters<typeof buildSqlOptions>[0]): RendererState {
  const resolved = buildSqlOptions(options);
  return {
    parser: new Parser(),
    dialect: resolved.dialect,
    options: resolved.options,
    sqlFormat: resolved.sqlFormat,
    renderStrategy: resolved.renderStrategy,
    parameterMode: resolved.parameterMode,
    parameterPrefix: resolved.parameterPrefix,
  };
}
```

Update `packages/sql/src/renderer_types.ts`:

```ts
import { Parser, type Option } from "node-sql-parser";
import type { CteSpec, ExprNode, QueryIR, SqlIdentifier } from "./ir/types.ts";
import type {
  QueryDialect,
  SqlFormat,
  SqlParameterMode,
  SqlParameterPrefix,
  SqlRenderStrategy,
} from "./types.ts";

export type QueryIRSqlTarget = QueryIR & {
  columnNames: readonly string[];
  columnIdentifiers: Readonly<Record<string, SqlIdentifier>>;
  withs?: CteSpec[];
};

export type ExprSqlTarget =
  | ExprNode<unknown>
  | { node: ExprNode<unknown> };

export type RendererState = {
  parser: Parser;
  dialect: QueryDialect;
  options?: Option;
  sqlFormat: SqlFormat;
  renderStrategy: SqlRenderStrategy;
  parameterMode: SqlParameterMode;
  parameterPrefix: SqlParameterPrefix;
};
```

- [ ] **Step 6: Implement `irToAst(...)` and `explainIR(...)`**

In `packages/sql/src/renderer.ts`, add:

```ts
import type { AST } from "node-sql-parser";
import { applyDialectFixes } from "./render/fixes.ts";
import { renderPipelineAst } from "./render/pipeline.ts";

export function irToAst(
  target: QueryIRSqlTarget,
  options: Pick<SqlOptions, "dialect" | "renderStrategy"> = {}
): AST {
  const resolved = buildSqlOptions(options);
  return applyDialectFixes(
    renderPipelineAst(
      target.source,
      target.stages,
      target.columnNames,
      target.scopeId,
      {
        baseCtes: target.withs ?? [],
        dialect: resolved.dialect,
        renderStrategy: resolved.renderStrategy,
      }
    ),
    resolved.dialect
  );
}

export function explainIR(
  target: QueryIRSqlTarget,
  options: SqlOptions = {}
) {
  const resolved = buildSqlOptions(options);
  const sqlResult = irToSqlResult(target, options);
  return {
    ir: target,
    ast: irToAst(target, options),
    sql: sqlResult.sql,
    params: sqlResult.params,
    columnNames: target.columnNames,
    stages: target.stages.map((stage, index) => ({ index, kind: stage.kind })),
    ctes: (target.withs ?? []).map((cte) => ({ name: cte.name, kind: cte.kind })),
    dialect: resolved.dialect,
    format: resolved.sqlFormat,
    renderStrategy: resolved.renderStrategy,
    parameterMode: resolved.parameterMode,
    parameterPrefix: resolved.parameterPrefix,
  };
}
```

- [ ] **Step 7: Update target rendering**

Update `packages/sql/src/renderer_target.ts`:

```ts
import { applyDialectLanguage } from "./language.ts";
import { applyDialectFixes } from "./render/fixes.ts";
import { renderPipelineAst } from "./render/pipeline.ts";
import { withSqlRenderContext } from "./render/render.ts";
import { createRenderContext, renderAst, renderExprNode } from "./renderer_output.ts";
import type {
  ExprSqlTarget,
  QueryIRSqlTarget,
  RendererState,
} from "./renderer_types.ts";
import type { ExprNode } from "./ir/types.ts";
import type { SqlResult } from "./types.ts";

export function renderQueryIRTarget(
  target: QueryIRSqlTarget,
  state: RendererState
): SqlResult {
  const renderContext = createRenderContext(state);
  const ast = withSqlRenderContext(renderContext, () =>
    applyDialectFixes(
      renderPipelineAst(target.source, target.stages, target.columnNames, target.scopeId, {
        baseCtes: target.withs ?? [],
        dialect: state.dialect,
        renderStrategy: state.renderStrategy,
      }),
      state.dialect
    )
  );

  return {
    sql: renderAst(ast, state, renderContext),
    params: renderContext.params,
  };
}

export function renderExprTarget(
  target: ExprSqlTarget,
  state: RendererState
): SqlResult {
  const renderContext = createRenderContext(state);
  const node = unwrapExprTarget(target);
  const expr = applyDialectLanguage(node, state.dialect);

  return {
    sql: withSqlRenderContext(renderContext, () =>
      renderExprNode(expr, state, renderContext)
    ),
    params: renderContext.params,
  };
}

function unwrapExprTarget(target: ExprSqlTarget): ExprNode<unknown> {
  return "node" in target ? target.node : target;
}
```

- [ ] **Step 8: Export backend APIs**

Update `packages/sql/mod.ts`:

```ts
export * from "./src/errors.ts";
export * from "./src/ir/types.ts";
export * from "./src/ir/utils.ts";
export { validateQueryIR } from "./src/ir/validate.ts";
export * as ir from "./src/ir/builders.ts";
export * from "./src/types.ts";
export * from "./src/dialect.ts";
export {
  exprToSql,
  exprToSqlResult,
  explainIR,
  irToAst,
  irToSql,
  irToSqlResult,
} from "./src/renderer.ts";
export type {
  ExprSqlTarget,
  QueryIRSqlTarget,
} from "./src/renderer_types.ts";
export { renderPipelineAst, createDeferredRecursiveCte, buildRecursiveCte } from "./src/render/pipeline.ts";
export { applyDialectFixes } from "./src/render/fixes.ts";
export { formatSqlPretty, stripRedundantQuotes } from "./src/render/format.ts";
```

- [ ] **Step 9: Move backend pipeline test**

Move `packages/teta/tests/pipeline.test.ts` to `packages/sql/tests/pipeline.test.ts`.

Update its imports:

```ts
import { describe, expect, test } from "bun:test";
import { map, replace, t, table, toIR } from "@teta/teta";
import { renderPipelineAst } from "../mod.ts";
```

Update calls that accessed `filtered.source`, `filtered.stages`, and related fields to use `const filteredIR = toIR(filtered);`.

- [ ] **Step 10: Verify backend rendering**

Run:

```bash
bun run check:sql
```

Expected: SQL package tests and typecheck pass.

- [ ] **Step 11: Commit backend move**

Run:

```bash
git add packages/sql packages/teta
git commit -m "refactor: move sql renderer to backend package"
```

---

### Task 5: Rewire `@teta/teta` As Frontend Facade

**Files:**
- Modify: `packages/teta/package.json`
- Modify: `packages/teta/jsr.json`
- Modify: `packages/teta/src/edsl/query/builder.ts`
- Modify: `packages/teta/src/edsl/query.ts`
- Modify: `packages/teta/src/edsl/types.ts`
- Modify: `packages/teta/mod.ts`
- Modify: `packages/teta/tests/renderer.test.ts`
- Modify: `packages/teta/tests/explain.test.ts`
- Modify: `packages/teta/tests/typecheck.ts`
- Modify: `packages/teta/tests/runtime_smoke.ts`

- [ ] **Step 1: Write frontend/backend equality tests**

Update `packages/teta/tests/renderer.test.ts` imports:

```ts
import { describe, expect, test } from "bun:test";
import { pipe } from "remeda";
import { irToSql, irToSqlResult } from "@teta/sql";
import { and, eq, filter, map, param, t, table, toIR, toSql, toSqlResult } from "../mod.ts";
```

Add tests:

```ts
  test("toSql(query) delegates through backend ir rendering", () => {
    const query = buildUserPipelineQuery();
    const options = { dialect: "postgresql", format: "compact" } as const;

    expect(toSql(query, options)).toBe(irToSql(toIR(query), options));
  });

  test("toSqlResult(query) delegates through backend ir rendering", () => {
    const users = table("users", {
      id: t.int(),
      name: t.string(),
    });
    const name = "Ada";
    const query = pipe(
      users,
      filter((user) => eq(user.name, param(name))),
      map((user) => ({ id: user.id }))
    );
    const options = { dialect: "postgresql", format: "compact" } as const;

    expect(toSqlResult(query, options)).toEqual(irToSqlResult(toIR(query), options));
  });
```

Move expression-only `toSql(add(1, 2))` tests from `packages/teta/tests/renderer.test.ts` to `packages/sql/tests/renderer.test.ts`. In the SQL test, use `exprToSql(...)` and expression IR nodes.

- [ ] **Step 2: Run failing frontend tests**

Run:

```bash
bun test packages/teta/tests/renderer.test.ts
```

Expected: FAIL while `@teta/teta` still uses old render internals or expression overloads.

- [ ] **Step 3: Update `@teta/teta` dependencies**

Modify `packages/teta/package.json`:

```json
{
  "dependencies": {
    "@teta/sql": "workspace:*",
    "remeda": "^2.33.6"
  },
  "devDependencies": {
    "@duckdb/node-api": "^1.4.4-r.3",
    "@types/bun": "latest",
    "typescript": "^5.9.3"
  }
}
```

Remove `node-sql-parser` from `@teta/teta` because `@teta/sql` owns it.

Modify `packages/teta/jsr.json` to add the backend package import mapping:

```json
{
  "imports": {
    "@teta/sql": "jsr:@teta/sql@^0.1.0"
  }
}
```

- [ ] **Step 4: Convert query render functions to facades**

Update imports in `packages/teta/src/edsl/query/builder.ts`:

```ts
import type { AST } from "node-sql-parser";
import {
  buildSqlOptions,
  explainIR,
  irToAst,
  irToSql,
  irToSqlResult,
  resolveDialect,
  type Dialect,
  type QueryDialect,
  type SqlFormat,
  type SqlOptions,
  type SqlParameterMode,
  type SqlParameterPrefix,
  type SqlRenderStrategy,
  type SqlResult,
} from "@teta/sql";
import type { QueryIR as BackendQueryIR, QueryIRSqlTarget } from "@teta/sql";
```

Define frontend `QueryIR<TColumns>` as the backend render target with type branding:

```ts
export type QueryIR<TColumns extends QueryColumns> = QueryIRSqlTarget & {
  readonly _columns?: TColumns;
};
```

Update `toIR(...)`:

```ts
export function toIR<TColumns extends QueryColumns>(query: Query<TColumns>): QueryIR<TColumns> {
  return {
    source: query.source,
    stages: query.stages,
    scopeId: query.sourceScopeId,
    columnNames: query.columnNames,
    columnIdentifiers: query.columnIdentifiers,
    withs: query.withs,
  };
}
```

Update `toAst(...)`, `toSql(...)`, `toSqlResult(...)`, and `explain(...)`:

```ts
export function toAst<TColumns extends QueryColumns>(
  query: Query<TColumns>,
  options?: { dialect?: Dialect; renderStrategy?: SqlRenderStrategy }
): AST {
  return irToAst(toIR(query), options);
}

export function toSql<TColumns extends QueryColumns>(
  query: Query<TColumns>,
  options: SqlOptions = {}
): string {
  return irToSql(toIR(query), options);
}

export function toSqlResult<TColumns extends QueryColumns>(
  query: Query<TColumns>,
  options: SqlOptions = {}
): SqlResult {
  return irToSqlResult(toIR(query), options);
}

export function explain<TColumns extends QueryColumns>(
  query: Query<TColumns>,
  options: SqlOptions = {}
): QueryExplainResult<TColumns> {
  return explainIR(toIR(query), options) as QueryExplainResult<TColumns>;
}
```

- [ ] **Step 5: Update public root exports**

In `packages/teta/mod.ts`, keep frontend helpers and re-export selected backend types/errors:

```ts
import * as sql from "@teta/sql";

export const TetaError: typeof import("@teta/sql").TetaError = sql.TetaError;
export const TetaUserError: typeof import("@teta/sql").TetaUserError = sql.TetaUserError;
export const TetaInternalError: typeof import("@teta/sql").TetaInternalError = sql.TetaInternalError;
export type TetaError = import("@teta/sql").TetaError;
export type TetaUserError = import("@teta/sql").TetaUserError;
export type TetaInternalError = import("@teta/sql").TetaInternalError;
export type SqlOptions = import("@teta/sql").SqlOptions;
export type SqlResult = import("@teta/sql").SqlResult;
```

Do not re-export backend internals such as `renderPipelineAst` from `@teta/teta`.

- [ ] **Step 6: Update frontend tests and typecheck**

Update tests that import backend internals from `packages/teta/src/edsl/sql/**` to import from `@teta/sql` or move them to `packages/sql/tests`.

Update typecheck expectations so `toSql(...)` and `toSqlResult(...)` accept `Query` values. Expression rendering should use `exprToSql(...)` from `@teta/sql`.

- [ ] **Step 7: Verify frontend facade**

Run:

```bash
bun run check:teta
bun run check:sql
```

Expected: both commands exit `0`.

- [ ] **Step 8: Commit frontend rewiring**

Run:

```bash
git add packages/teta packages/sql
git commit -m "refactor: make teta a sql frontend facade"
```

---

### Task 6: Update Dev Package, Docs, CI, And Publishing

**Files:**
- Modify: `packages/dev/src/render_source_shared.ts`
- Modify: `packages/dev/src/render_source_isolated.ts`
- Modify: `packages/dev/package.json`
- Modify: `packages/dev/deno.json`
- Modify: `packages/dev/jsr.json`
- Modify: `doc/DEV_GUIDE.md`
- Modify: `doc/TUTORIAL.md`
- Modify: `doc/TYPES.md`
- Modify: `doc/cheatsheet.md`
- Modify: `packages/teta/README.md`
- Modify: `packages/dev/README.md`
- Modify: `.github/workflows/ci.yaml`
- Modify: `.github/workflows/publish.yaml`

- [ ] **Step 1: Write dev package test for frontend convenience rendering**

Update `packages/dev/tests/public_api.test.ts` expected source module to keep exporting a frontend `Query` from `@teta/teta`. The existing test remains valid:

```ts
export const query = pipe(users, map((user) => ({ id: user.id })));
```

Add an assertion that `renderSqlFromSource(file)` still returns:

```ts
"SELECT users_0.id FROM users AS users_0"
```

- [ ] **Step 2: Update dev renderer typing**

In `packages/dev/src/render_source_shared.ts`, replace `SqlCompilable` with a query-like structural type:

```ts
import { TetaUserError, toSql, type SqlOptions } from "@teta/teta";

export type QueryLike = {
  source: unknown;
  stages: unknown[];
  columnNames: readonly string[];
  sourceScopeId: string;
};
```

Keep `isQueryLike(...)` query-only:

```ts
export function isQueryLike(value: unknown): value is QueryLike {
  if (typeof value !== "object" || value === null) return false;
  return (
    "source" in value
    && "stages" in value
    && "columnNames" in value
    && "sourceScopeId" in value
  );
}
```

Update error text:

```ts
`Export '${exportName}' must be a SQL string, Query-like object, or a function returning one`
```

- [ ] **Step 3: Update isolated render script imports**

In `packages/dev/src/render_source_isolated.ts`, keep `TETA_CORE_MODULE` defaulting to `@teta/teta`.

The isolated script should call `teta.toSql(target, rendererOptions)` for Query-like exports. It should not import `@teta/sql` directly.

- [ ] **Step 4: Update docs with split package examples**

Update docs to show both flows:

```ts
import { toSql, toIR } from "@teta/teta";
import { irToSql } from "@teta/sql";

const direct = toSql(query, { dialect: "postgresql" });
const explicit = irToSql(toIR(query), { dialect: "postgresql" });
```

In `doc/DEV_GUIDE.md`, update the mental model:

```text
@teta/teta frontend
  -> @teta/sql IR
  -> @teta/sql SQL backend
```

In `doc/TYPES.md`, make `SqlOptions`, `SqlResult`, `QueryIR`, `ExprNode`, and `Stage` point to `@teta/sql` as the canonical owner.

- [ ] **Step 5: Update CI workflow**

In `.github/workflows/ci.yaml`, update the main check command:

```yaml
- name: Run check
  run: bun run check:sql && bun run check:teta && bun run check:dev
```

Add a `jsr-dry-run-sql` job:

```yaml
  jsr-dry-run-sql:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    defaults:
      run:
        working-directory: packages/sql
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest
      - uses: denoland/setup-deno@v2
        with:
          deno-version: v2.x
      - name: Install dependencies
        run: bun install --frozen-lockfile
      - name: Validate @teta/sql publish bundle
        run: bunx jsr publish --dry-run --allow-dirty
```

- [ ] **Step 6: Update publish workflow**

In `.github/workflows/publish.yaml`, add output `sql`:

```yaml
    outputs:
      sql: ${{ steps.detect.outputs.sql }}
      teta: ${{ steps.detect.outputs.teta }}
      dev: ${{ steps.detect.outputs.dev }}
```

Add detection:

```bash
          if git diff --quiet "$before" "$GITHUB_SHA" -- packages/sql/package.json packages/sql/jsr.json; then
            echo "sql=false" >> "$GITHUB_OUTPUT"
          else
            echo "sql=true" >> "$GITHUB_OUTPUT"
          fi
```

Add `publish-sql` before `publish-teta`:

```yaml
  publish-sql:
    needs: detect-release-changes
    if: needs.detect-release-changes.outputs.sql == 'true'
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    defaults:
      run:
        working-directory: packages/sql
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest
      - uses: denoland/setup-deno@v2
        with:
          deno-version: v2.x
      - name: Install deps
        run: bun install --frozen-lockfile
      - name: Publish @teta/sql
        run: bunx jsr publish
```

Make `publish-teta` depend on both detection and SQL publish:

```yaml
  publish-teta:
    needs:
      - detect-release-changes
      - publish-sql
```

Use an `if` expression that still runs when SQL did not change:

```yaml
    if: always() && needs.detect-release-changes.outputs.teta == 'true' && (needs.publish-sql.result == 'success' || needs.publish-sql.result == 'skipped')
```

- [ ] **Step 7: Verify docs and workflows**

Run:

```bash
bun run check:dev
bun run check:metadata
```

Expected: both commands exit `0`.

- [ ] **Step 8: Commit dev/docs/CI updates**

Run:

```bash
git add packages/dev doc packages/teta/README.md .github/workflows package.json tsconfig.json tests/package_metadata.test.ts
git commit -m "chore: wire sql backend package into docs and ci"
```

---

### Task 7: Final Verification And Release Readiness

**Files:**
- Modify: `bun.lock`
- Inspect: all changed files

- [ ] **Step 1: Refresh workspace lockfile**

Run:

```bash
bun install
```

Expected: `bun.lock` records the new `@teta/sql` workspace package and dependency edges.

- [ ] **Step 2: Run full verification**

Run:

```bash
bun run check
```

Expected summary:

```text
package metadata stays in sync across publish manifests
@teta/sql tests pass
@teta/teta tests pass
@teta/dev tests pass
tsc --noEmit exits 0 for repo, sql, teta, and dev
```

- [ ] **Step 3: Run runtime smoke tests**

Run:

```bash
bun run test:runtime:bun
bun run test:runtime:node
bun run test:runtime:deno
```

Expected: all runtime smoke commands exit `0`.

- [ ] **Step 4: Run JSR dry-runs when network is available**

Run:

```bash
bunx jsr publish --dry-run --allow-dirty
```

from each package directory:

```bash
packages/sql
packages/teta
packages/dev
```

Expected: each dry-run validates the publish bundle. If Deno binary download fails with a network error, record the exact error and rerun in CI or after network recovery.

- [ ] **Step 5: Inspect package dependency direction**

Run:

```bash
grep -RIn --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.worktrees '@teta/teta\\|packages/teta\\|../teta' packages/sql
```

Expected: no output.

Run:

```bash
grep -RIn --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.worktrees '@teta/sql' packages/teta packages/dev
```

Expected: `packages/teta` imports `@teta/sql`; `packages/dev` has no `@teta/sql` imports.

- [ ] **Step 6: Commit lockfile and final adjustments**

Run:

```bash
git add bun.lock packages package.json tsconfig.json tests .github doc
git commit -m "chore: finalize sql backend package split"
```

- [ ] **Step 7: Final status**

Run:

```bash
git status --short --branch
git log --oneline --decorate --max-count=8
```

Expected: only known unrelated untracked user files remain. The recent commits should show the SQL backend package split in staged migration commits.

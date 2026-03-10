# teta

Type-safe SQL EDSL for TypeScript with composable query pipelines.

## Features

- Typed column refs with autocomplete
- Composable pipeline steps (each step compiles to a CTE)
- Method-centric expression helpers (math/string/date/array/window)
- Dialect-aware SQL rendering (pretty or compact)
- Dialect language mapping + fallback rewrites at `toSql(...)`

## Playground

- https://futu2.github.io/teta-tutorial/

## Install

```bash
bun install
```

## Nix dev shell

```bash
nix develop
```

The dev shell provides `bun`. On Linux it also exposes the `libstdc++`
runtime via `LD_LIBRARY_PATH`, which helps native Bun dependencies such as
DuckDB load correctly.

If the flake is not tracked by Git yet, use a direct path reference instead:

```bash
nix develop path:$PWD
```

## Testing

The test suite covers:

- SQL generation for `postgresql`, `mysql`, `duckdb`, and `sqlite`
- parser smoke tests for generated dialect-specific SQL
- live `sqlite` execution tests
- live `duckdb` execution tests when the native binding is available

Run the default suite:

```bash
bun test
# or
bun run test
```

Run a single file:

```bash
bun test tests/dialects.test.ts
```

Run the full suite inside the Nix shell, including DuckDB live tests:

```bash
nix develop -c bun test
```

Type-check the project, including the tests:

```bash
nix develop -c bun x tsc --noEmit
```

If the flake is not tracked by Git yet, replace `nix develop` with `nix develop path:$PWD`.

## Quick start

Note: `table(...)` requires a schema to avoid `SELECT *` and keep column names explicit.
Generated SQL always uses auto-generated aliases (e.g., `users_0`, `orders_1`) and fully
qualified column references.

```ts
import { sqlRenderer, table, t } from "./mod.ts";

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

console.log(q.toSql(sqlRenderer({ dialect: "postgresql", format: "pretty" })));
```

## Dialect-neutral EDSL, dialect at render time

Keep EDSL expressions general, then choose SQL dialect only in `toSql(...)`:

```ts
console.log(q.toSql(sqlRenderer({
  dialect: {
    name: "presto",
    parserDialect: "Trino",
  },
  format: "pretty",
})));
```

If you want compilation config to live outside the expression/query definition,
build a renderer once and reuse it:

```ts
import { duckdbRenderer } from "./mod.ts";

const renderer = duckdbRenderer({ format: "pretty" });
const { sql, params } = q.toSqlResult(renderer);
```

Rule of thumb:

- use `toSql(...)` by default
- use `toSqlResult(...)` only when you need `params` or structured render metadata

## Safe SQL parameters with `param(...)`

Use `param(...)` for values that come from request input, auth/session context,
or any other runtime source. Keep trusted application constants inline.

For example, imagine a support dashboard endpoint that lists paid orders for the
currently signed-in tenant and an email typed into a search box. Here `session`
and `request` come from your web framework:

```ts
import { param, sqlRenderer, table, t } from "./mod.ts";

const orders = table("orders", {
  id: t.int(),
  tenant_id: t.string(),
  customer_email: t.string(),
  status: t.string(),
  total_cents: t.int(),
});

const tenantId = session.tenantId;
const email = request.query.email?.trim() ?? "";

const result = orders
  .filter((o) =>
    o.tenant_id.eq(param(tenantId)).and(
      o.customer_email.eq(param(email)).and(
        o.status.eq("paid")
      )
    )
  )
  .select((o) => ({
    id: o.id,
    customer_email: o.customer_email,
    total_cents: o.total_cents,
  }))
  .toSqlResult(sqlRenderer({
    dialect: "postgresql",
    format: "compact",
  }));

console.log(result);
// {
//   sql: "SELECT orders_0.id, orders_0.customer_email, orders_0.total_cents FROM orders AS orders_0 WHERE orders_0.tenant_id = $1 AND orders_0.customer_email = $2 AND orders_0.status = 'paid'",
//   params: [
//     { value: tenantId, index: 1, name: null },
//     { value: email, index: 2, name: null }
//   ]
// }
```

In that example, `tenantId` and `email` are runtime values so they use `param(...)`,
while `"paid"` is a trusted constant that can stay inline.

The `name` field in `SqlResult.params` is only used for named placeholders. With
default positional rendering you will usually see `name: null` together with an
`index` such as `$1` or `$2`.

## Function-first query composition

If you prefer a more functional style, the query layer exposes pipe-ready
curried query builders. The class methods remain thin immutable sugar on top
of the same pure operations.

```ts
import {
  filter,
  limit,
  orderBy,
  pipeQuery,
  select,
  sqlRenderer,
  toSql,
  table,
  t,
} from "./mod.ts";

const users = table("users", {
  id: t.int(),
  name: t.string(),
  age: t.int(),
  active: t.boolean(),
});

const q = pipeQuery(
  users,
  filter((user) => user.active.eq(true).and(user.age.gte(18))),
  select((user) => ({
    id: user.id,
    name: user.name.replace(" ", "_").coalesce("unknown"),
    age: user.age,
  })),
  orderBy((row) => [row.name.asc(), row.id.desc()]),
  limit(20)
);

console.log(toSql(q, sqlRenderer({ dialect: "postgresql", format: "pretty" })));
```

For plain object reshaping inside `select(...)` / `aggregate(...)`, `remeda` fits nicely (optional, app-level dependency):

```ts
import * as R from "remeda";

const ids = users.select(R.pick(["id"]));
const compact = users.select((u) => ({ ...R.omit(u, ["name"]), upper_name: u.name.upper() }));
```

If you want a named placeholder for your own integration layer, pass a second
argument such as `param(email, "customer_email")` and render with
`parameterMode: "named"`:

```ts
const result = orders
  .filter((o) => o.customer_email.eq(param(email, "customer_email")))
  .toSqlResult(sqlRenderer({
    dialect: "postgresql",
    parameterMode: "named",
    parameterPrefix: ":",
  }));

// result.sql === "SELECT ... WHERE orders_0.customer_email = :customer_email"
// result.params === [{ value: email, index: 1, name: "customer_email" }]
```

Built-in HetuEngine DQL support is available via `hetuRenderer()`.
Internally, SQL stringification uses the `Trino` parser dialect while preserving Hetu-oriented function mappings.

Built-in backend names are unique canonical lowercase identifiers:
`mysql`, `mariadb`, `postgresql`, `sqlite`, `trino`, `transactsql`, `redshift`,
`snowflake`, `bigquery`, `athena`, `db2`, `hive`, `flinksql`, `noql`,
`duckdb`, `hetu`.

## Function-first expression API with method sugar

Expression helpers are defined as normal functions first, and fluent methods on `ExprRef` delegate
through `.via(...)`. Free functions follow method order, so the receiver expression is the first
argument.

```ts
import { lower, replace, table, t, trim } from "./mod.ts";

const users = table("users", {
  id: t.int(),
  name: t.string(),
});

const q = users.select((u) => ({
  normalized_via_fn: lower(trim(replace(u.name, " ", "_"))),
  normalized_via_method: u.name.via(replace, " ", "_").via(trim).via(lower),
}));
```

The method-centric style still works and remains great for autocomplete:

```ts
const events = table("events", {
  id: t.int(),
  created_at: t.timestamp(),
  tags: t.string(),
});

const q = events.select((e) => ({
  id: e.id,
  created_day: e.created_at.dateTrunc("day").dateFormat("%Y-%m-%d"),
  event_hour: e.created_at.hour(),
  tag_count: e.tags.arrayLength(),
  has_sale_tag: e.tags.arrayContains("sale"),
  normalized_name: e.tags.regexReplace("[^a-zA-Z0-9_]+", "_"),
  has_uuid: e.tags.regexLike("^[0-9a-fA-F-]{36}$"),
}));
```

Common date/time methods:

- `dateTrunc`, `dateAdd`, `dateDiff`
- `dateFormat`, `dateParse`
- `toUnixTime`, `fromUnixTime`
- `year`, `month`, `day`, `hour`, `minute`, `second`

Common array methods:

- `arrayLength`, `arrayContains`, `arrayPosition`
- `arraySlice`, `arrayJoin`
- `arrayAppend`, `arrayPrepend`, `arrayConcat`, `arrayDistinct`

Common regex string methods:

- `regexLike`
- `regexReplace`
- `regexExtract`


## Watch SQL + clipboard utility

You can watch a source module, regenerate SQL on changes, and copy it to clipboard (`xclip`/`xsel`/`wl-copy`/`pbcopy`/`clip`) using `watchQuerySourceToClipboard`.

1. Create a source module that exports `query`:

```ts
// dev/query-source.ts
import { table, t } from "../mod.ts";

const users = table("users", {
  id: t.int(),
  name: t.string(),
  active: t.boolean(),
});

export const query = users
  .filter((u) => u.active.eq(true))
  .select((u) => ({
    id: u.id,
    name: u.name,
  }));
```

2. Create a watcher script:

```ts
// watch-sql.ts
import { watchQuerySourceToClipboard } from "./mod.ts";

const controller = await watchQuerySourceToClipboard({
  source: "./dev/query-source.ts",
  exportName: "query",
  rendererOptions: { dialect: "postgresql", format: "pretty" },
  isolateModules: true,
  outputFile: "./result.sql",
  clipboard: "auto",
  copyToClipboard: true,
  debounceMs: 120,
  runImmediately: true,
});

console.log("Watching ./dev/query-source.ts");
console.log("Updates: ./result.sql + clipboard");
console.log("Press Ctrl+C to stop.");

const stop = () => {
  controller.stop();
  process.exit(0);
};

process.once("SIGINT", stop);
process.once("SIGTERM", stop);
```

3. Run the watcher:

```bash
bun run watch-sql.ts
```

4. Edit `./dev/query-source.ts`. On each change, SQL is re-rendered, written to `./result.sql`, and copied to your clipboard.

`source` must export `query` as one of:

- a `Query` object, e.g. `export const query = users.select(...)`
- a function returning `Query` or SQL string, e.g. `export async function query() { ... }`
- a SQL string export, e.g. `export const query = "select 1"`

Tip: On Linux install one of `wl-copy`, `xclip`, or `xsel`.
`isolateModules` defaults to `true` to avoid stale transitive import caches while watching.

## SQL language specification

Teta language spec includes:

- math (basic arithmetic)
- string manipulation
- logical operators
- date/time functions
- type conversion + null handling
- array manipulation
- window/aggregation functions
- lateral join
- recursive CTE

Each dialect can map missing names or apply fallback rewrites through `dialect.language`.

For full function list + support matrix, see `LANGUAGE_SPEC.md`.

## Custom dialect language mapping

```ts
console.log(q.toSql(sqlRenderer({
  dialect: {
    name: "sqlite_custom",
    parserDialect: "SQLite",
    language: {
      functions: {
        CHARACTER_LENGTH: "LENGTH",
      },
      fallbacks: {
        BIT_LENGTH: "bit_length_via_length_x8",
        DATE_FORMAT: "date_format_via_strftime",
        ARRAY_LENGTH: "array_length_via_json_array_length",
        REGEXP_LIKE: "regex_like_via_regexp_function",
      },
      unsupported: ["OVERLAY"],
    },
  },
})));
```

## Tutorial

See `TUTORIAL.md` for end-to-end examples.

## License

See `LICENSE`.

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

console.log(q.toSql("postgresql", "pretty"));
```

## Dialect-neutral EDSL, dialect at render time

Keep EDSL expressions general, then choose SQL dialect only in `toSql(...)`:

```ts
console.log(q.toSql({
  dialect: {
    name: "presto",
    parserDialect: "Trino",
  },
  format: "pretty",
}));
```

Built-in HetuEngine DQL support is available via `toSql("hetu")`.
Internally, SQL stringification uses the `Trino` parser dialect while preserving Hetu-oriented function mappings.

Built-in backend names are unique canonical lowercase identifiers:
`mysql`, `mariadb`, `postgresql`, `sqlite`, `trino`, `transactsql`, `redshift`,
`snowflake`, `bigquery`, `athena`, `db2`, `hive`, `flinksql`, `noql`,
`duckdb`, `hetu`.

## Method-centric expression API

When possible, expression entry points are methods on `ExprRef`:

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
import { table, t } from "../src/edsl";

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
import { watchQuerySourceToClipboard } from "./src/edsl";

const controller = await watchQuerySourceToClipboard({
  source: "./dev/query-source.ts",
  exportName: "query",
  toSqlArgs: ["postgresql", "pretty"],
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
console.log(q.toSql({
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
}));
```

## Tutorial

See `TUTORIAL.md` for end-to-end examples.

## License

See `LICENSE`.

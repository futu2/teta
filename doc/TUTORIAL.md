# Teta Tutorial

This guide shows EDSL snippets and the SQL they generate.

Note: `table(...)` requires a schema to avoid `SELECT *` and keep column names explicit.
Generated SQL always uses auto-generated aliases (for example `users_0`, `orders_1`) and fully
qualified column references.

Keep EDSL queries dialect-neutral. Choose the dialect by passing SQL options at render time.

Most multi-stage examples below use Remeda's `pipe(...)` with named imports. Query helpers are dual-mode,
so `map(users, ...)` and `pipe(users, map(...))` are both valid, but `pipe(...)` usually reads best. This function-first style is intentional: it keeps query stages easy to compose, extract, reuse, and test as ordinary values.

All rendering examples below pass plain `SqlOptions` objects into `toSql(...)` or `toSqlResult(...)`.

## Basics

### 1) Filter + map + sort + take

```ts
import { pipe } from "remeda";
import { and, asc, desc, eq, filter, gte, take, sort, map, table, t, toSql } from "./mod.ts";

const users = table("users", {
  id: t.int(),
  name: t.string(),
  age: t.int(),
  active: t.boolean(),
});

const q = pipe(
  users,
  filter((u) => and(eq(u.active, true), gte(u.age, 18))),
  map((u) => ({ id: u.id, name: u.name, age: u.age })),
  sort((u) => [desc(u.age), asc(u.id)]),
  take(5)
);

console.log(toSql(q, { dialect: "postgresql", format: "pretty" }));
```

Generated SQL:

```sql
WITH cte_0 AS (
SELECT users_0.id, users_0.name, users_0.age, users_0.active
FROM users AS users_0
WHERE users_0.active = TRUE AND users_0.age >= 18), cte_1 AS (
SELECT cte_0_0.id, cte_0_0.name, cte_0_0.age
FROM cte_0 AS cte_0_0), cte_2 AS (
SELECT cte_1_0.id, cte_1_0.name, cte_1_0.age
FROM cte_1 AS cte_1_0
ORDER BY cte_1_0.age DESC, cte_1_0.id ASC)
SELECT cte_2_0.id, cte_2_0.name, cte_2_0.age
FROM cte_2 AS cte_2_0
LIMIT 5
```

### 2) Join + fold with group()

```ts
import { pipe } from "remeda";
import { fold, count, eq, group, join, sum, table, t, toSql } from "./mod.ts";

const users = table("users", {
  id: t.int(),
  name: t.string(),
});

const orders = table("orders", {
  order_id: t.int(),
  user_id: t.int(),
  total: t.float(),
});

const q = pipe(
  users,
  join(orders, (u, o) => eq(u.id, o.user_id), { type: "left" }),
  fold((row) => ({
    user_id: group(row.id),
    order_count: count(row.order_id),
    total_spend: sum(row.total),
  }))
);

console.log(toSql(q, { dialect: "postgresql", format: "pretty" }));
```

Generated SQL:

```sql
WITH cte_0 AS (
SELECT users_0.id, users_0.name, orders_1.order_id AS order_id, orders_1.user_id AS user_id, orders_1.total AS total
FROM users AS users_0
LEFT JOIN orders AS orders_1
ON users_0.id = orders_1.user_id)
SELECT cte_0_0.id AS user_id, COUNT(cte_0_0.order_id) AS order_count, SUM(cte_0_0.total) AS total_spend
FROM cte_0 AS cte_0_0
GROUP BY cte_0_0.id
```

### 3) String concat with template helper

```ts
import { f, map, table, t, toSql } from "./mod.ts";

const names = table("names", {
  id: t.int(),
  prefix: t.string(),
  first: t.string(),
  last: t.string(),
  suffix: t.string(),
});

const q = map(names, (name) => ({
  title: f`${name.prefix} ${name.first} ${name.last} ${name.suffix}`,
}));

console.log(toSql(q, { dialect: "postgresql", format: "pretty" }));
```

Generated SQL:

```sql
SELECT concat(names_0.prefix, ' ', names_0.first, ' ', names_0.last, ' ', names_0.suffix) AS title
FROM names AS names_0
```

## Type inference examples

For a deeper walkthrough of public EDSL types, see `doc/TYPES.md`.

### Schema inference from `table(...)`

```ts
import { table, t } from "./mod.ts";

const users = table("users", {
  id: t.int(),
  name: t.string(),
  age: t.int(),
  active: t.boolean(),
});

// users is inferred as:
// Query<{
//   id: SqlInt;
//   name: string;
//   age: SqlInt;
//   active: boolean;
// }>
```

### `map(...)` changes the row shape

```ts
import { map } from "./mod.ts";

const labels = map(users, (user) => ({
  user_id: user.id,
  label: user.name,
}));

// Query<{
//   user_id: SqlInt;
//   label: string;
// }>
```

### `join(...)` and `unnest(...)` refine types

```ts
import { eq, join, table, t, unnest } from "./mod.ts";

const orders = table("orders", {
  order_id: t.int(),
  user_id: t.int(),
  total: t.float(),
});

const leftJoined = join(
  users,
  orders,
  (user, order) => eq(user.id, order.user_id),
  { type: "left" }
);

// right-side columns become nullable on a left join
// joined rows later expose `total` as ExprRef<SqlFloat | null>

const usersWithTags = table("users", {
  id: t.int(),
  tags: t.array(t.string()),
});

const exploded = unnest(usersWithTags, (user) => user.tags, {
  value: "tag",
  ordinality: "tag_index",
});

// adds inferred columns:
// tag: string
// tag_index: SqlInt
```

## Schema-qualified tables

```ts
import { table, t } from "./mod.ts";

const users = table("analytics.users", {
  id: t.int(),
  name: t.string(),
});

const orders = table("sales.orders", {
  order_id: t.int(),
  user_id: t.int(),
});
```

Use dotted strings for schema-qualified paths. If the actual table name contains a dot, use the structured form instead: `table({ table: "schema1.table1" }, ...)`.

## More examples

Teta keeps logical stage order stable, but the rendered SQL shape depends on
`renderStrategy` and dialect features.

### Pipeline shape in `readable` mode

Use `renderStrategy: "readable"` when you want SQL that tracks the query pipeline
more literally with staged CTEs.

```ts
import { pipe } from "remeda";
import { add, filter, gt, map, table, t, toSql } from "./mod.ts";

const users = table("users", {
  id: t.int(),
  name: t.string(),
  age: t.int(),
  active: t.boolean(),
});

const q = pipe(
  users,
  map((u) => ({ ...u, age_plus_one: add(u.age, 1) })),
  filter((u) => gt(u.age_plus_one, 30)),
  map((u) => ({ id: u.id, name: u.name, age_plus_one: u.age_plus_one }))
);

console.log(toSql(q, {
  dialect: "postgresql",
  format: "pretty",
  renderStrategy: "readable",
}));
```

### Inspect lowering with `explain()`

Use `explain(query, ...)` when you want to inspect logical stages without guessing
from the final SQL string alone.

```ts
import { explain } from "./mod.ts";

const info = explain(q, {
  dialect: "postgresql",
  format: "compact",
  renderStrategy: "readable",
});

console.log(info.stages);
console.log(info.ctes);
console.log(info.sql);
```

Quick rule of thumb:

- `optimized` may fuse simple pipelines into one `SELECT`
- `readable` preserves stage boundaries as `cte_0`, `cte_1`, ...
- nested subqueries usually mean the compiler introduced a deliberate scope barrier

### Optional: Remeda for projection shaping

If you already use `remeda` in your app, it pairs nicely with Teta's object-shaped `map(...)` and `fold(...)` callbacks.

```ts
import { mapKeys, merge, omit, pick, pipe } from "remeda";
import { replace, map, table, t, upper } from "./mod.ts";

const users = table("users", {
  id: t.int(),
  name: t.string(),
  age: t.int(),
  active: t.boolean(),
});

const compact = map(users, pipe(
  pick(["id", "name", "age"] as const),
  (base) => merge(base, {
    normalized_name: upper(replace(base.name, " ", "_")),
  })
));

const publicUsers = map(users, omit(["active"] as const));

const namespacedUsers = map(users, pipe(
  pick(["id", "name"] as const),
  mapKeys((key) => "user_" + key)
));
```

Typical patterns:

- `pick(...)` for reusable column subsets
- `omit(...)` to keep most columns but drop a few
- `merge(...)` for "base shape + computed fields"
- `pipe(...)` when the reshaping reads better as a small pipeline
- `mapKeys(...)` for systematic renaming like prefixes or namespaces

### Join (auto alias)

```ts
import { pipe } from "remeda";
import { eq, join, map, table, t, toSql } from "./mod.ts";

const users = table("users", {
  id: t.int(),
  name: t.string(),
});

const orders = table("orders", {
  order_id: t.int(),
  user_id: t.int(),
  total: t.float(),
});

const q = pipe(
  users,
  join(orders, (u, o) => eq(u.id, o.user_id), { type: "left" }),
  map((row) => ({
    user_id: row.id,
    user_name: row.name,
    order_id: row.order_id,
    total: row.total,
  }))
);

console.log(toSql(q, {});
```

Use the `options` object to control join behavior, for example `{ type: "left" }` or `{ type: "right" }`.

### Lateral join

Use `join(..., { lateral: true })` when the right-hand query needs to reference columns from the left side.

```ts
import { pipe } from "remeda";
import { eq, filter, join, lit, map, table, t, toSql } from "./mod.ts";

const users = table("users", {
  id: t.int(),
  name: t.string(),
});

const orders = table("orders", {
  id: t.int(),
  user_id: t.int(),
  total: t.float(),
});

const q = pipe(
  users,
  join(
    (u) => pipe(
      orders,
      filter((o) => eq(o.user_id, u.id)),
      map((o) => ({
        order_id: o.id,
        total: o.total,
      }))
    ),
    () => lit(true),
    { lateral: true }
  )
);

console.log(toSql(q, {});
```

Note: `JOIN LATERAL` is emitted for dialects with `lateralJoinKeyword = true`.
For `sqlite`, the keyword is omitted during SQL rendering because correlated subqueries are allowed.

### Dialect configuration and parser fallback

Use a custom dialect config when runtime dialect and parser dialect differ:

```ts
import { map, table, t, toSql } from "./mod.ts";

const users = table("users", {
  id: t.int(),
  name: t.string(),
});

console.log(toSql(map(users, (u) => ({ id: u.id })), {
  dialect: {
    name: "presto",
    parserDialect: "Trino",
    features: { lateralJoinKeyword: true },
  },
  format: "pretty",
}));

console.log(toSql(users, { dialect: "sqlite" }));
console.log(toSql(users, { dialect: "hetu" }));
```

### Built-in HetuEngine DQL dialect

Teta includes a built-in HetuEngine DQL profile. Use the canonical backend name:

- `"hetu"`

This profile uses `Trino` as parser fallback for SQL stringification and applies Hetu-oriented function naming
(for example array cardinality and slice mappings).

### Language specification

Teta keeps expressions dialect-neutral in EDSL, then applies dialect behavior through the custom `dialect.language` config passed through `SqlOptions`.

Teta language spec categories:

- math (basic arithmetic)
- string manipulation (including regex)
- logical operators
- date and time functions
- type conversion + null handling
- array manipulation
- window and aggregation functions
- lateral join
- recursive CTE

The expression API is function-first, so query code stays friendly to pipelines and ordinary function composition.

```ts
import { arrayContains, arrayJoin, arrayLength, cast, dateDiff, dateFormat, dateParse, dateTrunc, regexLike, regexReplace, map, table, t, toSql, toUnixTime } from "./mod.ts";

const sessions = table("sessions", {
  id: t.int(),
  started_at: t.timestamp(),
  ended_at: t.timestamp(),
  tags: t.string(),
});

const q = map(sessions, (s) => ({
  id: s.id,
  started_day: dateTrunc(s.started_at, "day"),
  started_fmt: dateFormat(s.started_at, "%Y-%m-%d"),
  duration_sec: dateDiff(s.started_at, "second", s.ended_at),
  started_epoch: toUnixTime(s.started_at),
  parsed_start: dateParse(cast<string>(s.started_at, "TEXT"), "%Y-%m-%d %H:%M:%S"),
  has_prod: arrayContains(s.tags, "prod"),
  tag_count: arrayLength(s.tags),
  tag_label: arrayJoin(s.tags, "|"),
  normalized_tag: regexReplace(s.tags, "[^a-zA-Z0-9_]+", "_"),
  has_uuid: regexLike(s.tags, "^[0-9a-fA-F-]{36}$"),
}));

console.log(toSql(q, { dialect: "postgresql", format: "pretty" }));
```

You can customize a dialect so unsupported direct functions map to equivalents or fallbacks:

```ts
import { bitLength, dateFormat, map, table, t, toSql } from "./mod.ts";

const users = table("users", {
  id: t.int(),
  name: t.string(),
  created_at: t.timestamp(),
});

const q = map(users, (u) => ({
  id: u.id,
  created_fmt: dateFormat(u.created_at, "%Y-%m-%d"),
  bits: bitLength(u.name),
}));

console.log(toSql(q, {
  dialect: {
    name: "sqlite_custom",
    parserDialect: "SQLite",
    language: {
      functions: { CHARACTER_LENGTH: "LENGTH" },
      fallbacks: {
        BIT_LENGTH: "bit_length_via_length_x8",
        DATE_FORMAT: "date_format_via_strftime",
        DATE_DIFF: "date_diff_via_julianday",
        ARRAY_LENGTH: "array_length_via_json_array_length",
        REGEXP_LIKE: "regex_like_via_regexp_function",
      },
      unsupported: ["OVERLAY"],
    },
  },
}));
```

### Aggregate with group()

Grouping is expressed with `group(expr)` inside `fold(...)`.
There is no separate `groupBy` stage.

```ts
import { pipe } from "remeda";
import { fold, count, filter, group, gt, sum, table, t, toSql } from "./mod.ts";

const orders = table("orders", {
  id: t.int(),
  user_id: t.int(),
  total: t.float(),
});

const q = pipe(
  orders,
  filter((o) => gt(o.total, 0)),
  fold((o) => ({
    user_id: group(o.user_id),
    order_count: count(o.id),
    total_spend: sum(o.total),
  }))
);

console.log(toSql(q, {});
```

### Window function

```ts
import { asc, desc, lag, lead, ntile, over, rank, rowNumber, map, sumOver, table, t, toSql } from "./mod.ts";

const orders = table("orders", {
  id: t.int(),
  user_id: t.int(),
  total: t.float(),
  created_at: t.timestamp(),
});

const q = map(orders, (o) => ({
  id: o.id,
  user_id: o.user_id,
  running_total: sumOver(o.total, { orderBy: asc(o.created_at) }),
  rank_in_time: over(rank(), { orderBy: desc(o.created_at) }),
  row_num: over(rowNumber(), { orderBy: asc(o.created_at) }),
  prev_total: over(lag(o.total, 1, 0), {
    partitionBy: o.user_id,
    orderBy: asc(o.created_at),
  }),
  next_total: over(lead(o.total, 1, 0), {
    partitionBy: o.user_id,
    orderBy: asc(o.created_at),
  }),
  bucket: over(ntile(4), { orderBy: desc(o.total) }),
}));

console.log(toSql(q, { dialect: "postgresql", format: "pretty" }));
```

### Custom SQL functions (UDF)

```ts
import { desc, fn, over, map, table, t, toSql, windowFn } from "./mod.ts";

const users = table("users", {
  id: t.int(),
  name: t.string(),
});

const q = map(users, (u) => ({
  id: u.id,
  name_hash: fn<string>("my_hash_udf", u.name),
  score_rank: over(windowFn<number>("percent_rank"), { orderBy: desc(u.id) }),
}));

console.log(toSql(q, { dialect: "postgresql", format: "pretty" }));
```

### SQL92 string helpers

```ts
import { charLength, lower, position, regexExtract, regexLike, regexReplace, map, substring, table, t, toSql, trim, upper } from "./mod.ts";

const users = table("users", {
  id: t.int(),
  name: t.string(),
});

const q = map(users, (u) => ({
  id: u.id,
  name_lower: lower(u.name),
  name_upper: upper(u.name),
  name_trim: trim(u.name),
  name_prefix: substring(u.name, 1, 3),
  name_pos: position(u.name, "a"),
  name_len: charLength(u.name),
  name_clean: regexReplace(u.name, "\\s+", "_"),
  has_digits: regexLike(u.name, ".*\\d+.*"),
  first_digits: regexExtract(u.name, "(\\d+)", 1),
}));

console.log(toSql(q, { dialect: "postgresql", format: "pretty" }));
```

### Array helpers

```ts
import { arrayAppend, arrayContains, arrayJoin, arrayLength, arrayPosition, arraySlice, map, table, t, toSql } from "./mod.ts";

const sessions = table("sessions", {
  id: t.int(),
  tags: t.string(),
});

const q = map(sessions, (s) => ({
  id: s.id,
  tag_count: arrayLength(s.tags),
  has_prod: arrayContains(s.tags, "prod"),
  prod_pos: arrayPosition(s.tags, "prod"),
  first_two: arraySlice(s.tags, 1, 2),
  tag_csv: arrayJoin(s.tags, ","),
  with_debug: arrayAppend(s.tags, "debug"),
}));

console.log(toSql(q, { dialect: "postgresql", format: "pretty" }));
```

### IN operator

```ts
import { pipe } from "remeda";
import { filter, isIn, map, table, t } from "./mod.ts";

const users = table("users", {
  id: t.int(),
  status: t.string(),
});

const q = pipe(
  users,
  filter((u) => isIn(u.status, ["active", "trial", "paused"])),
  map((u) => ({ id: u.id, status: u.status }))
);
```

### SQL standard date/time helpers

```ts
import { currentDate, currentTimestamp, dateAdd, dateDiff, dateFormat, dateLiteral, dateParse, dateTrunc, month, map, table, t, timestampLiteral, toUnixTime, year } from "./mod.ts";

const posts = table("posts", {
  id: t.int(),
  published_on: t.date(),
  created_at: t.timestamp(),
  event_text: t.string(),
});

const q = map(posts, (p) => ({
  today: currentDate(),
  now: currentTimestamp(),
  go_live: dateLiteral("2024-02-03"),
  pinned_at: timestampLiteral("2024-02-03 12:34:56"),
  created_day: dateTrunc(p.created_at, "day"),
  created_fmt: dateFormat(p.created_at, "%Y-%m-%d"),
  next_week: dateAdd(p.created_at, "day", 7),
  age_days: dateDiff(p.published_on, "day", currentDate()),
  created_epoch: toUnixTime(p.created_at),
  parsed_event_ts: dateParse(p.event_text, "%Y-%m-%d %H:%M:%S"),
  created_year: year(p.created_at),
  created_month: month(p.created_at),
}));
```

### CAST helpers

Use `cast(expr, type)` to emit `CAST(expr AS type)`.
Use `toDate(expr)` as a convenience when you want `CAST(expr AS DATE)`.

```ts
import { cast, map, table, t, toDate } from "./mod.ts";

const orders = table("orders", {
  id: t.int(),
  total: t.float(),
  created_at: t.timestamp(),
});

const q = map(orders, (o) => ({
  total_text: cast<string>(o.total, "TEXT"),
  created_date: toDate(o.created_at),
}));
```

```ts
import { pipe } from "remeda";
import { cast, filter, gt, map, table, t } from "./mod.ts";

const users = table("users", {
  id: t.int(),
  age_text: t.string(),
  created_at: t.timestamp(),
});

const q = pipe(
  users,
  filter((u) => gt(cast<number>(u.age_text, "INTEGER"), 18)),
  map((u) => ({
    id: u.id,
    age_int: cast<number>(u.age_text, "INTEGER"),
    created_day: cast<string>(u.created_at, "DATE"),
  }))
);
```

### CASE WHEN

```ts
import { caseWhen, lt, map, table, t, when } from "./mod.ts";

const users = table("users", {
  id: t.int(),
  age: t.int(),
});

const q = map(users, (u) => ({
  id: u.id,
  age_group: caseWhen([
    when(lt(u.age, 18), "minor"),
    when(lt(u.age, 65), "adult"),
  ], "senior"),
}));
```

### UNION / UNION ALL

```ts
import { pipe } from "remeda";
import { eq, filter, map, table, t, unionAll } from "./mod.ts";

const activeUsers = pipe(
  table("users", {
    id: t.int(),
    name: t.string(),
    active: t.boolean(),
  }),
  filter((u) => eq(u.active, true)),
  map((u) => ({ id: u.id, name: u.name }))
);

const inactiveUsers = pipe(
  table("users", {
    id: t.int(),
    name: t.string(),
    active: t.boolean(),
  }),
  filter((u) => eq(u.active, false)),
  map((u) => ({ id: u.id, name: u.name }))
);

const allUsers = unionAll(activeUsers, inactiveUsers);
```

### Recursive loop (WITH RECURSIVE)

```ts
import { pick, pipe } from "remeda";
import { eq, filter, isNull, join, loop, map, table, t } from "./mod.ts";

const treeCols = ["id", "name", "manager_id"] as const;

const employees = table("employees", {
  id: t.int(),
  name: t.string(),
  manager_id: t.int(),
});

const base = pipe(
  employees,
  filter((e) => isNull(e.manager_id)),
  map(pick(treeCols))
);

const orgTree = pipe(
  base,
  loop((self) => pipe(
    employees,
    join(self, (e, s) => eq(e.manager_id, s.id)),
    map(pick(treeCols))
  ))
);

const q = map(orgTree, pick(["id", "name"] as const));
```

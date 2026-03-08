# Teta Tutorial

This guide shows EDSL snippets and the SQL they generate.

Note: `table(...)` requires a schema to avoid `SELECT *` and keep column names explicit.
Generated SQL always uses auto-generated aliases (e.g., `users_0`, `orders_1`) and fully
qualified column references.

Keep EDSL queries dialect-neutral. Choose dialect by creating a renderer at render time.

All rendering examples below assume `sqlRenderer` is imported alongside the EDSL helpers.

## Basics

### 1) Filter + select + order + limit

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
  .select((u) => ({ id: u.id, name: u.name, age: u.age }))
  .orderBy((u) => [u.age.desc(), u.id.asc()])
  .limit(5);

console.log(q.toSql(sqlRenderer({ dialect: "postgresql", format: "pretty" })).sql);
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

### 2) Join + aggregate with group()

```ts
import { table, t } from "./src/edsl";

const users = table("users", {
  id: t.int(),
  name: t.string(),
});

const orders = table("orders", {
  order_id: t.int(),
  user_id: t.int(),
  total: t.float(),
});

const q = users
  .leftJoin(orders, (u, o) => u.id.eq(o.user_id))
  .aggregate((u) => ({
    user_id: u.id.group(),
    order_count: u.order_id.count(),
    total_spend: u.total.sum(),
  }));

console.log(q.toSql(sqlRenderer({ dialect: "postgresql", format: "pretty" })).sql);
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
import { table, t, f } from "./src/edsl";

const names = table("names", {
  id: t.int(),
  prefix: t.string(),
  first: t.string(),
  last: t.string(),
  suffix: t.string(),
});

const q = names.select((t) => ({
  title: f`${t.prefix} ${t.first} ${t.last} ${t.suffix}`,
}));

console.log(q.toSql(sqlRenderer({ dialect: "postgresql", format: "pretty" })).sql);
```

Generated SQL:

```sql
SELECT concat(names_0.prefix, ' ', names_0.first, ' ', names_0.last, ' ', names_0.suffix) AS title
FROM names AS names_0
```

## Schema-qualified tables

```ts
import { table, t } from "./src/edsl";

const users = table("analytics.users", {
  id: t.int(),
  name: t.string(),
});

const orders = table("sales.orders", {
  order_id: t.int(),
  user_id: t.int(),
});
```

## More examples

Each chained step is compiled into a CTE, so changing the order of operations is safe and predictable.

### Pipeline steps (CTE per stage)

```ts
import { table, t } from "./src/edsl";

const users = table("users", {
  id: t.int(),
  name: t.string(),
  age: t.int(),
  active: t.boolean(),
});

const q = users
  .select((u) => ({ ...u, age_plus_one: u.age.add(1) }))
  .filter((u) => u.age_plus_one.gt(30))
  .select((u) => ({ id: u.id, name: u.name, age_plus_one: u.age_plus_one }));

console.log(q.toSql(sqlRenderer()).sql);
```

### Join (auto alias)

```ts
import { table, t } from "./src/edsl";

const users = table("users", {
  id: t.int(),
  name: t.string(),
});

const orders = table("orders", {
  order_id: t.int(),
  user_id: t.int(),
  total: t.float(),
});

const q = users
  .leftJoin(orders, (u, o) => u.id.eq(o.user_id))
  .select((u) => ({
    user_id: u.id,
    user_name: u.name,
    order_id: u.order_id,
    total: u.total,
  }));

console.log(q.toSql(sqlRenderer()).sql);
```

You can pass a join type as the third argument to `join`, for example `"left"` or `"right"`.
Shortcuts are available: `innerJoin`, `leftJoin`, `rightJoin`, `fullJoin`.

### Lateral join

Use `lateralJoin` when the right-hand query needs to reference columns from the left side.

```ts
import { table, t, lit } from "./src/edsl";

const users = table("users", {
  id: t.int(),
  name: t.string(),
});

const orders = table("orders", {
  id: t.int(),
  user_id: t.int(),
  total: t.float(),
});

const q = users.lateralJoin(
  (u) =>
    orders
      .filter((o) => o.user_id.eq(u.id))
      .select((o) => ({
        order_id: o.id,
        total: o.total,
      })),
  () => lit(true)
);

console.log(q.toSql(sqlRenderer()).sql);
```

Note: `JOIN LATERAL` is emitted for dialects with `lateralJoinKeyword=true`.
For `sqlite`, the keyword is omitted during SQL rendering because correlated subqueries are allowed.

### Dialect configuration and parser fallback

Use a custom dialect config when runtime dialect and parser dialect differ:

```ts
import { table, t } from "./src/edsl";

const users = table("users", {
  id: t.int(),
  name: t.string(),
});

console.log(users.select((u) => ({ id: u.id })).toSql(sqlRenderer({
  dialect: {
    name: "presto",
    parserDialect: "Trino",
    features: { lateralJoinKeyword: true },
  },
  format: "pretty",
})).sql);

console.log(users.toSql(sqlRenderer({ dialect: "sqlite" })).sql);
console.log(users.toSql(sqlRenderer({ dialect: "hetu" })).sql);
```

### Built-in HetuEngine DQL dialect

Teta includes a built-in HetuEngine DQL profile. Use the canonical backend name:

- `"hetu"`

This profile uses `Trino` as parser fallback for SQL stringification and applies Hetu-oriented function naming (for example array cardinality/slice mappings).

### Language specification

Teta keeps expressions dialect-neutral in EDSL, then applies dialect behavior through the renderer's `dialect.language` config.

Teta language spec categories:

- math (basic arithmetic)
- string manipulation (including regex)
- logical operators
- date and time functions
- type conversion + null handling
- array manipulation
- window/aggregation functions
- lateral join
- recursive CTE

Method-centric EDSL is preferred when possible. Date/time and array operations are exposed as instance methods:

```ts
import { table, t } from "./src/edsl";

const sessions = table("sessions", {
  id: t.int(),
  started_at: t.timestamp(),
  ended_at: t.timestamp(),
  tags: t.string(),
});

const q = sessions.select((s) => ({
  id: s.id,
  started_day: s.started_at.dateTrunc("day"),
  started_fmt: s.started_at.dateFormat("%Y-%m-%d"),
  duration_sec: s.started_at.dateDiff("second", s.ended_at),
  started_epoch: s.started_at.toUnixTime(),
  parsed_start: s.started_at.cast<string>("TEXT").dateParse("%Y-%m-%d %H:%M:%S"),
  has_prod: s.tags.arrayContains("prod"),
  tag_count: s.tags.arrayLength(),
  tag_label: s.tags.arrayJoin("|"),
  normalized_tag: s.tags.regexReplace("[^a-zA-Z0-9_]+", "_"),
  has_uuid: s.tags.regexLike("^[0-9a-fA-F-]{36}$"),
}));
```

You can customize a dialect so unsupported direct functions map to equivalents/fallbacks:

```ts
import { table, t } from "./src/edsl";

const users = table("users", {
  id: t.int(),
  name: t.string(),
  created_at: t.timestamp(),
});

const q = users.select((u) => ({
  id: u.id,
  created_fmt: u.created_at.dateFormat("%Y-%m-%d"),
  bits: u.name.bitLength(),
}));

console.log(q.toSql(sqlRenderer({
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
})).sql);
```

### Aggregate with group()

Grouping is expressed by calling `.group()` on the grouping key inside `aggregate(...)`.
There is no separate `groupBy` step.

```ts
import { table, t } from "./src/edsl";

const orders = table("orders", {
  id: t.int(),
  user_id: t.int(),
  total: t.float(),
});

const q = orders
  .filter((o) => o.total.gt(0))
  .aggregate((o) => ({
    user_id: o.user_id.group(),
    order_count: o.id.count(),
    total_spend: o.total.sum(),
  }));

console.log(q.toSql(sqlRenderer()).sql);
```

### Window function

```ts
import { table, t } from "./src/edsl";

const orders = table("orders", {
  id: t.int(),
  user_id: t.int(),
  total: t.float(),
  created_at: t.timestamp(),
});

const q = orders.select((o) => ({
  id: o.id,
  user_id: o.user_id,
  running_total: o.total.sumOver({ orderBy: o.created_at.asc() }),
  rank_in_time: o.total.rank().over({ orderBy: o.created_at.desc() }),
  prev_total: o.total.lag(1, 0).over({
    partitionBy: o.user_id,
    orderBy: o.created_at.asc(),
  }),
  next_total: o.total.lead(1, 0).over({
    partitionBy: o.user_id,
    orderBy: o.created_at.asc(),
  }),
  bucket: o.total.ntile(4).over({ orderBy: o.total.desc() }),
}));

console.log(q.toSql(sqlRenderer({ dialect: "postgresql", format: "pretty" })).sql);
```

### Custom SQL functions (UDF)

```ts
import { table, t, fn, windowFn } from "./src/edsl";

const users = table("users", {
  id: t.int(),
  name: t.string(),
});

const q = users.select((u) => ({
  id: u.id,
  name_hash: fn<string>("my_hash_udf", u.name),
  score_rank: windowFn<number>("percent_rank").over({ orderBy: u.id.desc() }),
}));
```

### SQL92 string helpers

```ts
import { table, t } from "./src/edsl";

const users = table("users", {
  id: t.int(),
  name: t.string(),
});

const q = users.select((u) => ({
  id: u.id,
  name_lower: u.name.lower(),
  name_upper: u.name.upper(),
  name_trim: u.name.trim(),
  name_prefix: u.name.substring(1, 3),
  name_pos: u.name.position("a"),
  name_len: u.name.charLength(),
  name_clean: u.name.regexReplace("\\s+", "_"),
  has_digits: u.name.regexLike(".*\\d+.*"),
  first_digits: u.name.regexExtract("(\\d+)", 1),
}));
```

### Array helpers

```ts
import { table, t } from "./src/edsl";

const sessions = table("sessions", {
  id: t.int(),
  tags: t.string(),
});

const q = sessions.select((s) => ({
  id: s.id,
  tag_count: s.tags.arrayLength(),
  has_prod: s.tags.arrayContains("prod"),
  prod_pos: s.tags.arrayPosition("prod"),
  first_two: s.tags.arraySlice(1, 2),
  tag_csv: s.tags.arrayJoin(","),
  with_debug: s.tags.arrayAppend("debug"),
}));
```

### IN operator

```ts
import { table, t } from "./src/edsl";

const users = table("users", {
  id: t.int(),
  status: t.string(),
});

const q = users
  .filter((u) => u.status.in(["active", "trial", "paused"]))
  .select((u) => ({ id: u.id, status: u.status }));
```

### SQL standard date/time helpers

```ts
import { table, t, currentDate, currentTimestamp, dateLiteral, timestampLiteral } from "./src/edsl";

const posts = table("posts", {
  id: t.int(),
  published_on: t.date(),
  created_at: t.timestamp(),
  event_text: t.string(),
});

const q = posts.select((p) => ({
  today: currentDate(),
  now: currentTimestamp(),
  go_live: dateLiteral("2024-02-03"),
  pinned_at: timestampLiteral("2024-02-03 12:34:56"),
  created_day: p.created_at.dateTrunc("day"),
  created_fmt: p.created_at.dateFormat("%Y-%m-%d"),
  next_week: p.created_at.dateAdd("day", 7),
  age_days: p.published_on.dateDiff("day", currentDate()),
  created_epoch: p.created_at.toUnixTime(),
  parsed_event_ts: p.event_text.dateParse("%Y-%m-%d %H:%M:%S"),
  created_year: p.created_at.year(),
  created_month: p.created_at.month(),
}));
```

### CAST helpers

Use `cast<T>(type)` on any expression to emit `CAST(expr AS type)`.
If you already know the type you want, add a generic to keep the result typed.
For timestamps, `toDate()` is a convenience for `CAST(ts AS DATE)`.

```ts
import { table, t } from "./src/edsl";

const orders = table("orders", {
  id: t.int(),
  total: t.float(),
  created_at: t.timestamp(),
});

const q = orders.select((o) => ({
  total_text: o.total.cast<string>("TEXT"),
  created_date: o.created_at.toDate(),
}));
```

```ts
import { table, t } from "./src/edsl";

const users = table("users", {
  id: t.int(),
  age_text: t.string(),
  created_at: t.timestamp(),
});

const q = users
  .filter((u) => u.age_text.cast<number>("INTEGER").gt(18))
  .select((u) => ({
    id: u.id,
    age_int: u.age_text.cast<number>("INTEGER"),
    created_day: u.created_at.cast<string>("DATE"),
  }));
```

### CASE WHEN

```ts
import { table, t, when } from "./src/edsl";

const users = table("users", {
  id: t.int(),
  age: t.int(),
});

const q = users.select((u) => ({
  id: u.id,
  age_group: when(u.age.lt(18), "minor")
    .when(u.age.lt(65), "adult")
    .else("senior"),
}));
```

### UNION / UNION ALL

```ts
import { table, t } from "./src/edsl";

const activeUsers = table("users", {
  id: t.int(),
  name: t.string(),
  active: t.boolean(),
}).filter((u) => u.active.eq(true))
  .select((u) => ({ id: u.id, name: u.name }));

const inactiveUsers = table("users", {
  id: t.int(),
  name: t.string(),
  active: t.boolean(),
}).filter((u) => u.active.eq(false))
  .select((u) => ({ id: u.id, name: u.name }));

const allUsers = activeUsers.unionAll(inactiveUsers);
```

### Recursive loop (WITH RECURSIVE)

```ts
import { loop, table, t } from "./src/edsl";

const employees = table("employees", {
  id: t.int(),
  name: t.string(),
  manager_id: t.int(),
});

const orgTree = loop(
  employees
    .filter((e) => e.manager_id.isNull())
    .select((e) => ({ id: e.id, name: e.name, manager_id: e.manager_id })),
  (self) =>
    employees
      .join(self, (e, s) => e.manager_id.eq(s.id))
      .select((e) => ({ id: e.id, name: e.name, manager_id: e.manager_id }))
);

const q = orgTree.select((o) => ({ id: o.id, name: o.name }));
```

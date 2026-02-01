# teta

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

This project was created using `bun init` in bun v1.3.6. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.

## EDSL example

Note: to avoid `SELECT *`, provide a schema when calling `table(...)`. Without a schema, any step that needs implicit “select all” will throw because column names are unknown.

```ts
import { table, t } from "./src/edsl";

const users = table("users", {
  id: t.number(),
  name: t.string(),
  age: t.number(),
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

console.log(q.toSql("Postgresql", "pretty"));
```

### Schema-qualified tables

```ts
import { table, t } from "./src/edsl";

const users = table("analytics.users", {
  id: t.number(),
  name: t.string(),
});

const orders = table(
  "orders",
  {
    order_id: t.number(),
    user_id: t.number(),
  },
  { schema: "sales" }
);
```

## Tutorial

This section shows EDSL snippets and the SQL they generate.

### 1) Filter + select + order + limit

```ts
import { table, t } from "./src/edsl";

const users = table("users", {
  id: t.number(),
  name: t.string(),
  age: t.number(),
  active: t.boolean(),
});

const q = users
  .filter((u) => u.active.eq(true).and(u.age.gte(18)))
  .select((u) => ({ id: u.id, name: u.name, age: u.age }))
  .orderBy((u) => [u.age.desc(), u.id.asc()])
  .limit(5);

console.log(q.toSql("postgresql", "pretty"));
```

Generated SQL:

```sql
WITH cte_0 AS (
SELECT id, name, age, active
FROM users
WHERE active = TRUE AND age >= 18), cte_1 AS (
SELECT id, name, age
FROM cte_0), cte_2 AS (
SELECT id, name, age
FROM cte_1
ORDER BY age DESC, id ASC)
SELECT id, name, age
FROM cte_2
LIMIT 5
```

### 2) Join + aggregate with group()

```ts
import { table, t, count, group, sum } from "./src/edsl";

const users = table("users", {
  id: t.number(),
  name: t.string(),
});

const orders = table("orders", {
  order_id: t.number(),
  user_id: t.number(),
  total: t.number(),
});

const q = users
  .leftJoin(orders, (u, o) => u.id.eq(o.user_id))
  .aggregate((u) => ({
    user_id: group(u.id),
    order_count: count(),
    total_spend: sum(u.total),
  }));

console.log(q.toSql("postgresql", "pretty"));
```

Generated SQL:

```sql
WITH cte_0 AS (
SELECT id, name, orders_j1.order_id AS order_id, orders_j1.user_id AS user_id, orders_j1.total AS total
FROM users
LEFT JOIN orders AS orders_j1
ON id = orders_j1.user_id)
SELECT id AS user_id, COUNT(1) AS order_count, SUM(total) AS total_spend
FROM cte_0
GROUP BY id
```

### 3) String concat with template helper

```ts
import { table, t, f } from "./src/edsl";

const names = table("names", {
  id: t.number(),
  prefix: t.string(),
  first: t.string(),
  last: t.string(),
  suffix: t.string(),
});

const q = names.select((t) => ({
  title: f`${t.prefix} ${t.first} ${t.last} ${t.suffix}`,
}));

console.log(q.toSql("postgresql", "pretty"));
```

Generated SQL:

```sql
SELECT concat(prefix, ' ', first, ' ', last, ' ', suffix) AS title
FROM names
```

## More examples

Each chained step is compiled into a CTE, so changing the order of operations is safe and predictable.

### Pipeline steps (CTE per stage)

```ts
import { table, t } from "./src/edsl";

const users = table("users", {
  id: t.number(),
  name: t.string(),
  age: t.number(),
  active: t.boolean(),
});

const q = users
  .select((u) => ({ ...u, age_plus_one: u.age.add(1) }))
  .filter((u) => u.age_plus_one.gt(30))
  .select((u) => ({ id: u.id, name: u.name, age_plus_one: u.age_plus_one }));

console.log(q.toSql());
```

### Join (auto alias)

```ts
import { table, t } from "./src/edsl";

const users = table("users", {
  id: t.number(),
  name: t.string(),
});

const orders = table("orders", {
  order_id: t.number(),
  user_id: t.number(),
  total: t.number(),
});

const q = users
  .leftJoin(orders, (u, o) => u.id.eq(o.user_id))
  .select((u) => ({
    user_id: u.id,
    user_name: u.name,
    order_id: u.order_id,
    total: u.total,
  }));

console.log(q.toSql());
```

You can pass a join type as the third argument to `join`, for example `"left"` or `"right"`.
Shortcuts are available: `innerJoin`, `leftJoin`, `rightJoin`, `fullJoin`.

### Aggregate with group()

Grouping is expressed by wrapping the grouping key in `group(...)` inside `aggregate(...)`.
There is no separate `groupBy` step.

```ts
import { table, t, count, group, sum } from "./src/edsl";

const orders = table("orders", {
  id: t.number(),
  user_id: t.number(),
  total: t.number(),
});

const q = orders
  .filter((o) => o.total.gt(0))
  .aggregate((o) => ({
    user_id: group(o.user_id),
    order_count: count(),
    total_spend: sum(o.total),
  }));

console.log(q.toSql());
```

### Window function

```ts
import { table, t, rank } from "./src/edsl";

const users = table("users", {
  id: t.number(),
  name: t.string(),
  age: t.number(),
});

const q = users.select((u) => ({
  id: u.id,
  name: u.name,
  age_rank: rank().over({ orderBy: u.age.desc() }),
}));

console.log(q.toSql("Postgresql", "pretty"));
```

### String concat

```ts
import { table, t, concat, f } from "./src/edsl";

const users = table("users", {
  id: t.number(),
  first_name: t.string(),
  last_name: t.string(),
});

const q = users.select((u) => ({
  id: u.id,
  full_name: concat(u.first_name, " ", u.last_name),
  label: f`user:${u.id}-${u.first_name}`,
}));
```

### Custom SQL functions (UDF)

```ts
import { table, t, fn, windowFn } from "./src/edsl";

const users = table("users", {
  id: t.number(),
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
import { table, t, lower, upper, trim, substring, position, charLength } from "./src/edsl";

const users = table("users", {
  id: t.number(),
  name: t.string(),
});

const q = users.select((u) => ({
  id: u.id,
  name_lower: lower(u.name),
  name_upper: upper(u.name),
  name_trim: trim(u.name),
  name_prefix: substring(u.name, 1, 3),
  name_pos: position("a", u.name),
  name_len: charLength(u.name),
}));
```

### UNION / UNION ALL

```ts
import { table, t } from "./src/edsl";

const activeUsers = table("users", {
  id: t.number(),
  name: t.string(),
  active: t.boolean(),
}).filter((u) => u.active.eq(true))
  .select((u) => ({ id: u.id, name: u.name }));

const inactiveUsers = table("users", {
  id: t.number(),
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
  id: t.number(),
  name: t.string(),
  manager_id: t.number(),
});

const orgTree = loop(
  {
    id: t.number(),
    name: t.string(),
    manager_id: t.number(),
  },
  (self) => ({
    base: employees
      .filter((e) => e.manager_id.isNull())
      .select((e) => ({ id: e.id, name: e.name, manager_id: e.manager_id })),
    step: employees
      .join(self, (e, s) => e.manager_id.eq(s.id))
      .select((e) => ({ id: e.id, name: e.name, manager_id: e.manager_id })),
  })
);

const q = orgTree.select((o) => ({ id: o.id, name: o.name }));
```

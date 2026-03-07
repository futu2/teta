export const USER_PIPELINE_POSTGRES_COMPACT =
  "WITH cte_0 AS (SELECT users_0.id, users_0.name, users_0.age, users_0.active FROM users AS users_0 WHERE users_0.active = TRUE AND users_0.age >= 18), cte_1 AS (SELECT cte_0_0.id, coalesce(replace(cte_0_0.name, ' ', '_'), 'unknown') AS name, cte_0_0.age FROM cte_0 AS cte_0_0), cte_2 AS (SELECT cte_1_0.id, cte_1_0.name, cte_1_0.age FROM cte_1 AS cte_1_0 ORDER BY cte_1_0.name ASC, cte_1_0.id DESC) SELECT cte_2_0.id, cte_2_0.name, cte_2_0.age FROM cte_2 AS cte_2_0 LIMIT 20";

export const USER_PIPELINE_POSTGRES_PRETTY = `WITH
  cte_0 AS (
    SELECT users_0.id, users_0.name, users_0.age, users_0.active
    FROM users AS users_0
    WHERE users_0.active = TRUE AND users_0.age >= 18),
  cte_1 AS (
    SELECT cte_0_0.id, coalesce(replace(cte_0_0.name, ' ', '_'), 'unknown') AS name, cte_0_0.age
    FROM cte_0 AS cte_0_0),
  cte_2 AS (
    SELECT cte_1_0.id, cte_1_0.name, cte_1_0.age
    FROM cte_1 AS cte_1_0
    ORDER BY cte_1_0.name ASC, cte_1_0.id DESC)
SELECT cte_2_0.id, cte_2_0.name, cte_2_0.age
FROM cte_2 AS cte_2_0
LIMIT 20`;

export const USERS_NAME_LENGTH_SQLITE_COMPACT =
  "SELECT length(users_0.name) AS len, length(users_0.name) * 8 AS bit_len FROM users AS users_0";

export const USERS_ORDERS_LEFT_JOIN_AGG_POSTGRES_COMPACT =
  "WITH cte_0 AS (SELECT users_0.id, users_0.name, orders_1.order_id AS order_id, orders_1.user_id AS user_id, orders_1.total AS total FROM users AS users_0 LEFT JOIN orders AS orders_1 ON users_0.id = orders_1.user_id) SELECT cte_0_0.id AS user_id, COUNT(cte_0_0.order_id) AS order_count, SUM(cte_0_0.total) AS total_spend FROM cte_0 AS cte_0_0 GROUP BY cte_0_0.id";

export const ORDERS_GROUPED_TOTALS_POSTGRES_COMPACT =
  "WITH cte_0 AS (SELECT orders_0.order_id, orders_0.user_id, orders_0.total FROM orders AS orders_0 WHERE orders_0.total > 0) SELECT cte_0_0.user_id, COUNT(cte_0_0.order_id) AS order_count, SUM(cte_0_0.total) AS total_spend FROM cte_0 AS cte_0_0 GROUP BY cte_0_0.user_id";

export const DIALECT_MATRIX_SQL = {
  postgresql:
    "SELECT char_length(users_0.name) AS len, bit_length(users_0.name) AS bit_len, to_char(users_0.created_at, '%Y-%m-%d') AS fmt FROM users AS users_0",
  mysql:
    "SELECT character_length(users_0.name) AS len, bit_length(users_0.name) AS bit_len, date_format(users_0.created_at, '%Y-%m-%d') AS fmt FROM users AS users_0",
  duckdb:
    "SELECT character_length(users_0.name) AS len, bit_length(users_0.name) AS bit_len, strftime(users_0.created_at, '%Y-%m-%d') AS fmt FROM users AS users_0",
  sqlite:
    "SELECT length(users_0.name) AS len, length(users_0.name) * 8 AS bit_len, strftime('%Y-%m-%d', users_0.created_at) AS fmt FROM users AS users_0",
} as const;

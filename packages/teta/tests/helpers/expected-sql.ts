export const USER_PIPELINE_POSTGRES_COMPACT =
  "SELECT users_0.id, coalesce(replace(users_0.name, ' ', '_'), 'unknown') AS name, users_0.age FROM users AS users_0 WHERE users_0.active = TRUE AND users_0.age >= 18 ORDER BY name ASC, id DESC LIMIT 20";

export const USER_PIPELINE_POSTGRES_PRETTY = `SELECT users_0.id, coalesce(replace(users_0.name, ' ', '_'), 'unknown') AS name, users_0.age
FROM users AS users_0
WHERE users_0.active = TRUE AND users_0.age >= 18
ORDER BY name ASC, id DESC
LIMIT 20`;

export const USERS_NAME_LENGTH_SQLITE_COMPACT =
  "SELECT length(users_0.name) AS len, length(users_0.name) * 8 AS bit_len FROM users AS users_0";

export const USERS_ORDERS_LEFT_JOIN_AGG_POSTGRES_COMPACT =
  "SELECT users_0.id AS user_id, COUNT(orders_1.order_id) AS order_count, SUM(orders_1.total) AS total_spend FROM users AS users_0 LEFT JOIN orders AS orders_1 ON users_0.id = orders_1.user_id GROUP BY users_0.id";

export const ORDERS_GROUPED_TOTALS_POSTGRES_COMPACT =
  "SELECT orders_0.user_id, COUNT(orders_0.order_id) AS order_count, SUM(orders_0.total) AS total_spend FROM orders AS orders_0 WHERE orders_0.total > 0 GROUP BY orders_0.user_id";

export const ORDERS_GROUPED_ARRAY_AGG_POSTGRES_COMPACT =
  "SELECT orders_0.user_id, ARRAY_AGG(orders_0.total) AS totals FROM orders AS orders_0 GROUP BY orders_0.user_id";

export const ORDERS_GROUPED_ARRAY_AGG_HETU_COMPACT =
  "SELECT orders_0.user_id, ARRAY_AGG(orders_0.total) AS totals FROM orders AS orders_0 GROUP BY orders_0.user_id";

export const ORDERS_GROUPED_ARRAY_AGG_HIVE_COMPACT =
  "SELECT orders_0.user_id, COLLECT_LIST(orders_0.total) AS totals FROM orders AS orders_0 GROUP BY orders_0.user_id";

export const ORDERS_GROUPED_ARRAY_AGG_SQLITE_COMPACT =
  "SELECT orders_0.user_id, JSON_GROUP_ARRAY(orders_0.total) AS totals FROM orders AS orders_0 GROUP BY orders_0.user_id";

export const PARAMETERIZED_USERS_FILTER_POSTGRES_COMPACT =
  "SELECT users_0.id FROM users AS users_0 WHERE users_0.id = :p1 AND users_0.name = :p2";

export const PARAMETERIZED_EXPR_POSTGRES_COMPACT = ":p1 + :p2";

export const EXPLICIT_PARAM_USERS_FILTER_POSTGRES_COMPACT =
  "SELECT users_0.id FROM users AS users_0 WHERE users_0.name = $1";

export const EXPLICIT_PARAM_EXPR_POSTGRES_COMPACT = "$1 = $2";

export const EMPLOYEES_SELF_JOIN_POSTGRES_COMPACT =
  "SELECT employees_0.id AS employee_id, employees_0.name AS employee_name, employees_1.name AS manager_name FROM employees AS employees_0 INNER JOIN employees AS employees_1 ON employees_0.manager_id = employees_1.id";

export const USERS_ORDERS_LEFT_JOIN_SELECT_POSTGRES_COMPACT =
  "SELECT users_0.id AS user_id, orders_1.total FROM users AS users_0 LEFT JOIN orders AS orders_1 ON users_0.id = orders_1.user_id";

export const USERS_SELECT_FILTER_POSTGRES_COMPACT =
  "SELECT replace(users_0.name, ' ', '_') AS normalized_name FROM users AS users_0 WHERE replace(users_0.name, ' ', '_') = 'Ada_Lovelace'";

export const ANALYTICS_EVENTS_SELECT_POSTGRES_COMPACT =
  "SELECT events_0.id FROM analytics.events AS events_0";

export const ORDERS_GROUPED_TOTALS_HAVING_POSTGRES_COMPACT =
  "SELECT orders_0.user_id, SUM(orders_0.total) AS total_spend FROM orders AS orders_0 GROUP BY orders_0.user_id HAVING SUM(orders_0.total) > 100";

export const ORDERS_GROUPED_TOTALS_WHERE_HAVING_POSTGRES_COMPACT =
  "SELECT orders_0.user_id, SUM(orders_0.total) AS total_spend FROM orders AS orders_0 WHERE orders_0.user_id > 10 GROUP BY orders_0.user_id HAVING SUM(orders_0.total) > 100";
export const DIALECT_MATRIX_SQL = {
  postgresql:
    "SELECT char_length(users_0.name) AS len, bit_length(users_0.name) AS bit_len, to_char(users_0.created_at, 'YYYY-MM-DD') AS fmt FROM users AS users_0",
  mysql:
    "SELECT character_length(users_0.name) AS len, bit_length(users_0.name) AS bit_len, date_format(users_0.created_at, '%Y-%m-%d') AS fmt FROM users AS users_0",
  duckdb:
    "SELECT character_length(users_0.name) AS len, bit_length(users_0.name) AS bit_len, strftime(users_0.created_at, '%Y-%m-%d') AS fmt FROM users AS users_0",
  sqlite:
    "SELECT length(users_0.name) AS len, length(users_0.name) * 8 AS bit_len, strftime('%Y-%m-%d', users_0.created_at) AS fmt FROM users AS users_0",
} as const;

export const ORDERS_ROW_NUMBER_QUALIFY_BIGQUERY_COMPACT =
  "SELECT orders_0.order_id, row_number() OVER (ORDER BY orders_0.order_id ASC) AS row_num FROM orders AS orders_0 QUALIFY row_number() OVER (ORDER BY orders_0.order_id ASC) = 1";

export const ORDERS_ROW_NUMBER_FILTER_POSTGRES_COMPACT =
  "SELECT t_0.order_id AS order_id, t_0.row_num AS row_num FROM (SELECT orders_0.order_id, row_number() OVER (ORDER BY orders_0.order_id ASC) AS row_num FROM orders AS orders_0) AS t_0 WHERE t_0.row_num = 1";

export const ORDERS_ROW_NUMBER_FILTER_ORDER_LIMIT_POSTGRES_COMPACT =
  "SELECT t_0.order_id AS order_id, t_0.row_num AS row_num FROM (SELECT orders_0.order_id, row_number() OVER (ORDER BY orders_0.order_id ASC) AS row_num FROM orders AS orders_0) AS t_0 WHERE t_0.row_num = 1 ORDER BY t_0.order_id ASC LIMIT 5";

export const ORDERS_TOTAL_ROW_NUMBER_QUALIFY_BIGQUERY_COMPACT =
  "SELECT orders_0.order_id, orders_0.total, row_number() OVER (ORDER BY orders_0.order_id ASC) AS row_num FROM orders AS orders_0 WHERE orders_0.total > 10 QUALIFY row_number() OVER (ORDER BY orders_0.order_id ASC) = 1";

export const ORDERS_TOTAL_ROW_NUMBER_FILTER_POSTGRES_COMPACT =
  "SELECT t_0.order_id AS order_id, t_0.total AS total, t_0.row_num AS row_num FROM (SELECT orders_0.order_id, orders_0.total, row_number() OVER (ORDER BY orders_0.order_id ASC) AS row_num FROM orders AS orders_0 WHERE orders_0.total > 10) AS t_0 WHERE t_0.row_num = 1";

export const ORDERS_TOTAL_SHARED_ROW_NUMBER_QUALIFY_BIGQUERY_COMPACT =
  "SELECT orders_0.order_id, orders_0.total, row_number() OVER (ORDER BY orders_0.order_id ASC) AS row_num FROM orders AS orders_0 WHERE orders_0.total > 10 QUALIFY row_number() OVER (ORDER BY orders_0.order_id ASC) = 1 OR row_number() OVER (ORDER BY orders_0.order_id ASC) = 2";

export const ORDERS_TOTAL_SHARED_ROW_NUMBER_FILTER_POSTGRES_COMPACT =
  "SELECT t_0.order_id AS order_id, t_0.total AS total, t_0.row_num AS row_num FROM (SELECT orders_0.order_id, orders_0.total, row_number() OVER (ORDER BY orders_0.order_id ASC) AS row_num FROM orders AS orders_0 WHERE orders_0.total > 10) AS t_0 WHERE t_0.row_num = 1 OR t_0.row_num = 2";

export const ORDERS_TOTAL_NOT_ROW_NUMBER_QUALIFY_BIGQUERY_COMPACT =
  "SELECT orders_0.order_id, orders_0.total, row_number() OVER (ORDER BY orders_0.order_id ASC) AS row_num FROM orders AS orders_0 WHERE orders_0.total > 10 QUALIFY NOT row_number() OVER (ORDER BY orders_0.order_id ASC) = 1";

export const ORDERS_TOTAL_NOT_ROW_NUMBER_FILTER_POSTGRES_COMPACT =
  "SELECT t_0.order_id AS order_id, t_0.total AS total, t_0.row_num AS row_num FROM (SELECT orders_0.order_id, orders_0.total, row_number() OVER (ORDER BY orders_0.order_id ASC) AS row_num FROM orders AS orders_0 WHERE orders_0.total > 10) AS t_0 WHERE NOT t_0.row_num = 1";

export const ORDERS_SHARED_DISJUNCTION_ROW_NUMBER_QUALIFY_BIGQUERY_COMPACT =
  "SELECT orders_0.order_id, orders_0.total, row_number() OVER (ORDER BY orders_0.order_id ASC) AS row_num FROM orders AS orders_0 WHERE orders_0.order_id > 5 OR orders_0.total > 10 QUALIFY row_number() OVER (ORDER BY orders_0.order_id ASC) = 1 OR row_number() OVER (ORDER BY orders_0.order_id ASC) = 2";

export const ORDERS_GROUPED_USER_RANGE_HAVING_OR_POSTGRES_COMPACT =
  "SELECT orders_0.user_id, SUM(orders_0.total) AS total_spend FROM orders AS orders_0 WHERE orders_0.user_id < 0 OR orders_0.user_id > 10 GROUP BY orders_0.user_id HAVING SUM(orders_0.total) > 100 OR SUM(orders_0.total) > 200";

export const ORDERS_GROUPED_TOTALS_WHERE_HAVING_OR_POSTGRES_COMPACT =
  "SELECT orders_0.user_id, SUM(orders_0.total) AS total_spend FROM orders AS orders_0 WHERE orders_0.user_id > 10 GROUP BY orders_0.user_id HAVING SUM(orders_0.total) > 100 OR SUM(orders_0.total) > 200";

export const QUOTED_ANALYTICS_EVENTS_SELECT_POSTGRES_COMPACT =
  "SELECT events_alias.id FROM \"analytics data\".\"events log\" AS events_alias";

export const QUOTED_ANALYTICS_EVENTS_SELECT_BIGQUERY_COMPACT =
  "SELECT events_alias.id FROM `analytics data`.`events log` AS events_alias";

export const QUOTED_USERS_ALIAS_SELECT_POSTGRES_COMPACT =
  "SELECT \"user source\".id FROM users AS \"user source\"";

export const QUOTED_USERS_PROJECTED_ALIAS_BIGQUERY_COMPACT =
  "SELECT users_0.id AS `source id` FROM users AS users_0";

export const QUOTED_ROW_NUMBER_ALIAS_FILTER_POSTGRES_COMPACT =
  "SELECT t_0.\"Row Number\" AS \"Row Number\" FROM (SELECT row_number() OVER (ORDER BY orders_0.order_id ASC) AS \"Row Number\" FROM orders AS orders_0) AS t_0 WHERE t_0.\"Row Number\" = 1";

export const QUOTED_TOTAL_SPEND_AGG_LIST_POSTGRES_COMPACT =
  "SELECT orders_0.user_id AS \"User Id\", SUM(orders_0.total) AS \"Total Spend\" FROM orders AS orders_0 GROUP BY orders_0.user_id HAVING SUM(orders_0.total) > 100";

export const ORDERS_REMAP_AGG_POSTGRES_COMPACT =
  "SELECT orders_0.user_id AS \"User Id\", SUM(orders_0.total) AS \"Total Spend\" FROM orders AS orders_0 GROUP BY orders_0.user_id HAVING SUM(orders_0.total) > 100";

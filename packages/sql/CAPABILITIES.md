# Dialect Capabilities

This file is generated from the public language catalog and built-in dialect
configuration. `packages/sql/tests/capability_matrix.test.ts` verifies it
matches `formatDialectCapabilityMatrixMarkdown()`.

The operation statuses below describe lowering behavior, not database-version
verification. PostgreSQL, SQLite, and DuckDB are `live-verified`; the remaining
built-ins are currently `parser-checked`. Custom dialect specifications are
`configured` unless they explicitly declare another tier.

| Operation | mysql | mariadb | postgresql | sqlite | trino | transactsql | redshift | snowflake | bigquery | athena | db2 | hive | flinksql | noql | duckdb |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| + | native | native | native | native | native | native | native | native | native | native | native | native | native | native | native |
| - | native | native | native | native | native | native | native | native | native | native | native | native | native | native | native |
| * | native | native | native | native | native | native | native | native | native | native | native | native | native | native | native |
| / | native | native | native | native | native | native | native | native | native | native | native | native | native | native | native |
| MOD | native | native | native | native | native | native | native | native | native | native | native | native | native | native | native |
| ABS | native | native | native | native | native | native | native | native | native | native | native | native | native | native | native |
| CEIL | native | native | native | rewritten | native | native | native | native | native | native | native | native | native | native | native |
| FLOOR | native | native | native | native | native | native | native | native | native | native | native | native | native | native | native |
| SQRT | native | native | native | native | native | native | native | native | native | native | native | native | native | native | native |
| ROUND | native | native | native | native | native | native | native | native | native | native | native | native | native | native | native |
| POWER | native | native | native | native | native | native | native | native | native | native | native | native | native | native | native |
| GREATEST | native | native | native | rewritten | native | native | native | native | native | native | native | native | native | native | native |
| LEAST | native | native | native | rewritten | native | native | native | native | native | native | native | native | native | native | native |
| CONCAT | native | native | native | native | native | native | native | native | native | native | native | native | native | native | native |
| UPPER | native | native | native | native | native | native | native | native | native | native | native | native | native | native | native |
| LOWER | native | native | native | native | native | native | native | native | native | native | native | native | native | native | native |
| TRIM | native | native | native | native | native | native | native | native | native | native | native | native | native | native | native |
| SUBSTRING | native | native | native | native | native | native | native | native | native | native | native | native | native | native | native |
| POSITION | native | native | native | emulated | native | native | native | native | native | native | native | native | native | native | native |
| OVERLAY | native | native | native | native | native | native | native | native | native | native | native | native | native | native | emulated |
| CHAR_LENGTH | native | native | native | rewritten | rewritten | native | native | native | native | native | native | native | native | native | native |
| CHARACTER_LENGTH | native | native | rewritten | rewritten | rewritten | native | native | native | native | native | native | native | native | native | native |
| OCTET_LENGTH | native | native | native | rewritten | native | native | native | native | native | native | native | native | native | native | rewritten |
| BIT_LENGTH | native | native | native | emulated | native | native | native | native | native | native | native | native | native | native | native |
| REPLACE | native | native | native | native | native | native | native | native | native | native | native | native | native | native | native |
| REVERSE | native | native | native | native | native | native | native | native | native | native | native | native | native | native | native |
| LEFT | native | native | native | native | native | native | native | native | native | native | native | native | native | native | native |
| RIGHT | native | native | native | native | native | native | native | native | native | native | native | native | native | native | native |
| LPAD | native | native | native | native | native | native | native | native | native | native | native | native | native | native | native |
| RPAD | native | native | native | native | native | native | native | native | native | native | native | native | native | native | native |
| REGEXP_LIKE | native | native | emulated | emulated | native | native | native | native | native | native | native | native | native | native | rewritten |
| REGEXP_REPLACE | native | native | native | native | native | native | native | native | native | native | native | native | native | native | native |
| REGEXP_EXTRACT | native | native | emulated | native | native | native | native | native | native | native | native | native | native | native | native |
| = | native | native | native | native | native | native | native | native | native | native | native | native | native | native | native |
| != | native | native | native | native | native | native | native | native | native | native | native | native | native | native | native |
| < | native | native | native | native | native | native | native | native | native | native | native | native | native | native | native |
| <= | native | native | native | native | native | native | native | native | native | native | native | native | native | native | native |
| > | native | native | native | native | native | native | native | native | native | native | native | native | native | native | native |
| >= | native | native | native | native | native | native | native | native | native | native | native | native | native | native | native |
| AND | native | native | native | native | native | native | native | native | native | native | native | native | native | native | native |
| OR | native | native | native | native | native | native | native | native | native | native | native | native | native | native | native |
| NOT | native | native | native | native | native | native | native | native | native | native | native | native | native | native | native |
| LIKE | native | native | native | native | native | native | native | native | native | native | native | native | native | native | native |
| IN | native | native | native | native | native | native | native | native | native | native | native | native | native | native | native |
| CURRENT_DATE | native | native | native | native | native | native | native | native | native | native | native | native | native | native | native |
| CURRENT_TIMESTAMP | native | native | native | native | native | native | native | native | native | native | native | native | native | native | native |
| EXTRACT | native | native | emulated | emulated | native | native | native | native | native | native | native | native | native | native | native |
| DATE_TRUNC | native | native | native | emulated | native | native | native | native | native | native | native | native | native | native | native |
| DATE_ADD | native | native | emulated | emulated | native | native | native | native | native | native | native | emulated | native | native | emulated |
| DATE_DIFF | native | native | emulated | emulated | native | native | native | native | native | native | native | native | native | native | emulated |
| DATE_PARSE | native | native | emulated | emulated | native | native | native | native | native | native | native | native | native | native | rewritten |
| DATE_FORMAT | native | native | emulated | emulated | native | native | native | native | native | native | native | native | native | native | rewritten |
| TO_UNIXTIME | native | native | emulated | emulated | native | native | native | native | native | native | native | native | native | native | emulated |
| FROM_UNIXTIME | native | native | rewritten | emulated | native | native | native | native | native | native | native | native | native | native | rewritten |
| CAST | native | native | native | native | native | native | native | native | native | native | native | native | native | native | native |
| TRY_CAST | native | native | native | native | native | native | native | native | native | native | native | native | native | native | native |
| COALESCE | native | native | native | native | native | native | native | native | native | native | native | native | native | native | native |
| NULLIF | native | native | native | native | native | native | native | native | native | native | native | native | native | native | native |
| IS NULL | native | native | native | native | native | native | native | native | native | native | native | native | native | native | native |
| IS NOT NULL | native | native | native | native | native | native | native | native | native | native | native | native | native | native | native |
| ARRAY_LENGTH | native | native | emulated | emulated | rewritten | native | native | native | native | native | native | native | native | native | native |
| ARRAY_CONTAINS | native | native | emulated | emulated | native | native | native | native | native | native | native | native | native | native | native |
| ARRAY_POSITION | native | native | native | emulated | native | native | native | native | native | native | native | native | native | native | rewritten |
| ARRAY_SLICE | native | native | native | native | rewritten | native | native | native | native | native | native | native | native | native | emulated |
| ARRAY_JOIN | native | native | rewritten | emulated | native | native | native | native | native | native | native | native | native | native | rewritten |
| ARRAY_APPEND | native | native | native | emulated | emulated | native | native | native | native | native | native | native | native | native | native |
| ARRAY_PREPEND | native | native | emulated | native | emulated | native | native | native | native | native | native | native | native | native | emulated |
| ARRAY_CONCAT | native | native | emulated | native | rewritten | native | native | native | native | native | native | native | native | native | native |
| ARRAY_DISTINCT | native | native | native | native | native | native | native | native | native | native | native | native | native | native | native |
| COUNT | native | native | native | native | native | native | native | native | native | native | native | native | native | native | native |
| SUM | native | native | native | native | native | native | native | native | native | native | native | native | native | native | native |
| AVG | native | native | native | native | native | native | native | native | native | native | native | native | native | native | native |
| MIN | native | native | native | native | native | native | native | native | native | native | native | native | native | native | native |
| MAX | native | native | native | native | native | native | native | native | native | native | native | native | native | native | native |
| ARRAY_AGG | native | native | native | rewritten | native | native | native | native | native | native | native | rewritten | native | native | native |
| RANK | native | native | native | native | native | native | native | native | native | native | native | native | native | native | native |
| DENSE_RANK | native | native | native | native | native | native | native | native | native | native | native | native | native | native | native |
| ROW_NUMBER | native | native | native | native | native | native | native | native | native | native | native | native | native | native | native |
| LAG | native | native | native | native | native | native | native | native | native | native | native | native | native | native | native |
| LEAD | native | native | native | native | native | native | native | native | native | native | native | native | native | native | native |
| PERCENT_RANK | native | native | native | native | native | native | native | native | native | native | native | native | native | native | native |
| NTILE | native | native | native | native | native | native | native | native | native | native | native | native | native | native | native |
| LATERAL_JOIN | native | native | native | rewritten | native | native | native | native | native | native | native | native | native | native | native |
| RECURSIVE_CTE | native | native | native | native | native | native | native | native | native | native | native | native | native | native | native |

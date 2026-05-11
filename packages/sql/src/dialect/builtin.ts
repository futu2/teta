import type { BuiltinDialect } from "../types.ts";
import { ATHENA_DIALECT } from "./athena.ts";
import { BIGQUERY_DIALECT } from "./bigquery.ts";
import { DB2_DIALECT } from "./db2.ts";
import { DUCKDB_DIALECT } from "./duckdb.ts";
import { FLINKSQL_DIALECT } from "./flinksql.ts";
import { HETU_DIALECT } from "./hetu.ts";
import { HIVE_DIALECT } from "./hive.ts";
import { MARIADB_DIALECT } from "./mariadb.ts";
import { MYSQL_DIALECT } from "./mysql.ts";
import { NOQL_DIALECT } from "./noql.ts";
import { POSTGRESQL_DIALECT } from "./postgresql.ts";
import { REDSHIFT_DIALECT } from "./redshift.ts";
import { SNOWFLAKE_DIALECT } from "./snowflake.ts";
import { SQLITE_DIALECT } from "./sqlite.ts";
import { TRANSACTSQL_DIALECT } from "./transactsql.ts";
import { TRINO_DIALECT } from "./trino.ts";
import type { BuiltinDialectDefinition } from "./types.ts";

export const BUILTIN_DIALECTS: Record<BuiltinDialect, BuiltinDialectDefinition> = {
  mysql: MYSQL_DIALECT,
  mariadb: MARIADB_DIALECT,
  postgresql: POSTGRESQL_DIALECT,
  sqlite: SQLITE_DIALECT,
  trino: TRINO_DIALECT,
  transactsql: TRANSACTSQL_DIALECT,
  redshift: REDSHIFT_DIALECT,
  snowflake: SNOWFLAKE_DIALECT,
  bigquery: BIGQUERY_DIALECT,
  athena: ATHENA_DIALECT,
  db2: DB2_DIALECT,
  hive: HIVE_DIALECT,
  flinksql: FLINKSQL_DIALECT,
  noql: NOQL_DIALECT,
  duckdb: DUCKDB_DIALECT,
  hetu: HETU_DIALECT,
};

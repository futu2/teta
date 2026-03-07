import type { BuiltinDialect } from "../../types";
import { ATHENA_DIALECT } from "./athena";
import { BIGQUERY_DIALECT } from "./bigquery";
import { DB2_DIALECT } from "./db2";
import { DUCKDB_DIALECT } from "./duckdb";
import { FLINKSQL_DIALECT } from "./flinksql";
import { HETU_DIALECT } from "./hetu";
import { HIVE_DIALECT } from "./hive";
import { MARIADB_DIALECT } from "./mariadb";
import { MYSQL_DIALECT } from "./mysql";
import { NOQL_DIALECT } from "./noql";
import { POSTGRESQL_DIALECT } from "./postgresql";
import { REDSHIFT_DIALECT } from "./redshift";
import { SNOWFLAKE_DIALECT } from "./snowflake";
import { SQLITE_DIALECT } from "./sqlite";
import { TRANSACTSQL_DIALECT } from "./transactsql";
import { TRINO_DIALECT } from "./trino";
import type { BuiltinDialectDefinition } from "./types";

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

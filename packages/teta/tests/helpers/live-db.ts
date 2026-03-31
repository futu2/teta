import { Database } from "bun:sqlite";

export type LiveDialect = "sqlite" | "duckdb";
export type LiveRow = Record<string, unknown>;

export interface LiveDialectAdapter {
  dialect: LiveDialect;
  run(sql: string): Promise<LiveRow[]>;
  close(): Promise<void>;
}

const SQLITE_SCHEMA = [
  `CREATE TABLE spec_scalar (
    i INTEGER NOT NULL,
    j INTEGER NOT NULL,
    k INTEGER NOT NULL,
    neg_i INTEGER NOT NULL,
    x REAL NOT NULL,
    y REAL NOT NULL,
    ceil_src REAL NOT NULL,
    floor_src REAL NOT NULL,
    sqrt_src REAL NOT NULL,
    pow_base REAL NOT NULL,
    pow_exp REAL NOT NULL,
    round_src REAL NOT NULL,
    txt TEXT NOT NULL,
    txt2 TEXT NOT NULL,
    nullable_txt TEXT,
    num_txt TEXT NOT NULL,
    ts TEXT NOT NULL,
    ts_next TEXT NOT NULL,
    parse_txt TEXT NOT NULL
  );`,
  `INSERT INTO spec_scalar
    (
      i,
      j,
      k,
      neg_i,
      x,
      y,
      ceil_src,
      floor_src,
      sqrt_src,
      pow_base,
      pow_exp,
      round_src,
      txt,
      txt2,
      nullable_txt,
      num_txt,
      ts,
      ts_next,
      parse_txt
    )
    VALUES
    (
      5,
      2,
      8,
      -5,
      7.5,
      2.5,
      2.25,
      2.75,
      9,
      2,
      3,
      2.345,
      '  HelloWorld  ',
      'World',
      NULL,
      '42',
      '2024-01-02 03:04:05',
      '2024-01-03 03:04:05',
      '2024-02-03 04:05:06'
    );`,
  `CREATE TABLE spec_array (
    text_arr TEXT NOT NULL,
    num_arr TEXT NOT NULL,
    more_num_arr TEXT NOT NULL
  );`,
  `INSERT INTO spec_array (text_arr, num_arr, more_num_arr)
    VALUES ('["red","blue","red"]', '[1,2,3]', '[4,5]');`,
  `CREATE TABLE spec_metrics (
    grp TEXT NOT NULL,
    seq INTEGER NOT NULL,
    amount INTEGER NOT NULL
  );`,
  `INSERT INTO spec_metrics (grp, seq, amount) VALUES
    ('a', 1, 10),
    ('a', 2, 20),
    ('b', 1, 30),
    ('b', 2, 40);`,
  `CREATE TABLE spec_rank (
    seq INTEGER NOT NULL,
    amount INTEGER NOT NULL
  );`,
  `INSERT INTO spec_rank (seq, amount) VALUES
    (1, 40),
    (2, 20),
    (3, 20),
    (4, 10);`,
  `CREATE TABLE spec_employees (
    id INTEGER NOT NULL,
    name TEXT NOT NULL,
    manager_id INTEGER
  );`,
  `INSERT INTO spec_employees (id, name, manager_id) VALUES
    (1, 'CEO', NULL),
    (2, 'CTO', 1),
    (3, 'DEV', 2);`,
] as const;

const DUCKDB_SCHEMA = [
  `CREATE TABLE spec_scalar (
    i INTEGER NOT NULL,
    j INTEGER NOT NULL,
    k INTEGER NOT NULL,
    neg_i INTEGER NOT NULL,
    x DOUBLE NOT NULL,
    y DOUBLE NOT NULL,
    ceil_src DOUBLE NOT NULL,
    floor_src DOUBLE NOT NULL,
    sqrt_src DOUBLE NOT NULL,
    pow_base DOUBLE NOT NULL,
    pow_exp DOUBLE NOT NULL,
    round_src DOUBLE NOT NULL,
    txt VARCHAR NOT NULL,
    txt2 VARCHAR NOT NULL,
    nullable_txt VARCHAR,
    num_txt VARCHAR NOT NULL,
    ts TIMESTAMP NOT NULL,
    ts_next TIMESTAMP NOT NULL,
    parse_txt VARCHAR NOT NULL
  );`,
  `INSERT INTO spec_scalar
    (
      i,
      j,
      k,
      neg_i,
      x,
      y,
      ceil_src,
      floor_src,
      sqrt_src,
      pow_base,
      pow_exp,
      round_src,
      txt,
      txt2,
      nullable_txt,
      num_txt,
      ts,
      ts_next,
      parse_txt
    )
    VALUES
    (
      5,
      2,
      8,
      -5,
      7.5,
      2.5,
      2.25,
      2.75,
      9,
      2,
      3,
      2.345,
      '  HelloWorld  ',
      'World',
      NULL,
      '42',
      TIMESTAMP '2024-01-02 03:04:05',
      TIMESTAMP '2024-01-03 03:04:05',
      '2024-02-03 04:05:06'
    );`,
  `CREATE TABLE spec_array (
    text_arr VARCHAR[] NOT NULL,
    num_arr INTEGER[] NOT NULL,
    more_num_arr INTEGER[] NOT NULL
  );`,
  `INSERT INTO spec_array (text_arr, num_arr, more_num_arr)
    VALUES (['red', 'blue', 'red'], [1, 2, 3], [4, 5]);`,
  `CREATE TABLE spec_metrics (
    grp VARCHAR NOT NULL,
    seq INTEGER NOT NULL,
    amount INTEGER NOT NULL
  );`,
  `INSERT INTO spec_metrics (grp, seq, amount) VALUES
    ('a', 1, 10),
    ('a', 2, 20),
    ('b', 1, 30),
    ('b', 2, 40);`,
  `CREATE TABLE spec_rank (
    seq INTEGER NOT NULL,
    amount INTEGER NOT NULL
  );`,
  `INSERT INTO spec_rank (seq, amount) VALUES
    (1, 40),
    (2, 20),
    (3, 20),
    (4, 10);`,
  `CREATE TABLE spec_employees (
    id INTEGER NOT NULL,
    name VARCHAR NOT NULL,
    manager_id INTEGER
  );`,
  `INSERT INTO spec_employees (id, name, manager_id) VALUES
    (1, 'CEO', NULL),
    (2, 'CTO', 1),
    (3, 'DEV', 2);`,
] as const;

export async function createSqliteAdapter(): Promise<LiveDialectAdapter> {
  const database = new Database(":memory:");
  for (const statement of SQLITE_SCHEMA) {
    database.exec(statement);
  }

  return {
    dialect: "sqlite",
    async run(sql: string): Promise<LiveRow[]> {
      return database.query(sql).all() as LiveRow[];
    },
    async close(): Promise<void> {
      database.close();
    },
  };
}

export async function createDuckDbAdapter(
  DuckDBConnection: (typeof import("@duckdb/node-api"))["DuckDBConnection"]
): Promise<LiveDialectAdapter> {
  const connection = await DuckDBConnection.create();
  await connection.run("SET TimeZone = 'UTC'");
  for (const statement of DUCKDB_SCHEMA) {
    await connection.run(statement);
  }

  return {
    dialect: "duckdb",
    async run(sql: string): Promise<LiveRow[]> {
      return (await (await connection.run(sql)).getRowObjectsJS()) as LiveRow[];
    },
    async close(): Promise<void> {
      connection.disconnectSync();
    },
  };
}

export function normalizeLiveValue(value: unknown): unknown {
  if (typeof value === "bigint") {
    return Number(value);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeLiveValue(item));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        normalizeLiveValue(item),
      ])
    );
  }
  return value;
}

export function normalizeLiveRows(rows: LiveRow[]): LiveRow[] {
  return rows.map((row) => normalizeLiveValue(row) as LiveRow);
}

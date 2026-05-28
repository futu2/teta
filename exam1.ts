import { asc, desc, map, over, pipe, rank, rowNumber, sort, t, table, toSql } from "./packages/teta/mod.ts";

const examTable = table("exam_scores", {
  id: t.int(),
  class: t.string(),
  value: t.int(),
});

const query = pipe(
  examTable,
  map((row) => ({
    id: row.id,
    class: row.class,
    value: row.value,
    value_rank: over(rank(), {
      partitionBy: row.class,
      orderBy: desc(row.value),
    }),
    row_number_in_class: over(rowNumber(), {
      partitionBy: row.class,
      orderBy: desc(row.value),
    }),
  })),
  sort((row) => [asc(row.class), asc(row.value_rank), asc(row.id)])
);

console.log(
  toSql(query, {
    dialect: "postgresql",
    format: "pretty",
  })
);

import { describe, expect, test } from "bun:test";

import {
  filter,
  limit,
  orderBy,
  pipeQuery,
  select,
  sqlRenderer,
  toSql,
} from "../mod.ts";
import { USER_PIPELINE_POSTGRES_COMPACT } from "./helpers/expected-sql.ts";
import { createUsersPipelineTable } from "./helpers/fixtures.ts";

describe("function-first query api", () => {
  test("composes a typed pipeline with pipeQuery and data-first helpers", () => {
    const users = createUsersPipelineTable();
    const query = pipeQuery(
      users,
      (current) => filter(current, (user) => user.active.eq(true).and(user.age.gte(18))),
      (current) => select(current, (user) => ({
        id: user.id,
        name: user.name.replace(" ", "_").coalesce("unknown"),
        age: user.age,
      })),
      (current) => orderBy(current, (row) => [row.name.asc(), row.id.desc()]),
      (current) => limit(current, 20)
    );

    expect(
      toSql(query, sqlRenderer({ dialect: "postgresql", format: "compact" }))
    ).toBe(USER_PIPELINE_POSTGRES_COMPACT);
  });
});

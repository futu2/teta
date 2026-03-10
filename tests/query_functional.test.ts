import { describe, expect, test } from "bun:test";

import * as R from "remeda";

import {
  filter,
  limit,
  orderBy,
  select,
  sqlRenderer,
  toSql,
} from "../mod.ts";
import { USER_PIPELINE_POSTGRES_COMPACT } from "./helpers/expected-sql.ts";
import { createUsersPipelineTable } from "./helpers/fixtures.ts";

describe("function-first query api", () => {
  test("composes a pipeline with remeda pipe and curried query helpers", () => {
    const users = createUsersPipelineTable();
    const query = R.pipe(
      users,
      filter((user: typeof users.columns) =>
        user.active.eq(true).and(user.age.gte(18))
      ),
      select((user) => ({
        id: user.id,
        name: user.name.replace(" ", "_").coalesce("unknown"),
        age: user.age,
      })),
      orderBy((row) => [row.name.asc(), row.id.desc()]),
      limit(20)
    );

    expect(
      toSql(query, sqlRenderer({ dialect: "postgresql", format: "compact" }))
    ).toBe(USER_PIPELINE_POSTGRES_COMPACT);
  });
});

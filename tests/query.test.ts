import { describe, expect, test } from "bun:test";

import { table, t } from "../mod.ts";
import {
  USER_PIPELINE_POSTGRES_COMPACT,
  USER_PIPELINE_POSTGRES_PRETTY,
  USERS_NAME_LENGTH_SQLITE_COMPACT,
} from "./helpers/expected-sql.ts";
import { buildUserPipelineQuery } from "./helpers/fixtures.ts";

describe("Query.toSql", () => {
  test("renders a compact postgres pipeline", () => {
    const query = buildUserPipelineQuery();

    expect(query.toSql("postgresql", "compact")).toBe(
      USER_PIPELINE_POSTGRES_COMPACT
    );
  });

  test("renders a pretty postgres pipeline", () => {
    const query = buildUserPipelineQuery();

    expect(query.toSql("postgresql", "pretty")).toBe(
      USER_PIPELINE_POSTGRES_PRETTY
    );
  });

  test("applies sqlite language rewrites", () => {
    const users = table("users", { name: t.string() });
    const query = users.select((user) => ({
      len: user.name.characterLength(),
      bit_len: user.name.bitLength(),
    }));

    expect(query.toSql("sqlite", "compact")).toBe(
      USERS_NAME_LENGTH_SQLITE_COMPACT
    );
  });
});

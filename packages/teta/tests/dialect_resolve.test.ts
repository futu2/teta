import { describe, expect, test } from "bun:test";

import {
  buildSqlOptions,
  resolveDialect,
} from "../src/edsl/sql/dialect/resolve.ts";

describe("dialect resolution", () => {
  test("inherits parser dialect features for custom specs", () => {
    expect(
      resolveDialect({
        name: "custom",
        parserDialect: "BigQuery",
      })
    ).toMatchObject({
      name: "custom",
      parserDialect: "BigQuery",
      features: {
        lateralJoinKeyword: true,
        recursiveCte: true,
        qualifyClause: true,
      },
    });
  });

  test("buildSqlOptions applies dialect and parameter defaults", () => {
    expect(
      buildSqlOptions({
        dialect: { name: "custom", parserDialect: "Postgresql" },
        format: "pretty",
        parameterMode: "named",
        parameterPrefix: "$",
      })
    ).toMatchObject({
      sqlFormat: "pretty",
      parameterMode: "named",
      parameterPrefix: "$",
      dialect: {
        name: "custom",
        parserDialect: "Postgresql",
      },
      options: {
        database: "Postgresql",
      },
    });
  });
});

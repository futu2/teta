import { describe, expect, test } from "bun:test";

import type {
  InternalCteName,
  QuerySpec,
  ScopeId,
} from "../src/edsl/core/types.ts";
import { getDefaultDialect } from "../src/edsl/sql/dialect.ts";
import {
  buildRecursiveCte,
  createDeferredRecursiveCte,
} from "../src/edsl/sql/render/recursive.ts";

const loopName = "__teta_cte_loop_test" as InternalCteName;

const querySpec = (): QuerySpec => ({
  source: {
    db: null,
    schema: null,
    table: { name: "employees", quoted: false },
    as: null,
  },
  stages: [],
  columnNames: ["id"],
  columnIdentifiers: {},
  scopeId: "__teta_scope_test" as ScopeId,
});

describe("recursive render helpers", () => {
  test("createDeferredRecursiveCte clones column names", () => {
    const columnNames = ["id"];
    const cte = createDeferredRecursiveCte(
      loopName,
      columnNames,
      querySpec(),
      querySpec()
    );

    columnNames.push("name");

    expect(cte.kind).toBe("recursive");
    if (cte.kind !== "recursive") {
      throw new Error("Expected recursive CTE");
    }
    expect(cte.columnNames).toEqual(["id"]);
  });

  test("buildRecursiveCte rejects dialects without recursive support", () => {
    const dialect = getDefaultDialect();
    dialect.features.recursiveCte = false;

    expect(() =>
      buildRecursiveCte(
        loopName,
        ["id"],
        querySpec(),
        querySpec(),
        dialect
      )
    ).toThrow("does not support recursive CTE");
  });
});

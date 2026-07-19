import { describe, expect, test } from "bun:test";

import type {
  InternalCteName,
  QuerySpec,
  ScopeId,
} from "../src/ir/types.ts";
import { getDefaultDialect } from "../src/dialect.ts";
import {
  buildRecursiveCte,
  createDeferredRecursiveCte,
} from "../src/render/recursive.ts";

const loopName = "__teta_cte_recursive_test" as InternalCteName;

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

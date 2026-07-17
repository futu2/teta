import type { QueryDialect } from "../types.ts";
import type { Db2LimitAst, SelectAst } from "./types.ts";

/** Lower a dialect-neutral take count into the target dialect's SELECT shape. */
export function applyTake(
  ast: SelectAst,
  count: number,
  dialect: QueryDialect
): SelectAst {
  switch (dialect.parserDialect?.toLowerCase()) {
    case "db2":
      return {
        ...ast,
        limit: db2FetchFirst(count),
      };
    case "transactsql":
      return {
        ...ast,
        limit: null,
        top: {
          value: count,
          percent: null,
        },
      };
    default:
      return {
        ...ast,
        limit: {
          seperator: "",
          value: [{ type: "number", value: count }],
        },
      };
  }
}

function db2FetchFirst(count: number): Db2LimitAst {
  return {
    fetch: {
      prefix: [
        { type: "origin", value: "fetch" },
        { type: "origin", value: "first" },
      ],
      value: { type: "number", value: count },
      suffix: [
        { type: "origin", value: "rows" },
        { type: "origin", value: "only" },
      ],
    },
  };
}

import type { Value } from "../../core/types";
import type { SqlRenderContext } from "./types";

export function literalToAst(
  value: Value,
  renderContext: SqlRenderContext | null
): unknown {
  if (
    renderContext?.mode === "sql" &&
    renderContext.parameterMode === "named" &&
    value !== null
  ) {
    return parameterizeLiteral(value, renderContext);
  }
  if (value === null) return { type: "null", value: null };
  if (typeof value === "object") {
    switch (value.kind) {
      case "date_literal":
        return { type: "date", value: value.value };
      case "timestamp_literal":
        return { type: "timestamp", value: value.value };
      default:
        return assertNever(value);
    }
  }
  switch (typeof value) {
    case "string":
      return { type: "string", value };
    case "number":
      return { type: "number", value };
    case "boolean":
      return { type: "bool", value };
    default:
      return assertNever(value);
  }
}

function parameterizeLiteral(
  value: Exclude<Value, null>,
  renderContext: SqlRenderContext
): { type: "param"; value: string; prefix: string } {
  const index = renderContext.params.length + 1;
  const name = `p${index}`;
  renderContext.params.push({
    val: parameterValue(value),
    index,
    name,
  });
  return {
    type: "param",
    value: name,
    prefix: renderContext.parameterPrefix,
  };
}

function parameterValue(value: Exclude<Value, null>): unknown {
  if (typeof value === "object") {
    return value.value;
  }
  return value;
}

function assertNever(value: never): never {
  throw new Error(`Unexpected literal value: ${JSON.stringify(value)}`);
}

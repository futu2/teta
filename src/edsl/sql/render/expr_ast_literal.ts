import type { Value } from "../../core/types";
import type { SqlRenderContext } from "./types";

export function literalToAst(
  value: Value,
  renderContext: SqlRenderContext | null
): unknown {
  if (
    renderContext?.mode === "sql" &&
    renderContext.parameterMode !== "inline" &&
    value !== null
  ) {
    return parameterizeValue(parameterValue(value), renderContext, {
      mode: renderContext.parameterMode,
      prefix: renderContext.parameterPrefix,
      name: null,
    });
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

export function paramToAst(
  value: unknown,
  name: string | null,
  renderContext: SqlRenderContext | null
): { type: "param"; value: string; prefix: string } {
  const resolved = resolveExplicitParameterRender(name, renderContext);
  return parameterizeValue(value, renderContext, resolved);
}

type ActiveParameterMode = Exclude<SqlRenderContext["parameterMode"], "inline">;

type ParameterRender = {
  mode: ActiveParameterMode;
  prefix: string;
  name: string | null;
};

function parameterizeValue(
  value: unknown,
  renderContext: SqlRenderContext | null,
  config: ParameterRender
): { type: "param"; value: string; prefix: string } {
  const index = (renderContext?.params.length ?? 0) + 1;
  const parameterName = config.mode === "named" ? (config.name ?? `p${index}`) : null;

  renderContext?.params.push({
    value,
    index,
    name: parameterName,
  });

  return {
    type: "param",
    value: config.mode === "named" ? (parameterName ?? `p${index}`) : String(index),
    prefix: config.prefix,
  };
}

function parameterValue(value: Exclude<Value, null>): unknown {
  if (typeof value === "object") {
    return value.value;
  }
  return value;
}

function resolveExplicitParameterRender(
  name: string | null,
  renderContext: SqlRenderContext | null
): ParameterRender {
  if (renderContext && renderContext.parameterMode !== "inline") {
    return {
      mode: renderContext.parameterMode,
      prefix: renderContext.parameterPrefix,
      name,
    };
  }

  if (name !== null) {
    return {
      mode: "named",
      prefix: ":",
      name,
    };
  }

  return {
    mode: "positional",
    prefix: "$",
    name: null,
  };
}

function assertNever(value: never): never {
  throw new Error(`Unexpected literal value: ${JSON.stringify(value)}`);
}

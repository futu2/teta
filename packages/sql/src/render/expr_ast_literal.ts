import type { Value } from "../ir/types.ts";
import type { LiteralAst, ParamAst, SqlRenderContext } from "./types.ts";
import { internalError, userError } from "../errors.ts";

export function literalToAst(
  value: Value,
  renderContext: SqlRenderContext | null
): LiteralAst | ParamAst {
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
    case "bigint":
      return { type: "number", value: value.toString() };
    case "boolean":
      return { type: "bool", value };
    default:
      return assertNever(value);
  }
}

export function paramToAst(
  name: string,
  renderContext: SqlRenderContext | null
): ParamAst {
  const resolved = resolveExplicitParameterRender(name, renderContext);
  return parameterizeValue(resolveParamBinding(name, renderContext), renderContext, resolved);
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
): ParamAst {
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
  name: string,
  renderContext: SqlRenderContext | null
): ParameterRender {
  if (renderContext && renderContext.parameterMode !== "inline") {
    return {
      mode: renderContext.parameterMode,
      prefix: renderContext.parameterPrefix,
      name,
    };
  }

  return {
    mode: "named",
    prefix: ":",
    name,
  };
}

function resolveParamBinding(
  name: string,
  renderContext: SqlRenderContext | null
): unknown {
  const bindings = renderContext?.paramBindings;
  if (bindings === undefined) {
    userError("INVALID_PARAM_VALUE", `Missing parameter binding for ${name}`);
  }

  if (Array.isArray(bindings)) {
    const index = Number(name);
    if (!Number.isInteger(index) || index < 1 || index > bindings.length) {
      userError("INVALID_PARAM_VALUE", `Missing parameter binding for ${name}`);
    }
    return bindings[index - 1];
  }

  if (!Object.prototype.hasOwnProperty.call(bindings, name)) {
    userError("INVALID_PARAM_VALUE", `Missing parameter binding for ${name}`);
  }
  return (bindings as Readonly<Record<string, unknown>>)[name];
}

function assertNever(value: never): never {
  internalError("INTERNAL_UNEXPECTED_LITERAL_VALUE", `Unexpected literal value: ${JSON.stringify(value)}`);
}

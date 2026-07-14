import type { Option } from "node-sql-parser";
import type {
  Dialect,
  SqlFormat,
  SqlOptions,
  SqlParamBindings,
  SqlParameterMode,
  SqlParameterPrefix,
  SqlRenderStrategy,
} from "../types.ts";
import { userError } from "../errors.ts";
import { getDefaultDialect } from "./resolve_common.ts";
import { resolveDialect } from "./resolve_dialect.ts";
import { isDialectSpec } from "./resolve_spec.ts";

/** Fully resolved renderer options. */
export type ResolvedSqlOptions = {
  dialect: ReturnType<typeof resolveDialect>;
  options?: Option;
  sqlFormat: SqlFormat;
  renderStrategy: SqlRenderStrategy;
  parameterMode: SqlParameterMode;
  parameterPrefix: SqlParameterPrefix;
  params: SqlParamBindings | undefined;
};

/** Normalize overloaded renderer options into a single resolved options object. */
export function buildSqlOptions(
  dialectOrOpt?: Dialect | SqlOptions,
  optOrFormat?: SqlOptions | SqlFormat,
  format?: SqlFormat
): ResolvedSqlOptions {
  let dialect = getDefaultDialect();
  let options: Option = {};
  let sqlFormat: SqlFormat = "compact";
  let renderStrategy: SqlRenderStrategy = "optimized";
  let parameterMode: SqlParameterMode = "inline";
  let parameterPrefix: SqlParameterPrefix = ":";
  let params: SqlParamBindings | undefined;

  if (typeof dialectOrOpt === "string") {
    dialect = resolveDialect(dialectOrOpt);
    if (typeof optOrFormat === "object" && optOrFormat) {
      ({
        dialect,
        options,
        sqlFormat,
        renderStrategy,
        parameterMode,
        parameterPrefix,
        params,
      } = applySqlOptions(optOrFormat, {
        dialect,
        options,
        sqlFormat,
        renderStrategy,
        parameterMode,
        parameterPrefix,
        params,
      }));
    }
  } else if (dialectOrOpt && typeof dialectOrOpt === "object") {
    if (isDialectSpec(dialectOrOpt)) {
      dialect = resolveDialect(dialectOrOpt);
    } else {
      ({
        dialect,
        options,
        sqlFormat,
        renderStrategy,
        parameterMode,
        parameterPrefix,
        params,
      } = applySqlOptions(dialectOrOpt, {
        dialect,
        options,
        sqlFormat,
        renderStrategy,
        parameterMode,
        parameterPrefix,
        params,
      }));
    }
  }

  if (typeof optOrFormat === "object" && optOrFormat && typeof dialectOrOpt !== "string") {
    ({
      dialect,
      options,
      sqlFormat,
      renderStrategy,
      parameterMode,
      parameterPrefix,
      params,
    } = applySqlOptions(optOrFormat, {
      dialect,
      options,
      sqlFormat,
      renderStrategy,
      parameterMode,
      parameterPrefix,
      params,
      mergeOptions: true,
    }));
  }

  if (typeof optOrFormat === "string") sqlFormat = optOrFormat;
  if (format) sqlFormat = format;

  if (options.database === undefined && dialect.parserDialect) {
    options.database = dialect.parserDialect;
  }

  return {
    dialect,
    options: Object.keys(options).length > 0 ? options : undefined,
    sqlFormat,
    renderStrategy,
    parameterMode,
    parameterPrefix,
    params,
  };
}

type SqlOptionState = {
  dialect: ReturnType<typeof resolveDialect>;
  options: Option;
  sqlFormat: SqlFormat;
  renderStrategy: SqlRenderStrategy;
  parameterMode: SqlParameterMode;
  parameterPrefix: SqlParameterPrefix;
  params: SqlParamBindings | undefined;
  mergeOptions?: boolean;
};

function applySqlOptions(input: SqlOptions, state: SqlOptionState): SqlOptionState {
  const {
    format,
    renderStrategy,
    dialect: inlineDialect,
    database: explicitDatabase,
    parameterMode: inlineParameterMode,
    parameterPrefix: inlineParameterPrefix,
    params: inlineParams,
    ...rest
  } = input;

  const nextOptions = state.mergeOptions ? { ...state.options, ...rest } : { ...rest };
  if (explicitDatabase !== undefined) {
    nextOptions.database = explicitDatabase;
  }

  return {
    dialect: inlineDialect !== undefined ? resolveDialect(inlineDialect) : state.dialect,
    options: nextOptions,
    sqlFormat: format ?? state.sqlFormat,
    renderStrategy: renderStrategy ?? state.renderStrategy,
    parameterMode: resolveParameterMode(inlineParameterMode, state.parameterMode),
    parameterPrefix: resolveParameterPrefix(inlineParameterPrefix, state.parameterPrefix),
    params: inlineParams ?? state.params,
  };
}

function resolveParameterMode(
  value: SqlParameterMode | undefined,
  fallback: SqlParameterMode
): SqlParameterMode {
  if (value === undefined) return fallback;
  if (value === "inline" || value === "named" || value === "positional") return value;
  userError(
    "INVALID_RENDERER_OPTIONS",
    "parameterMode must be inline, named, or positional"
  );
}

function resolveParameterPrefix(
  value: SqlParameterPrefix | undefined,
  fallback: SqlParameterPrefix
): SqlParameterPrefix {
  if (value === undefined) return fallback;
  if (value === ":" || value === "$" || value === "@") return value;
  userError(
    "INVALID_RENDERER_OPTIONS",
    "parameterPrefix must be one of :, $, or @"
  );
}

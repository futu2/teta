import type { Option } from "node-sql-parser";
import type {
  Dialect,
  SqlFormat,
  SqlOptions,
  SqlParameterMode,
  SqlParameterPrefix,
  SqlRenderStrategy,
} from "../../types.ts";
import { getDefaultDialect } from "./resolve_common.ts";
import { resolveDialect } from "./resolve_dialect.ts";
import { isDialectSpec } from "./resolve_spec.ts";

export type ResolvedSqlOptions = {
  dialect: ReturnType<typeof resolveDialect>;
  options?: Option;
  sqlFormat: SqlFormat;
  renderStrategy: SqlRenderStrategy;
  parameterMode: SqlParameterMode;
  parameterPrefix: SqlParameterPrefix;
};

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
      } = applySqlOptions(optOrFormat, {
        dialect,
        options,
        sqlFormat,
        renderStrategy,
        parameterMode,
        parameterPrefix,
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
      } = applySqlOptions(dialectOrOpt, {
        dialect,
        options,
        sqlFormat,
        renderStrategy,
        parameterMode,
        parameterPrefix,
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
    } = applySqlOptions(optOrFormat, {
      dialect,
      options,
      sqlFormat,
      renderStrategy,
      parameterMode,
      parameterPrefix,
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
  };
}

type SqlOptionState = {
  dialect: ReturnType<typeof resolveDialect>;
  options: Option;
  sqlFormat: SqlFormat;
  renderStrategy: SqlRenderStrategy;
  parameterMode: SqlParameterMode;
  parameterPrefix: SqlParameterPrefix;
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
    parameterMode: inlineParameterMode ?? state.parameterMode,
    parameterPrefix: inlineParameterPrefix ?? state.parameterPrefix,
  };
}

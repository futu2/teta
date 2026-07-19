import type { CteSpec } from "../core/types.ts";
import type {
  QueryDialect,
  SqlFormat,
  SqlOptions,
  SqlParameterMode,
  SqlParameterPrefix,
  SqlRenderStrategy,
  SqlResult,
} from "../sql/types.ts";
import {
  explainIR,
  irToSql,
  irToSqlResult,
  renderSql,
  renderSqlResult,
} from "../sql.ts";
import { TETA_QUERY_IR_VERSION, toPortableQueryIR } from "@teta/sql";
import type { PortableQueryIR } from "@teta/sql";
import type { SqlCompilable } from "../sql.ts";
import {
  getQueryState,
  freezeQueryValue,
  type AnyQuery,
  type Query,
  type QueryStageKind,
} from "./core.ts";
import { isQuery } from "./value.ts";
import { isExpr, parameterDescriptor } from "../core/expr/runtime.ts";
import { canonicalizeIR } from "./canonicalize.ts";
import type { QueryColumns } from "./types.ts";
import { lowerLogicalCtes, lowerLogicalStages } from "./logical.ts";
import {
  encodePreparedOptions,
  isPreparedQuery,
  type ParameterSchema,
  type PreparedQuery,
  type PreparedSqlOptions,
} from "./prepared.ts";

export type QueryIR<TColumns extends QueryColumns> = Readonly<PortableQueryIR & {
  columnNames: readonly (keyof TColumns & string)[];
}>;

export type SqlRenderable = AnyQuery | SqlCompilable;

export type QueryExplainStage = {
  index: number;
  kind: QueryStageKind;
};

export type QueryExplainCte = {
  name: string;
  kind: CteSpec["kind"];
};

export type QueryExplainResult<TColumns extends QueryColumns> = {
  ir: QueryIR<TColumns>;
  sql: string;
  params: SqlResult["params"];
  columnNames: readonly string[];
  stages: QueryExplainStage[];
  ctes: QueryExplainCte[];
  dialect: QueryDialect;
  format: SqlFormat;
  renderStrategy: SqlRenderStrategy;
  parameterMode: SqlParameterMode;
  parameterPrefix: SqlParameterPrefix;
};

export function toIR<TColumns extends QueryColumns, TSchema extends ParameterSchema>(
  query: PreparedQuery<TColumns, TSchema>
): QueryIR<TColumns>;
export function toIR<TColumns extends QueryColumns>(query: Query<TColumns>): QueryIR<TColumns>;
export function toIR<TColumns extends QueryColumns>(
  target: Query<TColumns> | PreparedQuery<TColumns, ParameterSchema>
): QueryIR<TColumns> {
  const query = isPreparedQuery(target) ? target.query as Query<TColumns> : target;
  const state = getQueryState(query);
  return freezeQueryValue(toPortableQueryIR(canonicalizeIR({
    version: TETA_QUERY_IR_VERSION,
    source: state.source,
    stages: lowerLogicalStages(state.stages, {
      scopeId: state.sourceScopeId,
      columnNames: state.sourceColumnNames,
      columnIdentifiers: state.sourceColumnIdentifiers,
    }),
    scopeId: state.sourceScopeId,
    columnNames: state.columnNames,
    columnIdentifiers: state.columnIdentifiers,
    withs: lowerLogicalCtes(state.withs),
  }))) as QueryIR<TColumns>;
}

export function toSql<TColumns extends QueryColumns, TSchema extends ParameterSchema>(
  query: PreparedQuery<TColumns, TSchema>,
  options: PreparedSqlOptions<TSchema>
): string;
export function toSql<TTarget extends AnyQuery | SqlCompilable>(
  query: TTarget,
  options?: SqlOptions
): string;
export function toSql(
  target: SqlRenderable | PreparedQuery<QueryColumns, ParameterSchema>,
  options: SqlOptions = {}
): string {
  if (isPreparedQuery(target)) {
    const prepared = target as PreparedQuery<QueryColumns, ParameterSchema>;
    return irToSql(
      toIR(prepared),
      encodePreparedOptions(prepared, options as PreparedSqlOptions<ParameterSchema>)
    );
  }
  return isQuery(target)
    ? irToSql(toIR(target as Query<QueryColumns>), encodeParameterOptions(target, options))
    : renderSql(target, encodeParameterOptions(target, options));
}

export function toSqlResult<TColumns extends QueryColumns, TSchema extends ParameterSchema>(
  query: PreparedQuery<TColumns, TSchema>,
  options: PreparedSqlOptions<TSchema>
): SqlResult;
export function toSqlResult<TTarget extends AnyQuery | SqlCompilable>(
  query: TTarget,
  options?: SqlOptions
): SqlResult;
export function toSqlResult(
  target: SqlRenderable | PreparedQuery<QueryColumns, ParameterSchema>,
  options: SqlOptions = {}
): SqlResult {
  if (isPreparedQuery(target)) {
    const prepared = target as PreparedQuery<QueryColumns, ParameterSchema>;
    return irToSqlResult(
      toIR(prepared),
      encodePreparedOptions(prepared, options as PreparedSqlOptions<ParameterSchema>)
    );
  }
  return isQuery(target)
    ? irToSqlResult(toIR(target as Query<QueryColumns>), encodeParameterOptions(target, options))
    : renderSqlResult(target, encodeParameterOptions(target, options));
}

export function explain<TColumns extends QueryColumns, TSchema extends ParameterSchema>(
  query: PreparedQuery<TColumns, TSchema>,
  options: PreparedSqlOptions<TSchema>
): QueryExplainResult<TColumns>;
export function explain<TColumns extends QueryColumns>(
  query: Query<TColumns>,
  options?: SqlOptions
): QueryExplainResult<TColumns>;
export function explain<TColumns extends QueryColumns>(
  target: Query<TColumns> | PreparedQuery<TColumns, ParameterSchema>,
  options: SqlOptions = {}
): QueryExplainResult<TColumns> {
  const prepared = isPreparedQuery(target)
    ? target as PreparedQuery<TColumns, ParameterSchema>
    : null;
  const ir = prepared ? toIR(prepared) : toIR(target as Query<TColumns>);
  const result = explainIR(
    ir,
    prepared
      ? encodePreparedOptions(prepared, options as PreparedSqlOptions<ParameterSchema>)
      : encodeParameterOptions(target, options)
  );

  return {
    ir: result.ir,
    sql: result.sql,
    params: result.params,
    columnNames: result.columnNames,
    stages: result.stages,
    ctes: result.ctes,
    dialect: result.dialect,
    format: result.format,
    renderStrategy: result.renderStrategy,
    parameterMode: result.parameterMode,
    parameterPrefix: result.parameterPrefix,
  };
}

/** Encode descriptors attached to low-level param() expressions before rendering. */
function encodeParameterOptions(target: unknown, options: SqlOptions): SqlOptions {
  if (!options.params) return options;

  type Descriptor = NonNullable<ReturnType<typeof parameterDescriptor>>;
  const descriptors = new Map<string, Descriptor[]>();
  const root = isQuery(target)
    ? getQueryState(target as Query<QueryColumns>)
    : isExpr(target)
      ? target.node
      : target;
  collectParameterDescriptors(root, descriptors, new WeakSet<object>());
  if (descriptors.size === 0) return options;

  if (Array.isArray(options.params)) {
    const bindings = options.params as readonly unknown[];
    const encoded = [...bindings];
    for (const [name, descriptorList] of descriptors) {
      const index = Number(name);
      if (!Number.isInteger(index) || index < 1 || index > encoded.length) continue;
      for (const descriptor of descriptorList) {
        encoded[index - 1] = descriptor.encode(encoded[index - 1]);
      }
    }
    return { ...options, params: encoded };
  }

  const bindings = options.params as Readonly<Record<string, unknown>>;
  const encoded = { ...bindings };
  for (const [name, descriptorList] of descriptors) {
    if (Object.hasOwn(bindings, name)) {
      for (const descriptor of descriptorList) {
        encoded[name] = descriptor.encode(encoded[name]);
      }
    }
  }
  return { ...options, params: encoded };
}

function collectParameterDescriptors(
  value: unknown,
  descriptors: Map<string, NonNullable<ReturnType<typeof parameterDescriptor>>[]>,
  seen: WeakSet<object>,
): void {
  if (!value || typeof value !== "object") return;
  const object = value as object;
  if (seen.has(object)) return;
  seen.add(object);

  const candidate = value as { kind?: unknown; name?: unknown };
  if (candidate.kind === "param" && typeof candidate.name === "string") {
    const descriptor = parameterDescriptor(object);
    if (descriptor) {
      const existing = descriptors.get(candidate.name);
      if (existing) {
        if (!existing.includes(descriptor)) existing.push(descriptor);
      } else {
        descriptors.set(candidate.name, [descriptor]);
      }
    }
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectParameterDescriptors(item, descriptors, seen));
    return;
  }
  for (const child of Object.values(value as Record<string, unknown>)) {
    collectParameterDescriptors(child, descriptors, seen);
  }
}

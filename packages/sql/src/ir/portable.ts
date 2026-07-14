import { userError } from "../errors.ts";
import { createDictionary } from "../dictionary.ts";
import type { QueryIRSqlTarget } from "../renderer_types.ts";
import { isSqlIdentifierSegment } from "./tokens.ts";
import type {
  CteSpec,
  JoinSource,
  QuerySpec,
  SqlIdentifier,
  Stage,
} from "./types.ts";
import { validateQueryIRSqlTarget } from "./validate.ts";

/** A query body in the portable cross-language IR contract. */
export type PortableQuerySpec = Omit<QuerySpec, "stages" | "columnIdentifiers"> & {
  stages: readonly PortableStage[];
};

/** A join input in the portable cross-language IR contract. */
export type PortableJoinSource =
  | (Omit<Extract<JoinSource, { kind: "table" }>, "columnIdentifiers"> & {
      columnNames: readonly string[];
    })
  | {
      kind: "subquery";
      query: PortableQuerySpec;
      inheritedBindings: Readonly<Partial<Record<string, string | null>>> | null;
    };

/** One query stage in the portable cross-language IR contract. */
export type PortableStage =
  | Exclude<Stage, { kind: "join" } | { kind: "union" } | { kind: "unnest" }>
  | (Omit<Extract<Stage, { kind: "join" }>, "source"> & {
      source: PortableJoinSource;
    })
  | Omit<Extract<Stage, { kind: "unnest" }>, "columnIdentifiers">
  | (Omit<Extract<Stage, { kind: "union" }>, "right"> & {
      right: PortableQuerySpec;
    });

/** A common table expression in the portable cross-language IR contract. */
export type PortableCteSpec =
  | { kind: "query"; name: string; query: PortableQuerySpec }
  | {
      kind: "recursive";
      name: string;
      columnNames: readonly string[];
      base: PortableQuerySpec;
      step: PortableQuerySpec;
    };

/**
 * Cross-language query IR accepted by the public renderer entrypoints.
 *
 * It deliberately excludes renderer-only column identifier maps. The SQL
 * backend derives those maps during `lowerPortableQueryIR(...)` after this
 * portable contract has been validated.
 */
export type PortableQueryIR = Omit<
  QueryIRSqlTarget,
  "stages" | "columnIdentifiers" | "withs"
> & {
  stages: readonly PortableStage[];
  withs?: readonly PortableCteSpec[];
};

/**
 * Validate the portable cross-language query IR contract.
 *
 * This rejects renderer-only metadata before deriving a private SQL render
 * plan and applying the complete semantic validator to that plan.
 */
export function validateQueryIR(value: unknown): asserts value is PortableQueryIR {
  rejectRendererMetadata(value, "query");
  validatePortableJoinColumnNames(value, "query");
  validateQueryIRSqlTarget(lowerPortableQueryIRUnchecked(value));
}

/**
 * Lower portable query IR into the renderer's private physical plan.
 *
 * Callers normally use `irToSql(...)`; this is public for renderers that need
 * a deliberate, inspectable lowering boundary.
 */
export function lowerPortableQueryIR(value: PortableQueryIR | unknown): QueryIRSqlTarget {
  validateQueryIR(value);
  return lowerPortableQueryIRUnchecked(value);
}

/** Remove private renderer metadata from a lowered SQL target. */
export function toPortableQueryIR(value: QueryIRSqlTarget): PortableQueryIR {
  return {
    version: value.version,
    source: value.source,
    stages: value.stages.map(toPortableStage),
    scopeId: value.scopeId,
    columnNames: value.columnNames,
    withs: value.withs?.map(toPortableCte),
  } as PortableQueryIR;
}

function lowerPortableQueryIRUnchecked(value: unknown): QueryIRSqlTarget {
  return lowerQueryTarget(value) as QueryIRSqlTarget;
}

function lowerQueryTarget(value: unknown): unknown {
  if (!isRecord(value)) return value;
  const stages = Array.isArray(value.stages) ? value.stages.map(lowerStage) : value.stages;
  return {
    ...value,
    stages,
    columnIdentifiers: deriveOutputIdentifiers(value.columnNames, stages),
    withs: Array.isArray(value.withs) ? value.withs.map(lowerCte) : value.withs,
  };
}

function lowerQuerySpec(value: unknown): unknown {
  if (!isRecord(value)) return value;
  const stages = Array.isArray(value.stages) ? value.stages.map(lowerStage) : value.stages;
  return {
    ...value,
    stages,
    columnIdentifiers: deriveOutputIdentifiers(value.columnNames, stages),
  };
}

function lowerCte(value: unknown): unknown {
  if (!isRecord(value)) return value;
  if (value.kind === "query") return { ...value, query: lowerQuerySpec(value.query) };
  if (value.kind === "recursive") {
    return {
      ...value,
      base: lowerQuerySpec(value.base),
      step: lowerQuerySpec(value.step),
    };
  }
  return value;
}

function lowerStage(value: unknown): unknown {
  if (!isRecord(value)) return value;
  if (value.kind === "join") {
    return {
      ...value,
      source: lowerJoinSource(value.source, value),
    };
  }
  if (value.kind === "unnest") {
    return {
      ...value,
      columnIdentifiers: identifiersForNames(value.columnNames),
    };
  }
  if (value.kind === "union") {
    return {
      ...value,
      right: lowerQuerySpec(value.right),
    };
  }
  return value;
}

function lowerJoinSource(value: unknown, _stage: Record<string, unknown>): unknown {
  if (!isRecord(value)) return value;
  if (value.kind === "subquery") return { ...value, query: lowerQuerySpec(value.query) };
  if (value.kind === "table") {
    const { columnNames, ...source } = value;
    return {
      ...source,
      columnIdentifiers: identifiersForNames(columnNames),
    };
  }
  return value;
}

function deriveOutputIdentifiers(
  columnNames: unknown,
  stages: unknown
): Readonly<Record<string, SqlIdentifier>> {
  const names = Array.isArray(columnNames) ? columnNames : [];
  const defaults = identifiersForNames(names);
  if (!Array.isArray(stages) || stages.length === 0) return defaults;
  const finalStage = stages.at(-1);
  if (!isRecord(finalStage)) return defaults;
  const items = finalStage.kind === "map" || finalStage.kind === "fold"
    ? finalStage.items
    : finalStage.projectAll;
  if (!Array.isArray(items)) return defaults;

  const output = createDictionary(defaults);
  for (const item of items) {
    if (!isRecord(item) || !isRecord(item.as)) continue;
    const { name, quoted } = item.as;
    if (
      typeof name === "string"
      && typeof quoted === "boolean"
      && Object.prototype.hasOwnProperty.call(output, name)
    ) {
      output[name] = { name, quoted };
    }
  }
  return output;
}

function identifiersForNames(value: unknown): Readonly<Record<string, SqlIdentifier>> {
  const identifiers = createDictionary<SqlIdentifier>();
  if (!Array.isArray(value)) return identifiers;
  for (const name of value) {
    if (typeof name === "string") {
      identifiers[name] = { name, quoted: !isSqlIdentifierSegment(name) };
    }
  }
  return identifiers;
}

function toPortableStage(stage: Stage): PortableStage {
  if (stage.kind === "join") {
    return {
      ...stage,
      source: stage.source.kind === "table"
        ? {
            ...withoutKey(stage.source, "columnIdentifiers"),
            columnNames: Object.keys(stage.source.columnIdentifiers),
          }
        : { ...stage.source, query: toPortableQuerySpec(stage.source.query) },
    } as PortableStage;
  }
  if (stage.kind === "unnest") return withoutKey(stage, "columnIdentifiers") as PortableStage;
  if (stage.kind === "union") return { ...stage, right: toPortableQuerySpec(stage.right) } as PortableStage;
  return stage;
}

function toPortableQuerySpec(query: QuerySpec): PortableQuerySpec {
  return {
    source: query.source,
    stages: query.stages.map(toPortableStage),
    columnNames: query.columnNames,
    scopeId: query.scopeId,
  };
}

function toPortableCte(cte: CteSpec): PortableCteSpec {
  if (cte.kind === "query") return { ...cte, query: toPortableQuerySpec(cte.query) };
  return {
    ...cte,
    base: toPortableQuerySpec(cte.base),
    step: toPortableQuerySpec(cte.step),
  };
}

function rejectRendererMetadata(value: unknown, path: string): void {
  if (!isRecord(value)) return;
  if ("columnIdentifiers" in value) {
    invalid(`${path}.columnIdentifiers`, "is renderer-only metadata and is not allowed in portable IR");
  }
  if (Array.isArray(value.stages)) {
    value.stages.forEach((stage, index) => {
      if (!isRecord(stage)) return;
      if (stage.kind === "unnest" && "columnIdentifiers" in stage) {
        invalid(
          `${path}.stages[${index}].columnIdentifiers`,
          "is renderer-only metadata and is not allowed in portable IR"
        );
      }
      if (stage.kind === "join") rejectRendererMetadata(stage.source, `${path}.stages[${index}].source`);
      if (stage.kind === "union") rejectRendererMetadata(stage.right, `${path}.stages[${index}].right`);
    });
  }
  if (Array.isArray(value.withs)) {
    value.withs.forEach((cte, index) => {
      if (!isRecord(cte)) return;
      if (cte.kind === "query") rejectRendererMetadata(cte.query, `${path}.withs[${index}].query`);
      if (cte.kind === "recursive") {
        rejectRendererMetadata(cte.base, `${path}.withs[${index}].base`);
        rejectRendererMetadata(cte.step, `${path}.withs[${index}].step`);
      }
    });
  }
}

function validatePortableJoinColumnNames(value: unknown, path: string): void {
  if (!isRecord(value)) return;
  if (Array.isArray(value.stages)) {
    value.stages.forEach((stage, index) => {
      if (!isRecord(stage)) return;
      const stagePath = `${path}.stages[${index}]`;
      if (stage.kind === "join" && isRecord(stage.source)) {
        if (stage.source.kind === "table") {
          validatePortableColumnNames(stage.source.columnNames, `${stagePath}.source.columnNames`);
        } else if (stage.source.kind === "subquery") {
          validatePortableJoinColumnNames(stage.source.query, `${stagePath}.source.query`);
        }
      }
      if (stage.kind === "union") validatePortableJoinColumnNames(stage.right, `${stagePath}.right`);
    });
  }
  if (Array.isArray(value.withs)) {
    value.withs.forEach((cte, index) => {
      if (!isRecord(cte)) return;
      if (cte.kind === "query") validatePortableJoinColumnNames(cte.query, `${path}.withs[${index}].query`);
      if (cte.kind === "recursive") {
        validatePortableJoinColumnNames(cte.base, `${path}.withs[${index}].base`);
        validatePortableJoinColumnNames(cte.step, `${path}.withs[${index}].step`);
      }
    });
  }
}

function validatePortableColumnNames(value: unknown, path: string): void {
  if (!Array.isArray(value) || value.length === 0) {
    invalid(path, "must contain at least one column name");
  }
  const names = value.filter((name): name is string => typeof name === "string");
  if (names.length !== value.length || new Set(names).size !== names.length) {
    invalid(path, "must contain unique string column names");
  }
  if (names.some((name) => !name.length || name.includes("\0"))) {
    invalid(path, "must contain non-empty column names without null characters");
  }
}

function withoutKey<T extends Record<string, unknown>, Key extends keyof T>(
  value: T,
  key: Key
): Omit<T, Key> {
  const { [key]: _discarded, ...result } = value;
  return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function invalid(path: string, message: string): never {
  userError("INVALID_QUERY_IR", `Invalid query IR at ${path}: ${message}`);
}

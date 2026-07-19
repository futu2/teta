import type {
  CteSpec,
  ExprNode,
  JoinSource,
  JoinType,
  OrderItem,
  ProjectionItem,
  QuerySpec,
  ScopeId,
  Source,
  SqlIdentifier,
  Stage,
} from "../core/types.ts";
import { columnNamesToIdentifierMap } from "./utils.ts";

/** Frontend-owned query plan before renderer projection bookkeeping is attached. */
export type LogicalQuerySpec = Readonly<{
  source: Source;
  stages: readonly LogicalStage[];
  sourceColumnNames: readonly string[];
  sourceColumnIdentifiers: Readonly<Record<string, SqlIdentifier>>;
  columnNames: readonly string[];
  columnIdentifiers: Readonly<Record<string, SqlIdentifier>>;
  scopeId: ScopeId;
}>;

export type LogicalJoinSource =
  | Extract<JoinSource, { kind: "table" | "cte" }>
  | Readonly<{
      kind: "subquery";
      query: LogicalQuerySpec;
      inheritedBindings: Readonly<Partial<Record<ScopeId, string | null>>> | null;
    }>;

export type LogicalCteSpec =
  | Readonly<{ kind: "query"; name: string; query: LogicalQuerySpec }>
  | Readonly<{
      kind: "recursive";
      name: string;
      columnNames: readonly string[];
      base: LogicalQuerySpec;
      step: LogicalQuerySpec;
    }>;

export type LogicalStage =
  | Readonly<{
      kind: "map";
      items: readonly ProjectionItem[];
      keys: readonly string[];
      outputScopeId: ScopeId;
    }>
  | Readonly<{
      kind: "fold";
      items: readonly ProjectionItem[];
      keys: readonly string[];
      groupBy: readonly ExprNode<unknown>[] | null;
      outputScopeId: ScopeId;
    }>
  | Readonly<{ kind: "filter"; predicate: ExprNode<boolean | null> }>
  | Readonly<{ kind: "sort"; items: readonly OrderItem[] }>
  | Readonly<{ kind: "distinct" }>
  | Readonly<{ kind: "take"; count: number }>
  | Readonly<{
      kind: "unnest";
      mode: "inner" | "outer";
      expr: ExprNode<unknown>;
      withOrdinality: boolean;
      as: string | null;
      columnNames: readonly string[];
      columnIdentifiers: Readonly<Record<string, SqlIdentifier>>;
      items: readonly ProjectionItem[];
      rightScopeId: ScopeId;
      outputScopeId: ScopeId;
    }>
  | Readonly<{
      kind: "join";
      joinType: JoinType;
      lateral?: boolean;
      source: LogicalJoinSource;
      as: string | null;
      on: ExprNode<boolean | null>;
      items: readonly ProjectionItem[];
      outputColumnNames: readonly string[];
      outputColumnIdentifiers: Readonly<Record<string, SqlIdentifier>>;
      rightScopeId: ScopeId;
      outputScopeId: ScopeId;
    }>
  | Readonly<{
      kind: "union";
      op: "union" | "union all";
      right: LogicalQuerySpec;
      outputScopeId: ScopeId;
    }>;

type LoweringState = {
  scopeId: ScopeId;
  columnNames: readonly string[];
  columnIdentifiers: Readonly<Record<string, SqlIdentifier>>;
};

export function lowerLogicalStages(
  stages: readonly LogicalStage[],
  initial: LoweringState
): readonly Stage[] {
  let current = initial;
  const lowered: Stage[] = [];

  for (const stage of stages) {
    const projectAll = projectCurrentRow(current);
    switch (stage.kind) {
      case "map":
        lowered.push({ ...stage, groupBy: null });
        current = projectionOutput(stage, current);
        break;
      case "fold":
        lowered.push(stage);
        current = projectionOutput(stage, current);
        break;
      case "filter":
        lowered.push({ ...stage, projectAll });
        break;
      case "sort":
        lowered.push({ ...stage, projectAll });
        break;
      case "distinct":
        lowered.push({ ...stage, projectAll });
        break;
      case "take":
        lowered.push({ ...stage, projectAll });
        break;
      case "join": {
        const { items, outputColumnNames, outputColumnIdentifiers, source, ...rest } = stage;
        lowered.push({
          ...rest,
          source: lowerLogicalJoinSource(source),
          projectAll: items,
        });
        current = {
          scopeId: stage.outputScopeId,
          columnNames: outputColumnNames,
          columnIdentifiers: outputColumnIdentifiers,
        };
        break;
      }
      case "unnest": {
        const { items, ...rest } = stage;
        lowered.push({ ...rest, projectAll: items });
        current = {
          scopeId: stage.outputScopeId,
          columnNames: outputNames(items, [...current.columnNames, ...stage.columnNames]),
          columnIdentifiers: outputIdentifiers(items),
        };
        break;
      }
      case "union":
        lowered.push({
          ...stage,
          right: lowerLogicalQuerySpec(stage.right),
          projectAll,
        });
        current = { ...current, scopeId: stage.outputScopeId };
        break;
    }
  }

  return lowered;
}

export function lowerLogicalQuerySpec(spec: LogicalQuerySpec): QuerySpec {
  return {
    source: spec.source,
    stages: lowerLogicalStages(spec.stages, {
      scopeId: spec.scopeId,
      columnNames: spec.sourceColumnNames,
      columnIdentifiers: spec.sourceColumnIdentifiers,
    }),
    columnNames: spec.columnNames,
    columnIdentifiers: spec.columnIdentifiers,
    scopeId: spec.scopeId,
  };
}

export function lowerLogicalCtes(ctes: readonly LogicalCteSpec[]): readonly CteSpec[] {
  return ctes.map((cte) => cte.kind === "query"
    ? { ...cte, query: lowerLogicalQuerySpec(cte.query) }
    : {
        ...cte,
        base: lowerLogicalQuerySpec(cte.base),
        step: lowerLogicalQuerySpec(cte.step),
      });
}

function lowerLogicalJoinSource(source: LogicalJoinSource): JoinSource {
  return source.kind === "table" || source.kind === "cte"
    ? source
    : { ...source, query: lowerLogicalQuerySpec(source.query) };
}

function projectCurrentRow(state: LoweringState): readonly ProjectionItem[] {
  return state.columnNames.map((name) => {
    const identifier = state.columnIdentifiers[name];
    return {
      expr: { kind: "column", table: state.scopeId, name },
      as: identifier?.quoted ? identifier : null,
    };
  });
}

function projectionOutput(
  stage: Extract<LogicalStage, { kind: "map" | "fold" }>,
  current: LoweringState
): LoweringState {
  return {
    scopeId: stage.outputScopeId,
    columnNames: stage.keys,
    columnIdentifiers: outputIdentifiers(stage.items, current.columnIdentifiers),
  };
}

function outputNames(items: readonly ProjectionItem[], fallback: readonly string[]): readonly string[] {
  return items.map((item, index) => item.as?.name
    ?? (item.expr.kind === "column" ? item.expr.name : fallback[index] ?? `column_${index}`));
}

function outputIdentifiers(
  items: readonly ProjectionItem[],
  fallback: Readonly<Record<string, SqlIdentifier>> = columnNamesToIdentifierMap(outputNames(items, []))
): Readonly<Record<string, SqlIdentifier>> {
  return Object.fromEntries(items.map((item, index) => {
    const name = item.as?.name ?? (item.expr.kind === "column" ? item.expr.name : `column_${index}`);
    return [name, item.as ?? fallback[name] ?? { name, quoted: false }];
  }));
}

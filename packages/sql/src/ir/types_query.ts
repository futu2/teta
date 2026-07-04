import type {
  ExprNode,
  IdentifierInput,
  JoinType,
  OrderItem,
  ProjectionItem,
  SqlIdentifier,
  Value,
} from "./types_expr.ts";
import type { GeneratedCteName, InternalCteName, ScopeId } from "./types_internal.ts";

/** Structured physical table source. */
export type StructuredTableSource = {
  db: SqlIdentifier | null;
  schema: SqlIdentifier | null;
  table: SqlIdentifier;
  as: SqlIdentifier | null;
};

/** One row in an inline `VALUES` source. */
export type ValuesRow = Readonly<Record<string, Value>>;

/** Inline row-set source used for generated `VALUES` queries. */
export type ValuesSource = {
  kind: "values";
  rows: readonly ValuesRow[];
};

/** Return true when a source is an inline `VALUES` source. */
export function isValuesSource(source: Source): source is ValuesSource {
  return "kind" in source && source.kind === "values";
}

/** User-facing table-source input accepted by normalization helpers. */
export type TableSourceInput =
  | string
  | {
      table: IdentifierInput;
      schema?: IdentifierInput | null;
      db?: IdentifierInput | null;
      as?: IdentifierInput | null;
    }
  | {
      path:
        | readonly [IdentifierInput]
        | readonly [IdentifierInput, IdentifierInput]
        | readonly [IdentifierInput, IdentifierInput, IdentifierInput];
      as?: IdentifierInput | null;
    };

/** Physical query source. */
export type Source = StructuredTableSource | ValuesSource;
/** Source reference after a table or CTE has been bound in the renderer. */
export type SourceRef =
  | {
      kind: "table";
      db: SqlIdentifier | null;
      name: SqlIdentifier;
      schema: SqlIdentifier | null;
      as: SqlIdentifier | null;
      columnIdentifiers: Readonly<Record<string, SqlIdentifier>>;
    }
  | {
      kind: "cte";
      name: GeneratedCteName | InternalCteName;
      columnIdentifiers: Readonly<Record<string, SqlIdentifier>>;
    };

/** Query body used inside CTEs, joins, and unions. */
export type QuerySpec = {
  source: Source;
  stages: readonly Stage[];
  columnNames: readonly string[];
  columnIdentifiers: Readonly<Record<string, SqlIdentifier>>;
  scopeId: ScopeId;
};

/** Right-hand source for a join stage. */
export type JoinSource =
  | {
      kind: "table";
      db: SqlIdentifier | null;
      table: SqlIdentifier;
      schema: SqlIdentifier | null;
      columnIdentifiers: Readonly<Record<string, SqlIdentifier>>;
    }
  | {
      kind: "subquery";
      query: QuerySpec;
      inheritedBindings: Readonly<Partial<Record<ScopeId, string | null>>> | null;
    };

/** Projection stage that maps rows without aggregation. */
export type MapStage = {
  kind: "map";
  items: readonly ProjectionItem[];
  keys: readonly string[];
  groupBy: null;
  outputScopeId: ScopeId;
};

/** Projection stage that may group and aggregate rows. */
export type FoldStage = {
  kind: "fold";
  items: readonly ProjectionItem[];
  keys: readonly string[];
  groupBy: readonly ExprNode<any>[] | null;
  outputScopeId: ScopeId;
};

/** Stage that replaces the current row shape with projected columns. */
export type ProjectionStage = MapStage | FoldStage;

/** Stage that adds an `ORDER BY` clause. */
export type SortStage = {
  kind: "sort";
  items: readonly OrderItem[];
  projectAll: readonly ProjectionItem[];
};

/** Stage that expands an array expression into rows. */
export type UnnestStage = {
  kind: "unnest";
  mode: "inner" | "outer";
  expr: ExprNode<unknown>;
  withOrdinality: boolean;
  as: string | null;
  columnNames: readonly string[];
  columnIdentifiers: Readonly<Record<string, SqlIdentifier>>;
  projectAll: readonly ProjectionItem[];
  rightScopeId: ScopeId;
  outputScopeId: ScopeId;
};

/** Stage that limits the number of rows. */
export type TakeStage = {
  kind: "take";
  count: number;
  projectAll: readonly ProjectionItem[];
};

/** One lowered query pipeline operation. */
export type Stage =
  | ProjectionStage
  | { kind: "filter"; predicate: ExprNode<boolean | null>; projectAll: readonly ProjectionItem[] }
  | SortStage
  | TakeStage
  | UnnestStage
  | {
      kind: "join";
      joinType: JoinType;
      lateral?: boolean;
      source: JoinSource;
      as: string | null;
      on: ExprNode<boolean | null>;
      projectAll: readonly ProjectionItem[];
      rightScopeId: ScopeId;
      outputScopeId: ScopeId;
    }
  | {
      kind: "union";
      op: "union" | "union all";
      projectAll: readonly ProjectionItem[];
      right: QuerySpec;
      outputScopeId: ScopeId;
    };

/** Root query IR before renderer-only output-column metadata is attached. */
export type QueryIR = {
  source: Source;
  stages: readonly Stage[];
  scopeId: ScopeId;
};

/** Common table expression attached to a query render target. */
export type CteSpec =
  | { kind: "query"; name: string; query: QuerySpec }
  | {
      kind: "recursive";
      name: InternalCteName;
      columnNames: readonly string[];
      base: QuerySpec;
      step: QuerySpec;
    };

/** Runtime schema type names carried by frontend column type declarations. */
export type ColumnTypeName =
  | "array"
  | "bigint"
  | "boolean"
  | "bytes"
  | "date"
  | "decimal"
  | "float"
  | "int"
  | "json"
  | "string"
  | "timestamp"
  | "uuid";

/** Schema marker used by frontends to infer query column types. */
export type ColumnType<T> = Readonly<{
  kind: "column_type";
  type: ColumnTypeName;
  nullable: boolean;
  arrayOf?: ColumnType<unknown>;
  _type?: T;
}>;

/** Infer a row shape from a schema object made of `ColumnType` values. */
export type InferSchema<S extends Record<string, ColumnType<any>>> = {
  [K in keyof S]: S[K] extends ColumnType<infer T> ? T : never;
};

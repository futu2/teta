import type {
  ExprNode,
  IdentifierInput,
  JoinType,
  OrderItem,
  SelectItem,
  SqlIdentifier,
} from "./types_expr";
import type { GeneratedCteName, InternalCteName, ScopeId } from "./types_internal";

export type StructuredTableSource = {
  db: SqlIdentifier | null;
  schema: SqlIdentifier | null;
  table: SqlIdentifier;
  as: SqlIdentifier | null;
};

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

export type Source = StructuredTableSource;
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

export type QuerySpec = {
  source: Source;
  stages: Stage[];
  columnNames: readonly string[];
  columnIdentifiers: Readonly<Record<string, SqlIdentifier>>;
  scopeId: ScopeId;
};

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

export type Stage =
  | {
      kind: "select";
      items: SelectItem[];
      keys: string[];
      groupBy: ExprNode<any>[] | null;
      outputScopeId: ScopeId;
    }
  | { kind: "filter"; predicate: ExprNode<boolean>; selectAll: SelectItem[] }
  | { kind: "orderBy"; items: OrderItem[]; selectAll: SelectItem[] }
  | { kind: "limit"; count: number; selectAll: SelectItem[] }
  | {
      kind: "join";
      joinType: JoinType;
      lateral?: boolean;
      source: JoinSource;
      as: string | null;
      on: ExprNode<boolean>;
      selectAll: SelectItem[];
      rightScopeId: ScopeId;
      outputScopeId: ScopeId;
    }
  | {
      kind: "union";
      op: "union" | "union all";
      right: QuerySpec;
      selectAll: SelectItem[];
      outputScopeId: ScopeId;
    };

export type QueryIR = {
  source: Source;
  stages: Stage[];
  scopeId: ScopeId;
};

export type CteSpec =
  | { kind: "query"; name: string; query: QuerySpec }
  | {
      kind: "recursive";
      name: InternalCteName;
      columnNames: readonly string[];
      base: QuerySpec;
      step: QuerySpec;
    };

export type ColumnType<T> = { kind: "column_type"; _type?: T };

export type InferSchema<S extends Record<string, ColumnType<any>>> = {
  [K in keyof S]: S[K] extends ColumnType<infer T> ? T : never;
};

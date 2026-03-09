import type { AST } from "node-sql-parser";
import type {
  CteSpec,
  JoinTypeInput,
  OrderItem,
  SqlIdentifier,
} from "../core/types";
import type {
  Dialect,
  SqlRenderer,
  SqlResult,
} from "../sql/types";
import { ExprRef } from "../expr";
import type {
  ColumnRefs,
  ProjectionList,
  ProjectionListResult,
  SelectResult,
  SelectSelection,
  SelectShape,
  ValidatedProjectionList,
} from "../expr";
import {
  renderPipelineAst,
  resolveDialect,
} from "../sql";
import { qualifyOuterColumns } from "./utils";
import type {
  CanonicalJoinType,
  JoinColumnMerger,
  JoinColumnsForType,
  JoinOptions,
} from "./join";
import type {
  QueryDeriveInit,
  QueryInit,
  QueryState,
} from "./state";
import {
  resolveDerivedQueryInit,
  resolveQueryInitDefaults,
} from "./state";
import {
  resolveAggregateQuery,
  resolveFilterQuery,
  resolveJoinQuery,
  resolveLimitQuery,
  resolveOrderQuery,
  resolveSelectQuery,
  resolveUnionQuery,
} from "./mutations";

/** Composable query builder with typed columns and SQL rendering. */
export class Query<TColumns extends Record<string, any>> implements QueryState<TColumns> {
  constructor(
    readonly source: QueryState<TColumns>["source"],
    readonly stages: QueryState<TColumns>["stages"],
    readonly columns: QueryState<TColumns>["columns"],
    readonly columnNames: QueryState<TColumns>["columnNames"],
    readonly sourceScopeId: QueryState<TColumns>["sourceScopeId"],
    readonly scopeId: QueryState<TColumns>["scopeId"],
    readonly withs: CteSpec[] = [],
    readonly columnIdentifiers: Readonly<Record<string, SqlIdentifier>> | null = null
  ) {}

  select<const Sel extends SelectShape>(
    selector: (cols: ColumnRefs<TColumns>) => Sel
  ): Query<SelectResult<Sel>>;
  select<const Sel extends ProjectionList>(
    selector: (cols: ColumnRefs<TColumns>) => ValidatedProjectionList<Sel>
  ): Query<ProjectionListResult<Sel>>;
  select(
    selector: (cols: ColumnRefs<TColumns>) => SelectSelection
  ): Query<Record<string, any>> {
    return this.derive(resolveSelectQuery(this, selector(this.columns)));
  }

  aggregate<const Sel extends SelectShape>(
    selector: (cols: ColumnRefs<TColumns>) => Sel
  ): Query<SelectResult<Sel>>;
  aggregate<const Sel extends ProjectionList>(
    selector: (cols: ColumnRefs<TColumns>) => ValidatedProjectionList<Sel>
  ): Query<ProjectionListResult<Sel>>;
  aggregate(
    selector: (cols: ColumnRefs<TColumns>) => SelectSelection
  ): Query<Record<string, any>> {
    return this.derive(resolveAggregateQuery(this, selector(this.columns)));
  }

  filter(
    predicate: (cols: ColumnRefs<TColumns>) => ExprRef<boolean>
  ): Query<TColumns> {
    return this.derive(resolveFilterQuery(this, predicate(this.columns).node));
  }

  orderBy(
    selector: (cols: ColumnRefs<TColumns>) => OrderItem | OrderItem[]
  ): Query<TColumns> {
    const next = selector(this.columns);
    return this.derive(resolveOrderQuery(this, Array.isArray(next) ? next : [next]));
  }

  limit(count: number): Query<TColumns> {
    return this.derive(resolveLimitQuery(this, count));
  }

  unionAll(right: Query<TColumns>): Query<TColumns> {
    return this.unionInternal(right, "union all");
  }

  union(right: Query<TColumns>): Query<TColumns> {
    return this.unionInternal(right, "union");
  }

  join<
    TRight extends Record<string, any>,
    TType extends JoinTypeInput | undefined = undefined,
    TMerged extends Record<string, any> = JoinColumnsForType<
      TColumns,
      TRight,
      CanonicalJoinType<TType>
    >,
  >(
    right: Query<TRight> | ((outer: ColumnRefs<TColumns>) => Query<TRight>),
    on: (left: ColumnRefs<TColumns>, right: ColumnRefs<TRight>) => ExprRef<boolean>,
    options: JoinOptions<TColumns, TRight, TType, TMerged> = {}
  ): Query<TMerged> {
    const outerColumns = qualifyOuterColumns(this.columns);
    const lateral = typeof right === "function" || options.lateral === true;
    const rightQuery = typeof right === "function" ? right(outerColumns) : right;
    return this.derive(
      resolveJoinQuery(
        this,
        rightQuery,
        on,
        lateral,
        options.type ?? "inner",
        options.merge as JoinColumnMerger<Record<string, any>, Record<string, any>, TMerged> | undefined
      )
    );
  }

  toIR() {
    return { source: this.source, stages: this.stages, scopeId: this.sourceScopeId };
  }

  toAst(options?: { dialect?: Dialect }): AST {
    return renderPipelineAst(
      this.source,
      this.stages,
      this.columnNames,
      this.sourceScopeId,
      {
        baseCtes: this.withs,
        dialect: options?.dialect ? resolveDialect(options.dialect) : undefined,
      }
    );
  }

  toSql(renderer: SqlRenderer<any, SqlResult>): string {
    return renderer.toSql(this);
  }

  toSqlResult<TReturn extends SqlResult>(renderer: SqlRenderer<any, TReturn>): TReturn {
    return renderer.toSqlResult(this);
  }

  private derive<TNextColumns extends Record<string, any>>(
    init: QueryDeriveInit<TNextColumns>
  ): Query<TNextColumns> {
    return createQuery(resolveDerivedQueryInit(this, init));
  }

  private unionInternal(right: Query<TColumns>, op: "union" | "union all"): Query<TColumns> {
    return this.derive(resolveUnionQuery(this, right, op));
  }
}

export function createQuery<TColumns extends Record<string, any>>(
  init: QueryInit<TColumns>
): Query<TColumns> {
  const resolved = resolveQueryInitDefaults(init);
  return new Query(
    resolved.source,
    resolved.stages,
    resolved.columns,
    resolved.columnNames,
    resolved.sourceScopeId,
    resolved.scopeId,
    resolved.withs,
    resolved.columnIdentifiers
  );
}

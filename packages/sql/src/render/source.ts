import type {
  FromAst,
  GroupByAst,
  LimitAst,
  OrderByAst,
  SelectAst,
  SelectColumnAst,
} from "./types.ts";

export type { CompileSourceRef } from "./source_ref.ts";
export { buildTableFromRef, compileSourceRef, sourceToFrom } from "./source_ref.ts";
export { compileJoinSource, hoistJoinSubquery } from "./source_join.ts";

export function buildSqlSelectAst(params: {
  from: FromAst[] | null;
  columns: SelectColumnAst[];
  where: SelectAst["where"];
  groupby: GroupByAst | null;
  having: SelectAst["having"];
  qualify: SelectAst["qualify"];
  orderby: OrderByAst[] | null;
  limit: LimitAst | null;
  distinct?: boolean;
}): SelectAst {
  return {
    with: null,
    type: "select",
    options: null,
    distinct: params.distinct ? "DISTINCT" : null,
    columns: params.columns,
    into: { position: null },
    from: params.from,
    where: params.where,
    groupby: params.groupby,
    having: params.having,
    qualify: params.qualify,
    orderby: params.orderby,
    limit: params.limit,
    locking_read: null,
    window: undefined,
    collate: null,
  };
}

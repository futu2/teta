import type {
  FromAst,
  GroupByAst,
  LimitAst,
  OrderByAst,
  SelectAst,
  SelectColumnAst,
} from "./types";

export type { CompileSourceRef } from "./source_ref";
export { buildTableFromRef, sourceToFrom } from "./source_ref";
export { compileJoinSource, hoistJoinSubquery } from "./source_join";

export function buildSelectAst(params: {
  from: FromAst[];
  columns: SelectColumnAst[];
  where: SelectAst["where"];
  groupby: GroupByAst | null;
  having: SelectAst["having"];
  qualify: SelectAst["qualify"];
  orderby: OrderByAst[] | null;
  limit: LimitAst | null;
}): SelectAst {
  return {
    with: null,
    type: "select",
    options: null,
    distinct: null,
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

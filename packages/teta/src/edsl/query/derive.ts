import type { Query } from "./core.ts";
import { createQuery } from "./core.ts";
import type { QueryDeriveInit } from "./state.ts";
import { resolveDerivedQueryInit } from "./state.ts";

type QueryColumns = Record<string, any>;

export function deriveQuery<
  TCurrentColumns extends QueryColumns,
  TNextColumns extends QueryColumns,
>(
  query: Query<TCurrentColumns>,
  init: QueryDeriveInit<TNextColumns>
): Query<TNextColumns> {
  return createQuery(resolveDerivedQueryInit(query, init));
}

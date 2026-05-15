import { assertProjectionShape, map, Query } from "./builder.ts";
import type {
  ColumnRefs,
  ProjectionResult,
  ProjectionShape,
} from "../expr.ts";
import { userError } from "../errors.ts";
import { selectColumnsByName } from "./projection_utils.ts";

type QueryColumns = Record<string, any>;
type StringKeyOf<T> = Extract<keyof T, string>;

type ExtendResult<TColumns extends QueryColumns, TExtension extends QueryColumns> =
  Omit<TColumns, StringKeyOf<TExtension>> & TExtension;

export function extend<TColumns extends QueryColumns, const Sel extends ProjectionShape>(
  selector: (cols: ColumnRefs<TColumns>) => Sel
): (query: Query<TColumns>) => Query<ExtendResult<TColumns, ProjectionResult<Sel>>>;

export function extend(...args: unknown[]): unknown {
  if (args[0] instanceof Query) {
    userError(
      "QUERY_HELPER_CURRIED_ONLY",
      "extend() is curried-only. Use pipe(query, extend(selector))."
    );
  }

  const [selectorOrSelection] = args;
  if (typeof selectorOrSelection !== "function") {
    userError("QUERY_HELPER_INVALID_SELECTOR", "extend() expects a row callback");
  }

  return (query: Query<QueryColumns>) => {
    return map((cols: ColumnRefs<QueryColumns>) => ({
      ...currentColumns(cols, query.columnNames),
      ...resolveExtensionShape(
        (selectorOrSelection as (cols: ColumnRefs<QueryColumns>) => ProjectionShape)(cols)
      ),
    }))(query);
  };
}

function resolveExtensionShape(value: unknown): ProjectionShape {
  assertProjectionShape(value);
  return value;
}

function currentColumns(
  cols: ColumnRefs<QueryColumns>,
  columnNames: readonly string[]
): ReturnType<typeof selectColumnsByName> {
  return selectColumnsByName(cols, columnNames);
}

import { assertProjectionShape, map } from "./builder.ts";
import type { Query } from "./builder.ts";
import type {
  ColumnRefs,
  ProjectionShape,
  ProjectionValue,
  ProjectionValueResult,
} from "../expr.ts";
import { userError } from "../errors.ts";
import { selectColumnsByName } from "./projection_utils.ts";

type QueryColumns = Record<string, any>;
type StringKeyOf<T> = Extract<keyof T, string>;

type ExtendResult<TColumns extends QueryColumns, TExtension extends QueryColumns> =
  Omit<TColumns, StringKeyOf<TExtension>> & TExtension;

export function extend<
  TColumns extends QueryColumns,
  const TName extends string,
  TValue extends ProjectionValue,
>(
  name: TName,
  selector: (cols: ColumnRefs<TColumns>) => TValue
): (query: Query<TColumns>) => Query<ExtendResult<TColumns, { [K in TName]: ProjectionValueResult<TValue> }>>;

export function extend(...args: unknown[]): unknown {
  if (args.length !== 2) {
    userError("QUERY_HELPER_INVALID_ARGUMENTS", "extend() expects extend(name, selector)");
  }
  if (typeof args[0] !== "string") {
    userError("QUERY_HELPER_INVALID_ARGUMENTS", "extend() expects extend(name, selector)");
  }
  if (typeof args[1] !== "function") {
    userError("QUERY_HELPER_INVALID_SELECTOR", "extend() expects a row callback");
  }

  const selector = resolveSelector(
    args[0],
    args[1] as (cols: ColumnRefs<QueryColumns>) => ProjectionValue
  );
  return (query: Query<QueryColumns>) => {
    return map((cols: ColumnRefs<QueryColumns>) => ({
      ...currentColumns(cols, query.columnNames),
      ...resolveExtensionShape(selector(cols)),
    }))(query);
  };
}

function resolveSelector(
  name: string,
  selector: (cols: ColumnRefs<QueryColumns>) => ProjectionValue
): (cols: ColumnRefs<QueryColumns>) => ProjectionShape {
  return (cols) => ({ [name]: selector(cols) });
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

import * as query from "./src/edsl/query/algebra.ts";
import * as queryRender from "./src/edsl/query/rendering.ts";
import * as expr from "./src/edsl/expr.ts";
import * as pipeModule from "./src/edsl/pipe.ts";

/** Query builder value returned by query roots and stage helpers. */
export type Query<TColumns extends import("./src/edsl/query.ts").QueryColumns> = import("./src/edsl/query.ts").Query<TColumns>;

/** Object-shaped row type carried by a query. */
export type QueryColumns = import("./src/edsl/query.ts").QueryColumns;

/** Runtime SQL type descriptor with distinct expression, input, and output types. */
export type SqlType<
  TExpression extends import("./src/edsl/query/types.ts").QueryValue,
  TInput,
  TOutput = TInput,
> = import("./src/edsl/query.ts").SqlType<TExpression, TInput, TOutput>;

/** Driver-facing row shape inferred from a query or prepared query. */
export type RowOf<TQuery> = import("./src/edsl/query.ts").RowOf<TQuery>;

/** Driver-facing value represented by a branded SQL expression type. */
export type DriverValue<T> = import("./src/edsl/query.ts").DriverValue<T>;

/** Expression type carried by a SQL type descriptor. */
export type ExpressionOf<TType> = import("./src/edsl/query.ts").ExpressionOf<TType>;

/** Accepted binding input for a SQL type descriptor. */
export type InputOf<TType> = import("./src/edsl/query.ts").InputOf<TType>;

/** Decoded driver output for a SQL type descriptor. */
export type OutputOf<TType> = import("./src/edsl/query.ts").OutputOf<TType>;

/** Decoded row shape inferred from a runtime schema descriptor map. */
export type DecodedSchema<TSchema extends import("./src/edsl/query.ts").TableSchema> = import("./src/edsl/query.ts").DecodedSchema<TSchema>;

/** Static SQL value with codec metadata removed. */
export type SqlExpressionValue<T> = import("./src/edsl/expr.ts").SqlExpressionValue<T>;

/** Canonical SQL value universe used by the v2 type system. */
export type SqlValue = import("./src/edsl/expr.ts").SqlValue;

/** SQL value with nullability added at the type level. */
export type Nullable<T> = import("./src/edsl/expr.ts").Nullable<T>;

/** SQL value with nullability removed at the type level. */
export type NonNullableSql<T> = import("./src/edsl/expr.ts").NonNullableSql<T>;

/** Null-propagating result helper used by expression signatures. */
export type PropagateSqlNull<TInput, TResult> = import("./src/edsl/expr.ts").PropagateSqlNull<TInput, TResult>;

/** Schema codec metadata carried by table column expression types. */
export type CodecValue<
  TExpression extends import("./src/edsl/expr.ts").SqlValue,
  TInput,
  TOutput,
> = import("./src/edsl/expr.ts").CodecValue<TExpression, TInput, TOutput>;

/** Decoded row shape inferred from query expression metadata. */
export type DecodedRow<TColumns extends Record<string, unknown>> = import("./src/edsl/expr.ts").DecodedRow<TColumns>;

/** Explicit unknown SQL result produced by unchecked custom expressions. */
export type UnknownValue = import("./src/edsl/expr.ts").UnknownValue;

/** Named parameter descriptor map used by `prepare`. */
export type ParameterSchema = import("./src/edsl/query.ts").ParameterSchema;

/** Typed parameter expressions supplied to a prepared-query callback. */
export type ParameterRefs<TSchema extends import("./src/edsl/query.ts").ParameterSchema> = import("./src/edsl/query.ts").ParameterRefs<TSchema>;

/** Exact runtime binding object required by a prepared query. */
export type ParameterBindings<TSchema extends import("./src/edsl/query.ts").ParameterSchema> = import("./src/edsl/query.ts").ParameterBindings<TSchema>;

/** Query paired with a declared, validated parameter schema. */
export type PreparedQuery<
  TColumns extends import("./src/edsl/query.ts").QueryColumns,
  TSchema extends import("./src/edsl/query.ts").ParameterSchema,
> = import("./src/edsl/query.ts").PreparedQuery<TColumns, TSchema>;

/** Render options requiring the exact bindings declared by a prepared query. */
export type PreparedSqlOptions<TSchema extends import("./src/edsl/query.ts").ParameterSchema> = import("./src/edsl/query.ts").PreparedSqlOptions<TSchema>;

/** Branded identity query step that can be reused with any query schema. */
export type IdentityQueryStep = import("./src/edsl/query.ts").IdentityQueryStep;

/** Explains a query's lowered stages, CTEs, and rendered SQL. */
export const explain: typeof import("./src/edsl/query.ts").explain = queryRender.explain;

/** Applies unary steps to a value from left to right. */
export const pipe: typeof import("./src/edsl/pipe.ts").pipe = pipeModule.pipe;

/** Composes unary steps from left to right into a reusable function. */
export const flow: typeof import("./src/edsl/pipe.ts").flow = pipeModule.flow;

/** Composes query steps into one frozen query step while preserving query types. */
export const composeSteps: typeof import("./src/edsl/query.ts").composeSteps = query.composeSteps;

/** Builds an aggregate projection over the current query. */
export const fold: typeof import("./src/edsl/query.ts").fold = query.fold;

/** Filters rows with a predicate expression. */
export const filter: typeof import("./src/edsl/query.ts").filter = query.filter;

/** Filters rows where two operands are equal. */
export const filterEq: typeof import("./src/edsl/query.ts").filterEq = query.filterEq;

/** Filters rows where two operands are not equal. */
export const filterNe: typeof import("./src/edsl/query.ts").filterNe = query.filterNe;

/** Filters rows where the left operand is greater than the right operand. */
export const filterGt: typeof import("./src/edsl/query.ts").filterGt = query.filterGt;

/** Filters rows where the left operand is greater than or equal to the right operand. */
export const filterGte: typeof import("./src/edsl/query.ts").filterGte = query.filterGte;

/** Filters rows where the left operand is less than the right operand. */
export const filterLt: typeof import("./src/edsl/query.ts").filterLt = query.filterLt;

/** Filters rows where the left operand is less than or equal to the right operand. */
export const filterLte: typeof import("./src/edsl/query.ts").filterLte = query.filterLte;

/** Returns a query step that leaves its input unchanged. */
export const identityStep: typeof import("./src/edsl/query.ts").identityStep = query.identityStep;

/** Applies a schema-preserving query step when a host-language condition is true. */
export const whenStep: typeof import("./src/edsl/query.ts").whenStep = query.whenStep;

/** Applies a schema-preserving query step when a host-language condition is false. */
export const unlessStep: typeof import("./src/edsl/query.ts").unlessStep = query.unlessStep;

/** Joins two query inputs with configurable join type, predicate, projection, and lateral mode. */
export const join: typeof import("./src/edsl/query.ts").join = query.join;

/** Builds an inner-join specification consumed by `join`. */
export const inner: typeof import("./src/edsl/query.ts").inner = query.inner;

/** Builds a left-join specification consumed by `join`. */
export const left: typeof import("./src/edsl/query.ts").left = query.left;

/** Builds a right-join specification consumed by `join`. */
export const right: typeof import("./src/edsl/query.ts").right = query.right;

/** Builds a full-join specification consumed by `join`. */
export const full: typeof import("./src/edsl/query.ts").full = query.full;

/** Builds a join predicate by equating same-named columns. */
export const usingCols: typeof import("./src/edsl/query.ts").usingCols = query.usingCols;

/** Builds a join predicate from left-to-right column equality mappings. */
export const onEq: typeof import("./src/edsl/query.ts").onEq = query.onEq;

/** Prefixes overlapping left join columns before merge. */
export const prefixOverlapLeft: typeof import("./src/edsl/query.ts").prefixOverlapLeft = query.prefixOverlapLeft;

/** Prefixes overlapping right join columns before merge. */
export const prefixOverlapRight: typeof import("./src/edsl/query.ts").prefixOverlapRight = query.prefixOverlapRight;

/** Prefixes all left join columns before merge. */
export const prefixAllLeft: typeof import("./src/edsl/query.ts").prefixAllLeft = query.prefixAllLeft;

/** Prefixes all right join columns before merge. */
export const prefixAllRight: typeof import("./src/edsl/query.ts").prefixAllRight = query.prefixAllRight;

/** Suffixes all left join columns before merge. */
export const suffixAllLeft: typeof import("./src/edsl/query.ts").suffixAllLeft = query.suffixAllLeft;

/** Suffixes all right join columns before merge. */
export const suffixAllRight: typeof import("./src/edsl/query.ts").suffixAllRight = query.suffixAllRight;

/** Drops overlapping columns from the left side before merge. */
export const dropOverlapLeft: typeof import("./src/edsl/query.ts").dropOverlapLeft = query.dropOverlapLeft;

/** Drops overlapping columns from the right side before merge. */
export const dropOverlapRight: typeof import("./src/edsl/query.ts").dropOverlapRight = query.dropOverlapRight;

/** Expands an array expression into rows. */
export const unnest: typeof import("./src/edsl/query.ts").unnest = query.unnest;

/** Limits the number of rows returned by a query. */
export const take: typeof import("./src/edsl/query.ts").take = query.take;

/** Keeps the first N rows within each partition according to a window ordering. */
export const takeWithin: typeof import("./src/edsl/query.ts").takeWithin = query.takeWithin;

/** Builds a recursive query from a base query and recursive step. */
export const loop: typeof import("./src/edsl/query.ts").loop = query.loop;

/** Adds an `ORDER BY` clause using sort expressions. */
export const sort: typeof import("./src/edsl/query.ts").sort = query.sort;

/** Removes duplicate rows from the current query result. */
export const distinct: typeof import("./src/edsl/query.ts").distinct = query.distinct;

/** Projects each row into a new selected shape. */
export const map: typeof import("./src/edsl/query.ts").map = query.map;

/** Drops named fields from a record without mutating the input. */
export const drop: typeof import("./src/edsl/expr.ts").drop = expr.drop;

/** Picks named fields from a record without mutating the input. */
export const pick: typeof import("./src/edsl/expr.ts").pick = expr.pick;

/** Renames every field in a record with a key-mapping function. */
export const rename: typeof import("./src/edsl/expr.ts").rename = expr.rename;

/** Schema type helpers used when declaring tables. */
export const t: typeof import("./src/edsl/query.ts").t = query.t;

/** Creates a typed query root from a table schema. */
export const table: typeof import("./src/edsl/query.ts").table = query.table;

/** Creates a typed query root from inline literal rows. */
export const values: typeof import("./src/edsl/query.ts").values = query.values;

/** Decode one driver row using a schema's runtime codecs. */
export const decodeRow: typeof import("./src/edsl/query.ts").decodeRow = query.decodeRow;

/** Decode multiple driver rows using a schema's runtime codecs. */
export const decodeRows: typeof import("./src/edsl/query.ts").decodeRows = query.decodeRows;

/** Declares typed parameters and builds a query requiring exact render-time bindings. */
export const prepare: typeof import("./src/edsl/query.ts").prepare = query.prepare;

/** Returns whether a value is a branded prepared query. */
export const isPreparedQuery: typeof import("./src/edsl/query.ts").isPreparedQuery = query.isPreparedQuery;

/** Lowers a query into Teta's intermediate representation. */
export const toIR: typeof import("./src/edsl/query.ts").toIR = queryRender.toIR;

/** Renders a query to a SQL string. */
export const toSql: typeof import("./src/edsl/query.ts").toSql = queryRender.toSql;

/** Renders a query to SQL plus bound parameter metadata. */
export const toSqlResult: typeof import("./src/edsl/query.ts").toSqlResult = queryRender.toSqlResult;

/** Combines compatible queries with `UNION`. */
export const union: typeof import("./src/edsl/query.ts").union = query.union;

/** Combines compatible queries with `UNION ALL`. */
export const unionAll: typeof import("./src/edsl/query.ts").unionAll = query.unionAll;

/** Structured output returned by `explain(...)`. */
export type QueryExplainResult<TColumns extends import("./src/edsl/query.ts").QueryColumns> = import("./src/edsl/query.ts").QueryExplainResult<TColumns>;

/** Intermediate representation produced during query lowering. */
export type QueryIR<TColumns extends import("./src/edsl/query.ts").QueryColumns> = import("./src/edsl/query.ts").QueryIR<TColumns>;

/** Frontend query or backend SQL expression/target accepted by SQL render helpers. */
export type SqlRenderable = import("./src/edsl/query.ts").SqlRenderable;

/** Kind discriminator for an individual lowered query stage. */
export type QueryStageKind = import("./src/edsl/query.ts").QueryStageKind;

/** Single step in the lowered query plan. */
export type QueryStep<
  TInputColumns extends import("./src/edsl/query.ts").QueryColumns,
  TOutputColumns extends import("./src/edsl/query.ts").QueryColumns,
> = import("./src/edsl/query.ts").QueryStep<TInputColumns, TOutputColumns>;

/** Lowercase join type accepted by the frontend query EDSL. */
export type JoinKind = import("./src/edsl/query.ts").JoinKind;

/** Options accepted by the primitive `join(...)` helper. */
export type JoinOptions<TType extends import("./src/edsl/query.ts").JoinKind | undefined = undefined> = import("./src/edsl/query.ts").JoinOptions<TType>;

/** Options accepted by the `inner`, `left`, `right`, and `full` join-spec builders. */
export type JoinSpecOptions = import("./src/edsl/query.ts").JoinSpecOptions;

/** Builder signature shared by the fixed join-spec constructors. */
export type JoinSpecBuilder<TType extends import("./src/edsl/query.ts").JoinKind> = import("./src/edsl/query.ts").JoinSpecBuilder<TType>;

/** Typed join specification consumed by `join(...)`. */
export type JoinSpec<
  TLeft extends import("./src/edsl/query.ts").QueryColumns,
  TRight extends import("./src/edsl/query.ts").QueryColumns,
  TType extends import("./src/edsl/query.ts").JoinKind,
> = import("./src/edsl/query.ts").JoinSpec<TLeft, TRight, TType>;

/** Options accepted by `takeWithin(...)`. */
export type TakeWithinSpec<TColumns extends import("./src/edsl/query.ts").QueryColumns> = import("./src/edsl/query.ts").TakeWithinSpec<TColumns>;

/** Generated column names accepted by `unnest(...)`. */
export type UnnestSelection<
  TValueName extends string,
  TOrdinalityName extends string | undefined = undefined,
> = import("./src/edsl/query.ts").UnnestSelection<TValueName, TOrdinalityName>;

/** Options accepted by `unnest(...)`. */
export type UnnestOptions<TOuter extends boolean | undefined = undefined> = import("./src/edsl/query.ts").UnnestOptions<TOuter>;

/** Typed SQL expression value used throughout the query DSL. */
export type Expr<
  T,
  TPhase extends import("./src/edsl/expr.ts").ExprPhase = "row",
> = import("./src/edsl/expr.ts").Expr<T, TPhase>;

/** Typed SQL column expression value with its projected column name. */
export type Column<T, Name extends string> = import("./src/edsl/expr.ts").Column<T, Name>;

/** Alternating condition/value pairs accepted by `when(...)`. */
export type WhenArgs<TArgs extends readonly unknown[]> = import("./src/edsl/expr.ts").WhenArgs<TArgs>;

/** Result value type inferred from alternating `when(...)` pairs. */
export type WhenResult<TArgs extends readonly unknown[]> = import("./src/edsl/expr.ts").WhenResult<TArgs>;

/** Column-reference object passed to row callbacks. */
export type ColumnRefs<T extends Record<string, unknown>> = import("./src/edsl/expr.ts").ColumnRefs<T>;

/** Expression-only object shape passed to aggregate and projection helpers. */
export type Exprs<T extends Record<string, unknown>> = import("./src/edsl/expr.ts").Exprs<T>;

/** Value accepted anywhere a SQL expression is expected. */
export type ExprInput<T> = import("./src/edsl/expr.ts").ExprInput<T>;

/** Runtime value type extracted from an expression input. */
export type ExprInputValue<TInput> = import("./src/edsl/expr.ts").ExprInputValue<TInput>;

/** Tuple of expression inputs matching a tuple of value types. */
export type ExprInputTuple<T extends readonly unknown[]> = import("./src/edsl/expr.ts").ExprInputTuple<T>;

/** Domain accepted by one catalog-checked scalar operation. */
export type OperationInputDomain = import("./src/edsl/expr.ts").OperationInputDomain;

/** Host and SQL values accepted by one catalog operation domain. */
export type OperationInputValue<TDomain extends OperationInputDomain> = import("./src/edsl/expr.ts").OperationInputValue<TDomain>;

/** Catalog argument domains for one scalar operation. */
export type OperationInputs<TName extends OperationName> = import("./src/edsl/expr.ts").OperationInputs<TName>;

/** Name of a scalar operation in the canonical backend language catalog. */
export type OperationName = import("./src/edsl/expr.ts").OperationName;

/** Result type inferred from a catalog operation and its arguments. */
export type OperationResult<TName extends OperationName, TArgs extends readonly unknown[]> = import("./src/edsl/expr.ts").OperationResult<TName, TArgs>;

/** Typed operation descriptor used by checked expression builders. */
export type OperationSpec<
  TName extends OperationName = OperationName,
  TInputs extends readonly OperationInputDomain[] = readonly OperationInputDomain[],
  TOutput extends import("@teta/sql").BuiltinFunctionResultKind = import("@teta/sql").BuiltinFunctionResultKind,
  TNullability extends import("@teta/sql").BuiltinFunctionNullability = import("@teta/sql").BuiltinFunctionNullability,
  TPhase extends ExprPhase = "row",
> = import("./src/edsl/expr.ts").OperationSpec<TName, TInputs, TOutput, TNullability, TPhase>;

/** Descriptor lookup for one canonical operation. */
export type OperationSpecOf<TName extends OperationName> = import("./src/edsl/expr.ts").OperationSpecOf<TName>;

/** Complete canonical operation catalog used by the checked EDSL. */
export type SqlOperationCatalog = import("./src/edsl/expr.ts").SqlOperationCatalog;

/** Expression phase marker used to distinguish row, group, and aggregate expressions. */
export type ExprPhase = import("./src/edsl/expr.ts").ExprPhase;

/** Non-nullable version of a SQL value type. */
export type NonNull<T> = import("./src/edsl/expr.ts").NonNull<T>;

/** Adds `null` to a result type when the input can be null. */
export type PropagateNull<TInput, TResult> = import("./src/edsl/expr.ts").PropagateNull<TInput, TResult>;

/** Window specification accepted by `over(...)`. */
export type WindowSpecInput = import("./src/edsl/expr.ts").WindowSpecInput;

/** Window function expression before a window specification is applied. */
export type WindowExpr<T> = import("./src/edsl/expr.ts").WindowExpr<T>;

/** Builder returned by window function helpers before calling `over(...)`. */
export type WindowBuilder<T> = import("./src/edsl/expr.ts").WindowBuilder<T>;

/** Value accepted in a row projection shape. */
export type ProjectionValue = import("./src/edsl/expr.ts").ProjectionValue;

/** Value accepted in an aggregate projection shape. */
export type AggregateProjectionValue = import("./src/edsl/expr.ts").AggregateProjectionValue;

/** Result type inferred for a single projection value. */
export type ProjectionValueResult<V> = import("./src/edsl/expr.ts").ProjectionValueResult<V>;

/** Object shape accepted by `map(...)`. */
export type ProjectionShape = import("./src/edsl/expr.ts").ProjectionShape;

/** Object shape accepted by `fold(...)`. */
export type AggregateProjectionShape = import("./src/edsl/expr.ts").AggregateProjectionShape;

/** Result row type inferred from a projection shape. */
export type ProjectionResult<S extends import("./src/edsl/expr.ts").ProjectionShape> = import("./src/edsl/expr.ts").ProjectionResult<S>;

/** Result row type inferred from an aggregate projection shape. */
export type AggregateProjectionResult<S extends import("./src/edsl/expr.ts").AggregateProjectionShape> = import("./src/edsl/expr.ts").AggregateProjectionResult<S>;

/** Alias for a projection object accepted by query projection helpers. */
export type ProjectionSelection = import("./src/edsl/expr.ts").ProjectionSelection;

/** Result shape produced by `pick(...)` on a record. */
export type PickRecord<T, TKeys extends readonly string[]> = import("./src/edsl/expr.ts").PickRecord<T, TKeys>;

/** Curried transform returned by `pick(...)`. */
export type PickTransform<TKeys extends readonly string[]> = import("./src/edsl/expr.ts").PickTransform<TKeys>;

/** Result shape produced by `drop(...)` on a record. */
export type DropRecord<T, TKeys extends readonly string[]> = import("./src/edsl/expr.ts").DropRecord<T, TKeys>;

/** Curried transform returned by `drop(...)`. */
export type DropTransform<TKeys extends readonly string[]> = import("./src/edsl/expr.ts").DropTransform<TKeys>;

/** Result shape produced by `rename(...)` on a record. */
export type RenameRecord<T, TPattern extends string> = import("./src/edsl/expr.ts").RenameRecord<T, TPattern>;

/** Curried transform returned by `rename(...)`. */
export type RenameTransform<TPattern extends string> = import("./src/edsl/expr.ts").RenameTransform<TPattern>;

/** Right-hand query input accepted by join helpers. */
export type JoinRightInput<
  TLeftColumns extends import("./src/edsl/query.ts").QueryColumns,
  TRightColumns extends import("./src/edsl/query.ts").QueryColumns,
> = import("./src/edsl/query.ts").JoinRightInput<TLeftColumns, TRightColumns>;

/** Returns true when a value is a Teta expression. */
export const isExpr: typeof import("./src/edsl/expr.ts").isExpr = expr.isExpr;

/** Returns true when a value is a Teta column expression. */
export const isColumn: typeof import("./src/edsl/expr.ts").isColumn = expr.isColumn;

/** Builds a portable function expression using the canonical operation catalog. */
export const checkedFn: typeof import("./src/edsl/expr.ts").checkedFn = expr.checkedFn;

/** Returns true when a value is a Teta query. */
export const isQuery: typeof import("./src/edsl/query.ts").isQuery = query.isQuery;

/** Builds an equality predicate. */
export const eq: typeof import("./src/edsl/expr.ts").eq = expr.eq;

/** Builds an inequality predicate. */
export const ne: typeof import("./src/edsl/expr.ts").ne = expr.ne;

/** Builds a greater-than predicate. */
export const gt: typeof import("./src/edsl/expr.ts").gt = expr.gt;

/** Builds a greater-than-or-equal predicate. */
export const gte: typeof import("./src/edsl/expr.ts").gte = expr.gte;

/** Builds a less-than predicate. */
export const lt: typeof import("./src/edsl/expr.ts").lt = expr.lt;

/** Builds a less-than-or-equal predicate. */
export const lte: typeof import("./src/edsl/expr.ts").lte = expr.lte;

/** Builds a SQL `LIKE` predicate. */
export const like: typeof import("./src/edsl/expr.ts").like = expr.like;

/** Builds an `IN` predicate. */
export const isIn: typeof import("./src/edsl/expr.ts").isIn = expr.isIn;

/** Builds a `NOT IN` predicate. */
export const isNotIn: typeof import("./src/edsl/expr.ts").isNotIn = expr.isNotIn;

/** Alias for `isNotIn(...)`. */
export const notIn: typeof import("./src/edsl/expr.ts").notIn = expr.notIn;

/** Builds a `BETWEEN` predicate. */
export const between: typeof import("./src/edsl/expr.ts").between = expr.between;

/** Builds an `IS DISTINCT FROM` predicate. */
export const isDistinctFrom: typeof import("./src/edsl/expr.ts").isDistinctFrom = expr.isDistinctFrom;

/** Combines predicates with logical `AND`. */
export const and: typeof import("./src/edsl/expr.ts").and = expr.and;

/** Combines predicates with logical `OR`. */
export const or: typeof import("./src/edsl/expr.ts").or = expr.or;

/** Negates a predicate expression. */
export const not: typeof import("./src/edsl/expr.ts").not = expr.not;

/** Builds an addition expression. */
export const add: typeof import("./src/edsl/expr.ts").add = expr.add;

/** Builds a subtraction expression. */
export const sub: typeof import("./src/edsl/expr.ts").sub = expr.sub;

/** Builds a multiplication expression. */
export const mul: typeof import("./src/edsl/expr.ts").mul = expr.mul;

/** Builds a division expression. */
export const div: typeof import("./src/edsl/expr.ts").div = expr.div;

/** Builds a modulo expression. */
export const mod: typeof import("./src/edsl/expr.ts").mod = expr.mod;

/** Extracts a date or time field from a temporal expression. */
export const extract: typeof import("./src/edsl/expr.ts").extract = expr.extract;

/** Builds a date truncation expression. */
export const dateTrunc: typeof import("./src/edsl/expr.ts").dateTrunc = expr.dateTrunc;

/** Builds a date arithmetic addition expression. */
export const dateAdd: typeof import("./src/edsl/expr.ts").dateAdd = expr.dateAdd;

/** Builds a date difference expression. */
export const dateDiff: typeof import("./src/edsl/expr.ts").dateDiff = expr.dateDiff;

/** Formats a temporal expression as a string. */
export const dateFormat: typeof import("./src/edsl/expr.ts").dateFormat = expr.dateFormat;

/** Parses a string expression into a temporal value. */
export const dateParse: typeof import("./src/edsl/expr.ts").dateParse = expr.dateParse;

/** Converts a temporal expression to Unix time. */
export const toUnixTime: typeof import("./src/edsl/expr.ts").toUnixTime = expr.toUnixTime;

/** Converts Unix time into a timestamp expression. */
export const fromUnixTime: typeof import("./src/edsl/expr.ts").fromUnixTime = expr.fromUnixTime;

/** Extracts the year from a temporal expression. */
export const year: typeof import("./src/edsl/expr.ts").year = expr.year;

/** Extracts the month from a temporal expression. */
export const month: typeof import("./src/edsl/expr.ts").month = expr.month;

/** Extracts the day from a temporal expression. */
export const day: typeof import("./src/edsl/expr.ts").day = expr.day;

/** Extracts the hour from a temporal expression. */
export const hour: typeof import("./src/edsl/expr.ts").hour = expr.hour;

/** Extracts the minute from a temporal expression. */
export const minute: typeof import("./src/edsl/expr.ts").minute = expr.minute;

/** Extracts the second from a temporal expression. */
export const second: typeof import("./src/edsl/expr.ts").second = expr.second;

/** Marks an expression as grouped inside `fold(...)`. */
export const group: typeof import("./src/edsl/expr.ts").group = expr.group;

/** Builds a `COUNT` aggregate expression. */
export const count: typeof import("./src/edsl/expr.ts").count = expr.count;

/** Builds a `SUM` aggregate expression. */
export const sum: typeof import("./src/edsl/expr.ts").sum = expr.sum;

/** Builds an `AVG` aggregate expression. */
export const avg: typeof import("./src/edsl/expr.ts").avg = expr.avg;

/** Builds a `MIN` aggregate expression. */
export const min: typeof import("./src/edsl/expr.ts").min = expr.min;

/** Builds a `MAX` aggregate expression. */
export const max: typeof import("./src/edsl/expr.ts").max = expr.max;

/** Builds an `ARRAY_AGG` aggregate expression. */
export const arrayAgg: typeof import("./src/edsl/expr.ts").arrayAgg = expr.arrayAgg;

/** Builds a `RANK` window function expression. */
export const rank: typeof import("./src/edsl/expr.ts").rank = expr.rank;

/** Builds a `DENSE_RANK` window function expression. */
export const denseRank: typeof import("./src/edsl/expr.ts").denseRank = expr.denseRank;

/** Builds a `ROW_NUMBER` window function expression. */
export const rowNumber: typeof import("./src/edsl/expr.ts").rowNumber = expr.rowNumber;

/** Builds a `LAG` window function expression. */
export const lag: typeof import("./src/edsl/expr.ts").lag = expr.lag;

/** Builds a `LEAD` window function expression. */
export const lead: typeof import("./src/edsl/expr.ts").lead = expr.lead;

/** Builds a `PERCENT_RANK` window function expression. */
export const percentRank: typeof import("./src/edsl/expr.ts").percentRank = expr.percentRank;

/** Builds a `NTILE` window function expression. */
export const ntile: typeof import("./src/edsl/expr.ts").ntile = expr.ntile;

/** Builds a ceiling expression. */
export const ceil: typeof import("./src/edsl/expr.ts").ceil = expr.ceil;

/** Builds a floor expression. */
export const floor: typeof import("./src/edsl/expr.ts").floor = expr.floor;

/** Builds an absolute-value expression. */
export const abs: typeof import("./src/edsl/expr.ts").abs = expr.abs;

/** Builds a square-root expression. */
export const sqrt: typeof import("./src/edsl/expr.ts").sqrt = expr.sqrt;

/** Builds a power expression. */
export const pow: typeof import("./src/edsl/expr.ts").pow = expr.pow;

/** Builds a `GREATEST` expression. */
export const greatest: typeof import("./src/edsl/expr.ts").greatest = expr.greatest;

/** Builds a `LEAST` expression. */
export const least: typeof import("./src/edsl/expr.ts").least = expr.least;

/** Builds a string replacement expression. */
export const replace: typeof import("./src/edsl/expr.ts").replace = expr.replace;

/** Builds an uppercase string expression. */
export const upper: typeof import("./src/edsl/expr.ts").upper = expr.upper;

/** Builds a lowercase string expression. */
export const lower: typeof import("./src/edsl/expr.ts").lower = expr.lower;

/** Builds a string reversal expression. */
export const reverse: typeof import("./src/edsl/expr.ts").reverse = expr.reverse;

/** Builds a trimmed string expression. */
export const trim: typeof import("./src/edsl/expr.ts").trim = expr.trim;

/** Builds a regular-expression match predicate. */
export const regexLike: typeof import("./src/edsl/expr.ts").regexLike = expr.regexLike;

/** Builds a regular-expression replacement expression. */
export const regexReplace: typeof import("./src/edsl/expr.ts").regexReplace = expr.regexReplace;

/** Builds a regular-expression extraction expression. */
export const regexExtract: typeof import("./src/edsl/expr.ts").regexExtract = expr.regexExtract;

/** Builds a substring expression. */
export const substring: typeof import("./src/edsl/expr.ts").substring = expr.substring;

/** Builds a string position expression. */
export const position: typeof import("./src/edsl/expr.ts").position = expr.position;

/** Builds a string overlay expression. */
export const overlay: typeof import("./src/edsl/expr.ts").overlay = expr.overlay;

/** Builds a character-length expression. */
export const charLength: typeof import("./src/edsl/expr.ts").charLength = expr.charLength;

/** Builds a `CHARACTER_LENGTH` expression. */
export const characterLength: typeof import("./src/edsl/expr.ts").characterLength = expr.characterLength;

/** Builds an octet-length expression. */
export const octetLength: typeof import("./src/edsl/expr.ts").octetLength = expr.octetLength;

/** Builds a bit-length expression. */
export const bitLength: typeof import("./src/edsl/expr.ts").bitLength = expr.bitLength;

/** Builds a left-substring expression. */
export const leftSubstring: typeof import("./src/edsl/expr.ts").leftSubstring = expr.leftSubstring;

/** Builds a right-substring expression. */
export const rightSubstring: typeof import("./src/edsl/expr.ts").rightSubstring = expr.rightSubstring;

/** Builds a left-padding expression. */
export const lpad: typeof import("./src/edsl/expr.ts").lpad = expr.lpad;

/** Builds a right-padding expression. */
export const rpad: typeof import("./src/edsl/expr.ts").rpad = expr.rpad;

/** Builds a string concatenation expression. */
export const concat: typeof import("./src/edsl/expr.ts").concat = expr.concat;

/** Builds an array-length expression. */
export const arrayLength: typeof import("./src/edsl/expr.ts").arrayLength = expr.arrayLength;

/** Builds an array containment predicate. */
export const arrayContains: typeof import("./src/edsl/expr.ts").arrayContains = expr.arrayContains;

/** Builds an array position lookup expression. */
export const arrayPosition: typeof import("./src/edsl/expr.ts").arrayPosition = expr.arrayPosition;

/** Builds an array slice expression. */
export const arraySlice: typeof import("./src/edsl/expr.ts").arraySlice = expr.arraySlice;

/** Builds an array join-to-string expression. */
export const arrayJoin: typeof import("./src/edsl/expr.ts").arrayJoin = expr.arrayJoin;

/** Builds an array append expression. */
export const arrayAppend: typeof import("./src/edsl/expr.ts").arrayAppend = expr.arrayAppend;

/** Builds an array prepend expression. */
export const arrayPrepend: typeof import("./src/edsl/expr.ts").arrayPrepend = expr.arrayPrepend;

/** Builds an array concatenation expression. */
export const arrayConcat: typeof import("./src/edsl/expr.ts").arrayConcat = expr.arrayConcat;

/** Builds an array de-duplication expression. */
export const arrayDistinct: typeof import("./src/edsl/expr.ts").arrayDistinct = expr.arrayDistinct;

/** Builds a `COALESCE` expression. */
export const coalesce: typeof import("./src/edsl/expr.ts").coalesce = expr.coalesce;

/** Builds a `NULLIF` expression. */
export const nullIf: typeof import("./src/edsl/expr.ts").nullIf = expr.nullIf;

/** Builds an `IS NULL` predicate. */
export const isNull: typeof import("./src/edsl/expr.ts").isNull = expr.isNull;

/** Builds an `IS NOT NULL` predicate. */
export const isNotNull: typeof import("./src/edsl/expr.ts").isNotNull = expr.isNotNull;

/** Marks an expression for ascending sort order. */
export const asc: typeof import("./src/edsl/expr.ts").asc = expr.asc;

/** Marks an expression for descending sort order. */
export const desc: typeof import("./src/edsl/expr.ts").desc = expr.desc;

/** Builds a windowed `SUM` expression. */
export const sumOver: typeof import("./src/edsl/expr.ts").sumOver = expr.sumOver;

/** Builds an explicit SQL cast expression. */
export const cast: typeof import("./src/edsl/expr.ts").cast = expr.cast;

/** Builds a cast-to-integer expression. */
export const asInt: typeof import("./src/edsl/expr.ts").asInt = expr.asInt;

/** Builds a cast-to-float expression. */
export const asFloat: typeof import("./src/edsl/expr.ts").asFloat = expr.asFloat;

/** Builds a cast-to-string expression. */
export const asString: typeof import("./src/edsl/expr.ts").asString = expr.asString;

/** Builds a cast-to-bigint expression. */
export const asBigInt: typeof import("./src/edsl/expr.ts").asBigInt = expr.asBigInt;

/** Builds a cast-to-decimal expression. */
export const asDecimal: typeof import("./src/edsl/expr.ts").asDecimal = expr.asDecimal;

/** Builds a cast-to-boolean expression. */
export const asBoolean: typeof import("./src/edsl/expr.ts").asBoolean = expr.asBoolean;

/** Builds a cast-to-date expression. */
export const asDate: typeof import("./src/edsl/expr.ts").asDate = expr.asDate;

/** Builds a cast-to-timestamp expression. */
export const asTimestamp: typeof import("./src/edsl/expr.ts").asTimestamp = expr.asTimestamp;

/** Builds a cast-to-UUID expression. */
export const asUuid: typeof import("./src/edsl/expr.ts").asUuid = expr.asUuid;

/** Builds a cast-to-bytes expression. */
export const asBytes: typeof import("./src/edsl/expr.ts").asBytes = expr.asBytes;

/** Builds a cast-to-JSON expression. */
export const asJson: typeof import("./src/edsl/expr.ts").asJson = expr.asJson;

/** Builds a rounding expression. */
export const round: typeof import("./src/edsl/expr.ts").round = expr.round;

/** Builds an array literal expression. */
export const array: typeof import("./src/edsl/expr.ts").array = expr.array;

/** Applies a window specification to a window function. */
export const over: typeof import("./src/edsl/expr.ts").over = expr.over;

/** Builds a `CASE WHEN` expression from alternating condition/value pairs. */
export const when: typeof import("./src/edsl/expr.ts").when = expr.when;

/** Maps every expression in an object shape through a transform. */
export const mapShape: typeof import("./src/edsl/expr.ts").mapShape = expr.mapShape;

/** Marks every expression in an object shape as grouped. */
export const groupShape: typeof import("./src/edsl/expr.ts").groupShape = expr.groupShape;

/** Builds a concatenated SQL string expression from a template literal. */
export const f: typeof import("./src/edsl/expr.ts").f = expr.f;

/** Wraps a literal value as an expression. */
export const lit: typeof import("./src/edsl/expr.ts").lit = expr.lit;

/** Creates a named parameter placeholder; pass runtime values with render options. */
export const param: typeof import("./src/edsl/expr.ts").param = expr.param;

/** Builds a `CURRENT_DATE` expression. */
export const currentDate: typeof import("./src/edsl/expr.ts").currentDate = expr.currentDate;

/** Builds a `CURRENT_TIMESTAMP` expression. */
export const currentTimestamp: typeof import("./src/edsl/expr.ts").currentTimestamp = expr.currentTimestamp;

/** Creates a typed SQL date literal value. */
export const dateLiteral: typeof import("./src/edsl/expr.ts").dateLiteral = expr.dateLiteral;

/** Creates a typed SQL timestamp literal value. */
export const timestampLiteral: typeof import("./src/edsl/expr.ts").timestampLiteral = expr.timestampLiteral;

/** Canonical catalog of SQL operations and dialect support metadata. */
export {
  LANGUAGE_SPEC,
  BUILTIN_FUNCTION_ARITIES,
  BUILTIN_FUNCTION_OPERATIONS,
  BUILTIN_FUNCTION_SPECS,
  getLanguageSpec,
} from "./src/edsl/sql/language.ts";

export type { LanguageCategory } from "./src/edsl/sql/language.ts";

export type {
  BuiltinDialect,
  Dialect,
  DialectFeatures,
  DialectLanguageConfig,
  DialectLanguageFallback,
  DialectSpec,
  DialectSupportTier,
  IdentifierInput,
  QueryDialect,
  SqlBigInt,
  SqlBoolean,
  SqlBytes,
  SqlDate,
  SqlDecimal,
  SqlFloat,
  SqlFormat,
  SqlIdentifier,
  SqlInt,
  SqlJson,
  SqlNumber,
  SqlOptions,
  SqlParam,
  SqlParameterMode,
  SqlParameterPrefix,
  SqlRenderStrategy,
  SqlResult,
  SqlString,
  SqlTimestamp,
  SqlUnknown,
  SqlUuid,
} from "./src/edsl/types.ts";

/** Public Teta error classes and guards. */
export {
  TetaError,
  TetaInternalError,
  TetaUserError,
  isTetaError,
  isTetaErrorCode,
  TETA_ERROR_CODES,
} from "@teta/sql";
export type {
  TetaErrorCode,
  TetaErrorKind,
} from "@teta/sql";

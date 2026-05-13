/**
 * Public API for `@teta/teta`.
 *
 * Import query builders, expression helpers, and SQL rendering types from this module.
 */
import * as query from "./src/edsl/query.ts";
import * as expr from "./src/edsl/expr.ts";
import * as pipeModule from "./src/edsl/pipe.ts";
import * as language from "./src/edsl/sql/language.ts";
import * as sql from "@teta/sql";

/** Query builder class returned by query roots and stage helpers. */
export const Query: typeof import("./src/edsl/query.ts").Query = query.Query;
export type Query<TColumns extends Record<string, any>> = import("./src/edsl/query.ts").Query<TColumns>;

/** Explains a query's lowered stages, CTEs, and rendered SQL. */
export const explain: typeof import("./src/edsl/query.ts").explain = query.explain;

/** Applies unary steps to a value from left to right. */
export const pipe: typeof import("./src/edsl/pipe.ts").pipe = pipeModule.pipe;

/** Composes unary steps from left to right into a reusable function. */
export const flow: typeof import("./src/edsl/pipe.ts").flow = pipeModule.flow;

/** Builds an aggregate projection over the current query. */
export const fold: typeof import("./src/edsl/query.ts").fold = query.fold;

/** Filters rows with a predicate expression. */
export const filter: typeof import("./src/edsl/query.ts").filter = query.filter;

/** Joins two query inputs as an inner join. */
export const innerJoin: typeof import("./src/edsl/query.ts").innerJoin = query.innerJoin;

/** Joins two query inputs as a left join. */
export const leftJoin: typeof import("./src/edsl/query.ts").leftJoin = query.leftJoin;

/** Joins two query inputs as a right join. */
export const rightJoin: typeof import("./src/edsl/query.ts").rightJoin = query.rightJoin;

/** Joins two query inputs as a full join. */
export const fullJoin: typeof import("./src/edsl/query.ts").fullJoin = query.fullJoin;

/** Joins two query inputs with an explicit join condition. */
export const join: typeof import("./src/edsl/query.ts").join = query.join;

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

/** Builds a recursive query from a base query and recursive step. */
export const loop: typeof import("./src/edsl/query.ts").loop = query.loop;

/** Adds an `ORDER BY` clause using sort expressions. */
export const sort: typeof import("./src/edsl/query.ts").sort = query.sort;

/** Projects each row into a new selected shape. */
export const map: typeof import("./src/edsl/query.ts").map = query.map;

/** Schema type helpers used when declaring tables. */
export const t: typeof import("./src/edsl/query.ts").t = query.t;

/** Creates a typed query root from a table schema. */
export const table: typeof import("./src/edsl/query.ts").table = query.table;

/** Creates a typed query root from inline literal rows. */
export const values: typeof import("./src/edsl/query.ts").values = query.values;

/** Lowers a query into the SQL AST used by the renderer. */
export const toAst: typeof import("./src/edsl/query.ts").toAst = query.toAst;

/** Lowers a query into Teta's intermediate representation. */
export const toIR: typeof import("./src/edsl/query.ts").toIR = query.toIR;

/** Renders a query to a SQL string. */
export const toSql: typeof import("./src/edsl/query.ts").toSql = query.toSql;

/** Renders a query to SQL plus bound parameter metadata. */
export const toSqlResult: typeof import("./src/edsl/query.ts").toSqlResult = query.toSqlResult;

/** Combines compatible queries with `UNION`. */
export const union: typeof import("./src/edsl/query.ts").union = query.union;

/** Combines compatible queries with `UNION ALL`. */
export const unionAll: typeof import("./src/edsl/query.ts").unionAll = query.unionAll;

/** Structured output returned by `explain(...)`. */
export type QueryExplainResult<TColumns extends Record<string, any>> = import("./src/edsl/query.ts").QueryExplainResult<TColumns>;

/** Intermediate representation produced during query lowering. */
export type QueryIR<TColumns extends Record<string, any>> = import("./src/edsl/query.ts").QueryIR<TColumns>;

/** Kind discriminator for an individual lowered query stage. */
export type QueryStageKind = import("./src/edsl/query.ts").QueryStageKind;

/** Single step in the lowered query plan. */
export type QueryStep<TInputColumns extends Record<string, any>, TOutputColumns extends Record<string, any>> = import("./src/edsl/query.ts").QueryStep<TInputColumns, TOutputColumns>;

/** Typed SQL expression reference used throughout the query DSL. */
export const ExprRef: typeof import("./src/edsl/expr.ts").ExprRef = expr.ExprRef;
export type ExprRef<
  T,
  TDeps extends import("./src/edsl/expr.ts").DeferredExprDeps = import("./src/edsl/expr.ts").EmptyDeferredExprDeps,
> = import("./src/edsl/expr.ts").ExprRef<T, TDeps>;
export type DeferredExprDeps = import("./src/edsl/expr.ts").DeferredExprDeps;
export type DeferredExprDepsForArgs<TItems extends readonly unknown[]> = import("./src/edsl/expr.ts").DeferredExprDepsForArgs<TItems>;
export type DeferredExprDepsOf<TExpr> = import("./src/edsl/expr.ts").DeferredExprDepsOf<TExpr>;
export type DeferredExprDepScope = import("./src/edsl/expr.ts").DeferredExprDepScope;
export type EmptyDeferredExprDeps = import("./src/edsl/expr.ts").EmptyDeferredExprDeps;

/** Builds an equality predicate. */
export const eq: typeof import("./src/edsl/expr.ts").eq = expr.eq;

/** Deferred reference to a column on the current query row. */
export const $: typeof import("./src/edsl/expr.ts").$ = expr.$;

/** Deferred reference to a column on the left side of a join. */
export const $left: typeof import("./src/edsl/expr.ts").$left = expr.$left;

/** Deferred reference to a column on the right side of a join. */
export const $right: typeof import("./src/edsl/expr.ts").$right = expr.$right;

/** Deferred reference to a named column on the current query row. */
export const col: typeof import("./src/edsl/expr.ts").col = expr.col;

/** Deferred reference to a named column on the left side of a join. */
export const leftCol: typeof import("./src/edsl/expr.ts").leftCol = expr.leftCol;

/** Deferred reference to a named column on the right side of a join. */
export const rightCol: typeof import("./src/edsl/expr.ts").rightCol = expr.rightCol;

/** Keeps only the named columns in their provided order. */
export const pick: typeof import("./src/edsl/query.ts").pick = query.pick;

/** Drops the named columns and keeps the remaining columns in query order. */
export const drop: typeof import("./src/edsl/query.ts").drop = query.drop;

/** Renames every projected column with the provided key mapper. */
export const rename: typeof import("./src/edsl/query.ts").rename = query.rename;

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
export const left: typeof import("./src/edsl/expr.ts").left = expr.left;

/** Builds a right-substring expression. */
export const right: typeof import("./src/edsl/expr.ts").right = expr.right;

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
export const toInt: typeof import("./src/edsl/expr.ts").toInt = expr.toInt;

/** Builds a cast-to-float expression. */
export const toFloat: typeof import("./src/edsl/expr.ts").toFloat = expr.toFloat;

/** Builds a cast-to-string expression. */
export const toString: typeof import("./src/edsl/expr.ts").toString = expr.toString;

/** Builds a cast-to-date expression. */
export const toDate: typeof import("./src/edsl/expr.ts").toDate = expr.toDate;

/** Builds a cast-to-timestamp expression. */
export const toTimestamp: typeof import("./src/edsl/expr.ts").toTimestamp = expr.toTimestamp;

/** Builds a rounding expression. */
export const round: typeof import("./src/edsl/expr.ts").round = expr.round;

/** Builds an array literal expression. */
export const array: typeof import("./src/edsl/expr.ts").array = expr.array;

/** Builds a generic SQL function call expression. */
export const fn: typeof import("./src/edsl/expr.ts").fn = expr.fn;

/** Builds a generic SQL window function before applying `over(...)`. */
export const windowFn: typeof import("./src/edsl/expr.ts").windowFn = expr.windowFn;

/** Applies a window specification to a window function. */
export const over: typeof import("./src/edsl/expr.ts").over = expr.over;

/** Builds a `CASE WHEN` expression. */
export const caseWhen: typeof import("./src/edsl/expr.ts").caseWhen = expr.caseWhen;

/** Creates a single branch for `caseWhen(...)`. */
export const when: typeof import("./src/edsl/expr.ts").when = expr.when;

/** Maps every expression in an object shape through a transform. */
export const mapShape: typeof import("./src/edsl/expr.ts").mapShape = expr.mapShape;

/** Marks every expression in an object shape as grouped. */
export const groupShape: typeof import("./src/edsl/expr.ts").groupShape = expr.groupShape;

/** Builds a concatenated SQL string expression from a template literal. */
export const f: typeof import("./src/edsl/expr.ts").f = expr.f;

/** Wraps a literal value as an expression. */
export const lit: typeof import("./src/edsl/expr.ts").lit = expr.lit;

/** Wraps a runtime parameter value for bound SQL rendering. */
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
export const LANGUAGE_SPEC: typeof import("./src/edsl/sql/language.ts").LANGUAGE_SPEC = language.LANGUAGE_SPEC;

/** Looks up language-spec metadata for a named SQL operation. */
export const getLanguageSpec: typeof import("./src/edsl/sql/language.ts").getLanguageSpec = language.getLanguageSpec;

/** Top-level category name used in the language specification. */
export type LanguageCategory = import("./src/edsl/sql/language.ts").LanguageCategory;

/** Expression-like input accepted by SQL rendering helpers. */
export type ExprSqlTarget = import("./src/edsl/sql.ts").ExprSqlTarget;

/** Query-like input accepted by SQL rendering helpers. */
export type QuerySqlTarget = import("./src/edsl/sql.ts").QuerySqlTarget;

/** Union of public values that can be compiled to SQL. */
export type SqlCompilable = import("./src/edsl/sql.ts").SqlCompilable;

/** Names of the built-in SQL dialects supported by Teta. */
export type BuiltinDialect = import("./src/edsl/types.ts").BuiltinDialect;

/** Dialect-specific language overrides and fallbacks. */
export type DialectLanguageConfig = import("./src/edsl/types.ts").DialectLanguageConfig;

/** Fallback rewrite applied when a dialect lacks a direct operation. */
export type DialectLanguageFallback = import("./src/edsl/types.ts").DialectLanguageFallback;

/** Feature flags that describe renderer behavior for a dialect. */
export type DialectFeatures = import("./src/edsl/types.ts").DialectFeatures;

/** Full dialect specification used by the SQL renderer. */
export type DialectSpec = import("./src/edsl/types.ts").DialectSpec;

/** Resolved dialect configuration used while rendering a query. */
export type QueryDialect = import("./src/edsl/types.ts").QueryDialect;

/** Type marker for SQL integer expressions and columns. */
export type SqlInt = import("./src/edsl/types.ts").SqlInt;

/** Type marker for SQL floating-point expressions and columns. */
export type SqlFloat = import("./src/edsl/types.ts").SqlFloat;

/** Type marker for SQL bigint expressions and columns. */
export type SqlBigInt = import("./src/edsl/types.ts").SqlBigInt;

/** Type marker for SQL decimal expressions and columns. */
export type SqlDecimal = import("./src/edsl/types.ts").SqlDecimal;

/** Union of numeric SQL type markers. */
export type SqlNumber = import("./src/edsl/types.ts").SqlNumber;

/** Type marker for SQL date expressions and columns. */
export type SqlDate = import("./src/edsl/types.ts").SqlDate;

/** Type marker for SQL timestamp expressions and columns. */
export type SqlTimestamp = import("./src/edsl/types.ts").SqlTimestamp;

/** Type marker for SQL UUID expressions and columns. */
export type SqlUuid = import("./src/edsl/types.ts").SqlUuid;

/** Type marker for SQL binary or blob expressions and columns. */
export type SqlBytes = import("./src/edsl/types.ts").SqlBytes;

/** Type marker for SQL JSON expressions and columns. */
export type SqlJson<T = unknown> = import("./src/edsl/types.ts").SqlJson<T>;

/** Dialect input accepted by the render APIs. */
export type Dialect = import("./src/edsl/types.ts").Dialect;

/** Formatting mode for generated SQL strings. */
export type SqlFormat = import("./src/edsl/types.ts").SqlFormat;

/** Strategy controlling how aggressively query stages are fused. */
export type SqlRenderStrategy = import("./src/edsl/types.ts").SqlRenderStrategy;

/** Options for rendering queries or expressions to SQL. */
export type SqlOptions = import("./src/edsl/types.ts").SqlOptions;

/** Metadata describing one bound SQL parameter. */
export type SqlParam = import("./src/edsl/types.ts").SqlParam;

/** Parameter binding style used in rendered SQL. */
export type SqlParameterMode = import("./src/edsl/types.ts").SqlParameterMode;

/** Prefix style used for named SQL parameters. */
export type SqlParameterPrefix = import("./src/edsl/types.ts").SqlParameterPrefix;

/** Rendered SQL plus its collected parameter metadata. */
export type SqlResult = import("./src/edsl/types.ts").SqlResult;

/** Input type accepted by identifier-quoting helpers. */
export type IdentifierInput = import("./src/edsl/types.ts").IdentifierInput;

/** Branded type representing a SQL identifier fragment. */
export type SqlIdentifier = import("./src/edsl/types.ts").SqlIdentifier;

/** Base class for public Teta errors. */
export const TetaError: typeof import("@teta/sql").TetaError = sql.TetaError;
export type TetaError = import("@teta/sql").TetaError;

/** Error raised when Teta detects an internal compiler failure. */
export const TetaInternalError: typeof import("@teta/sql").TetaInternalError = sql.TetaInternalError;
export type TetaInternalError = import("@teta/sql").TetaInternalError;

/** Error raised for invalid user input or unsupported queries. */
export const TetaUserError: typeof import("@teta/sql").TetaUserError = sql.TetaUserError;
export type TetaUserError = import("@teta/sql").TetaUserError;

/** Checks whether a value is one of Teta's public error types. */
export const isTetaError: typeof import("@teta/sql").isTetaError = sql.isTetaError;

/** String code identifying a specific Teta error condition. */
export type TetaErrorCode = import("@teta/sql").TetaErrorCode;

/** High-level category assigned to a Teta error. */
export type TetaErrorKind = import("@teta/sql").TetaErrorKind;

/**
 * Public API for `@teta/teta`.
 *
 * Import query builders, expression helpers, SQL rendering types, and development utilities from this module.
 * @module
 */
import * as query from "./src/edsl/query.ts";
import * as expr from "./src/edsl/expr.ts";
import * as language from "./src/edsl/sql/language.ts";
import * as errors from "./src/edsl/errors.ts";
import * as dev from "./src/edsl/dev.ts";

/** Query builder class returned by `table(...)` and query stage helpers. */
export const Query = query.Query;
export type Query<TColumns extends Record<string, any>> = import("./src/edsl/query.ts").Query<TColumns>;

/** Explains a query's lowered stages, CTEs, and rendered SQL. */
export const explain = query.explain;

/** Builds an aggregate projection over the current query. */
export const fold = query.fold;

/** Filters rows with a predicate expression. */
export const filter = query.filter;

/** Joins two query inputs with an explicit join condition. */
export const join = query.join;

/** Limits the number of rows returned by a query. */
export const take = query.take;

/** Builds a recursive query from a base query and recursive step. */
export const loop = query.loop;

/** Adds an `ORDER BY` clause using sort expressions. */
export const sort = query.sort;

/** Projects each row into a new selected shape. */
export const map = query.map;

/** Schema type helpers used when declaring tables. */
export const t = query.t;

/** Creates a typed query root from a table schema. */
export const table = query.table;

/** Lowers a query into the SQL AST used by the renderer. */
export const toAst = query.toAst;

/** Lowers a query into Teta's intermediate representation. */
export const toIR = query.toIR;

/** Renders a query to a SQL string. */
export const toSql = query.toSql;

/** Renders a query to SQL plus bound parameter metadata. */
export const toSqlResult = query.toSqlResult;

/** Combines compatible queries with `UNION`. */
export const union = query.union;

/** Combines compatible queries with `UNION ALL`. */
export const unionAll = query.unionAll;

/** Structured output returned by `explain(...)`. */
export type QueryExplainResult<TColumns extends Record<string, any>> = import("./src/edsl/query.ts").QueryExplainResult<TColumns>;

/** Intermediate representation produced during query lowering. */
export type QueryIR<TColumns extends Record<string, any>> = import("./src/edsl/query.ts").QueryIR<TColumns>;

/** Kind discriminator for an individual lowered query stage. */
export type QueryStageKind = import("./src/edsl/query.ts").QueryStageKind;

/** Single step in the lowered query plan. */
export type QueryStep<TInputColumns extends Record<string, any>, TOutputColumns extends Record<string, any>> = import("./src/edsl/query.ts").QueryStep<TInputColumns, TOutputColumns>;

/** Typed SQL expression reference used throughout the query DSL. */
export const ExprRef = expr.ExprRef;
export type ExprRef<T> = import("./src/edsl/expr.ts").ExprRef<T>;

/** Builds an equality predicate. */
export const eq = expr.eq;

/** Builds an inequality predicate. */
export const ne = expr.ne;

/** Builds a greater-than predicate. */
export const gt = expr.gt;

/** Builds a greater-than-or-equal predicate. */
export const gte = expr.gte;

/** Builds a less-than predicate. */
export const lt = expr.lt;

/** Builds a less-than-or-equal predicate. */
export const lte = expr.lte;

/** Builds a SQL `LIKE` predicate. */
export const like = expr.like;

/** Builds an `IN` predicate. */
export const isIn = expr.isIn;

/** Combines predicates with logical `AND`. */
export const and = expr.and;

/** Combines predicates with logical `OR`. */
export const or = expr.or;

/** Negates a predicate expression. */
export const not = expr.not;

/** Builds an addition expression. */
export const add = expr.add;

/** Builds a subtraction expression. */
export const sub = expr.sub;

/** Builds a multiplication expression. */
export const mul = expr.mul;

/** Builds a division expression. */
export const div = expr.div;

/** Builds a modulo expression. */
export const mod = expr.mod;

/** Extracts a date or time field from a temporal expression. */
export const extract = expr.extract;

/** Builds a date truncation expression. */
export const dateTrunc = expr.dateTrunc;

/** Builds a date arithmetic addition expression. */
export const dateAdd = expr.dateAdd;

/** Builds a date difference expression. */
export const dateDiff = expr.dateDiff;

/** Formats a temporal expression as a string. */
export const dateFormat = expr.dateFormat;

/** Parses a string expression into a temporal value. */
export const dateParse = expr.dateParse;

/** Converts a temporal expression to Unix time. */
export const toUnixTime = expr.toUnixTime;

/** Converts Unix time into a timestamp expression. */
export const fromUnixTime = expr.fromUnixTime;

/** Extracts the year from a temporal expression. */
export const year = expr.year;

/** Extracts the month from a temporal expression. */
export const month = expr.month;

/** Extracts the day from a temporal expression. */
export const day = expr.day;

/** Extracts the hour from a temporal expression. */
export const hour = expr.hour;

/** Extracts the minute from a temporal expression. */
export const minute = expr.minute;

/** Extracts the second from a temporal expression. */
export const second = expr.second;

/** Marks an expression as grouped inside `fold(...)`. */
export const group = expr.group;

/** Builds a `COUNT` aggregate expression. */
export const count = expr.count;

/** Builds a `SUM` aggregate expression. */
export const sum = expr.sum;

/** Builds an `AVG` aggregate expression. */
export const avg = expr.avg;

/** Builds a `MIN` aggregate expression. */
export const min = expr.min;

/** Builds a `MAX` aggregate expression. */
export const max = expr.max;

/** Builds a `RANK` window function expression. */
export const rank = expr.rank;

/** Builds a `DENSE_RANK` window function expression. */
export const denseRank = expr.denseRank;

/** Builds a `ROW_NUMBER` window function expression. */
export const rowNumber = expr.rowNumber;

/** Builds a `LAG` window function expression. */
export const lag = expr.lag;

/** Builds a `LEAD` window function expression. */
export const lead = expr.lead;

/** Builds a `PERCENT_RANK` window function expression. */
export const percentRank = expr.percentRank;

/** Builds a `NTILE` window function expression. */
export const ntile = expr.ntile;

/** Builds a ceiling expression. */
export const ceil = expr.ceil;

/** Builds a floor expression. */
export const floor = expr.floor;

/** Builds an absolute-value expression. */
export const abs = expr.abs;

/** Builds a square-root expression. */
export const sqrt = expr.sqrt;

/** Builds a power expression. */
export const pow = expr.pow;

/** Builds a `GREATEST` expression. */
export const greatest = expr.greatest;

/** Builds a `LEAST` expression. */
export const least = expr.least;

/** Builds a string replacement expression. */
export const replace = expr.replace;

/** Builds an uppercase string expression. */
export const upper = expr.upper;

/** Builds a lowercase string expression. */
export const lower = expr.lower;

/** Builds a string reversal expression. */
export const reverse = expr.reverse;

/** Builds a trimmed string expression. */
export const trim = expr.trim;

/** Builds a regular-expression match predicate. */
export const regexLike = expr.regexLike;

/** Builds a regular-expression replacement expression. */
export const regexReplace = expr.regexReplace;

/** Builds a regular-expression extraction expression. */
export const regexExtract = expr.regexExtract;

/** Builds a substring expression. */
export const substring = expr.substring;

/** Builds a string position expression. */
export const position = expr.position;

/** Builds a string overlay expression. */
export const overlay = expr.overlay;

/** Builds a character-length expression. */
export const charLength = expr.charLength;

/** Builds a `CHARACTER_LENGTH` expression. */
export const characterLength = expr.characterLength;

/** Builds an octet-length expression. */
export const octetLength = expr.octetLength;

/** Builds a bit-length expression. */
export const bitLength = expr.bitLength;

/** Builds a left-substring expression. */
export const left = expr.left;

/** Builds a right-substring expression. */
export const right = expr.right;

/** Builds a left-padding expression. */
export const lpad = expr.lpad;

/** Builds a right-padding expression. */
export const rpad = expr.rpad;

/** Builds a string concatenation expression. */
export const concat = expr.concat;

/** Builds an array-length expression. */
export const arrayLength = expr.arrayLength;

/** Builds an array containment predicate. */
export const arrayContains = expr.arrayContains;

/** Builds an array position lookup expression. */
export const arrayPosition = expr.arrayPosition;

/** Builds an array slice expression. */
export const arraySlice = expr.arraySlice;

/** Builds an array join-to-string expression. */
export const arrayJoin = expr.arrayJoin;

/** Builds an array append expression. */
export const arrayAppend = expr.arrayAppend;

/** Builds an array prepend expression. */
export const arrayPrepend = expr.arrayPrepend;

/** Builds an array concatenation expression. */
export const arrayConcat = expr.arrayConcat;

/** Builds an array de-duplication expression. */
export const arrayDistinct = expr.arrayDistinct;

/** Builds a `COALESCE` expression. */
export const coalesce = expr.coalesce;

/** Builds a `NULLIF` expression. */
export const nullIf = expr.nullIf;

/** Builds an `IS NULL` predicate. */
export const isNull = expr.isNull;

/** Builds an `IS NOT NULL` predicate. */
export const isNotNull = expr.isNotNull;

/** Marks an expression for ascending sort order. */
export const asc = expr.asc;

/** Marks an expression for descending sort order. */
export const desc = expr.desc;

/** Builds a windowed `SUM` expression. */
export const sumOver = expr.sumOver;

/** Builds an explicit SQL cast expression. */
export const cast = expr.cast;

/** Builds a cast-to-integer expression. */
export const toInt = expr.toInt;

/** Builds a cast-to-float expression. */
export const toFloat = expr.toFloat;

/** Builds a cast-to-date expression. */
export const toDate = expr.toDate;

/** Builds a rounding expression. */
export const round = expr.round;

/** Builds an array literal expression. */
export const array = expr.array;

/** Builds a generic SQL function call expression. */
export const fn = expr.fn;

/** Builds a generic SQL window function before applying `over(...)`. */
export const windowFn = expr.windowFn;

/** Applies a window specification to a window function. */
export const over = expr.over;

/** Builds a `CASE WHEN` expression. */
export const caseWhen = expr.caseWhen;

/** Creates a single branch for `caseWhen(...)`. */
export const when = expr.when;

/** Maps every expression in an object shape through a transform. */
export const mapShape = expr.mapShape;

/** Marks every expression in an object shape as grouped. */
export const groupShape = expr.groupShape;

/** Builds a concatenated SQL string expression from a template literal. */
export const f = expr.f;

/** Wraps a literal value as an expression. */
export const lit = expr.lit;

/** Wraps a runtime parameter value for bound SQL rendering. */
export const param = expr.param;

/** Builds a `CURRENT_DATE` expression. */
export const currentDate = expr.currentDate;

/** Builds a `CURRENT_TIMESTAMP` expression. */
export const currentTimestamp = expr.currentTimestamp;

/** Creates a typed SQL date literal value. */
export const dateLiteral = expr.dateLiteral;

/** Creates a typed SQL timestamp literal value. */
export const timestampLiteral = expr.timestampLiteral;

/** Canonical catalog of SQL operations and dialect support metadata. */
export const LANGUAGE_SPEC = language.LANGUAGE_SPEC;

/** Looks up language-spec metadata for a named SQL operation. */
export const getLanguageSpec = language.getLanguageSpec;

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
export const TetaError = errors.TetaError;
export type TetaError = import("./src/edsl/errors.ts").TetaError;

/** Error raised when Teta detects an internal compiler failure. */
export const TetaInternalError = errors.TetaInternalError;
export type TetaInternalError = import("./src/edsl/errors.ts").TetaInternalError;

/** Error raised for invalid user input or unsupported queries. */
export const TetaUserError = errors.TetaUserError;
export type TetaUserError = import("./src/edsl/errors.ts").TetaUserError;

/** Checks whether a value is one of Teta's public error types. */
export const isTetaError = errors.isTetaError;

/** String code identifying a specific Teta error condition. */
export type TetaErrorCode = import("./src/edsl/errors.ts").TetaErrorCode;

/** High-level category assigned to a Teta error. */
export type TetaErrorKind = import("./src/edsl/errors.ts").TetaErrorKind;

/** Clipboard backend names supported by `copyTextToClipboard(...)`. */
export type ClipboardTool = import("./src/edsl/dev.ts").ClipboardTool;

/** Copies text to the system clipboard using the requested backend when available. */
export const copyTextToClipboard = dev.copyTextToClipboard;

/** Module export shapes accepted by `renderSqlFromSource(...)`. */
export type QueryLike = import("./src/edsl/dev.ts").QueryLike;

/** Loads a source module and renders SQL from one of its exports. */
export const renderSqlFromSource = dev.renderSqlFromSource;

/** Controller returned by `watchQuerySourceToClipboard(...)`. */
export type WatchQueryController = import("./src/edsl/dev.ts").WatchQueryController;

/** Options for watching a source file and re-rendering SQL on change. */
export type WatchQuerySourceOptions = import("./src/edsl/dev.ts").WatchQuerySourceOptions;

/** Watches source files, re-renders SQL, and optionally copies or writes the result. */
export const watchQuerySourceToClipboard = dev.watchQuerySourceToClipboard;


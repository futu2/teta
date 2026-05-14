# SQL Language Specification and Support Matrix

This document defines the current Teta language spec and default support behavior.

Status legend:

- **Direct**: emitted as-is
- **Mapped**: function/operator renamed for dialect
- **Fallback**: rewritten to equivalent AST expression
- **Best-effort fallback**: fallback works for common cases, but has edge-case limits
- **Configurable**: no built-in mapping/fallback; use `dialect.language.functions` or `dialect.language.fallbacks`

Dialect columns in this file:

- **PostgreSQL**: built-in mapping/fallback in current code
- **MySQL**: explicit column (currently mostly identity behavior; no MySQL-specific fallback pack yet)
- **SQLite**: built-in mapping/fallback in current code
- **HetuEngine DQL**: built-in profile (`Trino` parser fallback + selected function mappings)
- **Other built-ins**: mostly identity behavior unless overridden

Function-first policy:

- Expression entry points are plain functions such as `add(left, right)` and `dateTrunc(value, unit)`
- Query helpers are curried query steps used with `pipe(query, map(selector))`
- Runtime literals and constants stay as functions like `currentDate()`, `currentTimestamp()`, and `dateLiteral(...)`

## 1) Math (basic arithmetic)

| Spec item | Preferred functional entry | PostgreSQL | MySQL | SQLite | HetuEngine DQL | Other built-ins |
|---|---|---|---|---|---|---|
| `+` | `add(left, right)` | Direct | Direct | Direct | Direct | Direct |
| `-` | `sub(left, right)` | Direct | Direct | Direct | Direct | Direct |
| `*` | `mul(left, right)` | Direct | Direct | Direct | Direct | Direct |
| `/` | `div(left, right)` | Direct | Direct | Direct | Direct | Direct |
| `MOD` | `mod(left, right)` | Direct | Direct | Direct | Direct | Direct |
| `ABS` | `abs(value)` | Direct | Direct | Direct | Direct | Direct |
| `CEIL` | `ceil(value)` | Direct | Direct | Mapped → `CEILING` | Direct | Direct |
| `FLOOR` | `floor(value)` | Direct | Direct | Direct | Direct | Direct |
| `SQRT` | `sqrt(value)` | Direct | Direct | Direct | Direct | Direct |
| `POWER` | `pow(value, exponent)` | Direct | Direct | Direct | Direct | Direct |
| `ROUND` | `round(value, scale?)` | Direct | Direct | Direct | Direct | Direct |
| `GREATEST` | `greatest(value, ...values)` | Direct | Direct | Direct | Direct | Direct |
| `LEAST` | `least(value, ...values)` | Direct | Direct | Direct | Direct | Direct |

## 2) String manipulation

| Spec item | Preferred functional entry | PostgreSQL | MySQL | SQLite | HetuEngine DQL | Other built-ins |
|---|---|---|---|---|---|---|
| `CONCAT` | `concat(value, ...parts)`, ``f`...` `` | Direct | Direct | Direct | Direct | Direct |
| `UPPER` | `upper(value)` | Direct | Direct | Direct | Direct | Direct |
| `LOWER` | `lower(value)` | Direct | Direct | Direct | Direct | Direct |
| `TRIM` | `trim(value)` | Direct | Direct | Direct | Direct | Direct |
| `SUBSTRING` | `substring(value, start, length?)` | Direct | Direct | Direct | Direct | Direct |
| `POSITION` | `position(value, needle)` | Direct | Direct (engine-dependent) | Direct | Direct | Direct |
| `OVERLAY` | `overlay(value, placing, start, length?)` | Direct | Configurable | Direct (engine-dependent) | Configurable | Direct (engine-dependent) |
| `CHAR_LENGTH` | `charLength(value)` | Direct | Direct | Mapped → `LENGTH` | Mapped → `LENGTH` | Direct |
| `CHARACTER_LENGTH` | `characterLength(value)` | Mapped → `CHAR_LENGTH` | Direct | Mapped → `LENGTH` | Mapped → `LENGTH` | Direct |
| `OCTET_LENGTH` | `octetLength(value)` | Direct | Direct | Mapped → `LENGTH` | Direct (engine-dependent) | Direct |
| `BIT_LENGTH` | `bitLength(value)` | Direct | Direct | Fallback → `LENGTH(x) * 8` | Direct | Direct |
| `REPLACE` | `replace(value, search, replacement)` | Direct | Direct | Direct | Direct | Direct |
| `REVERSE` | `reverse(value)` | Direct | Direct | Direct | Direct | Direct |
| `LEFT` | `left(value, length)` | Direct | Direct | Direct (engine-dependent) | Direct (engine-dependent) | Direct |
| `RIGHT` | `right(value, length)` | Direct | Direct | Direct (engine-dependent) | Direct (engine-dependent) | Direct |
| `LPAD` | `lpad(value, length, padding?)` | Direct | Direct | Direct (engine-dependent) | Direct (engine-dependent) | Direct |
| `RPAD` | `rpad(value, length, padding?)` | Direct | Direct | Direct (engine-dependent) | Direct (engine-dependent) | Direct |
| `REGEXP_LIKE` | `regexLike(value, pattern)` | Fallback → `REGEXP_MATCH(x, p) IS NOT NULL` | Direct (MySQL 8+) | Best-effort fallback → `REGEXP(p, x)` (requires regexp function) | Direct | Direct (dialect-dependent) |
| `REGEXP_REPLACE` | `regexReplace(value, pattern, replacement, flags?)` | Direct | Direct (MySQL 8+) | Configurable (requires regexp UDF) | Direct | Direct (dialect-dependent) |
| `REGEXP_EXTRACT` | `regexExtract(value, pattern, group?)` | Mapped → `REGEXP_SUBSTR` (version-dependent) | Configurable | Configurable | Mapped → `REGEXP_EXTRACT` | Direct (dialect-dependent) |

## 3) Logical operators

| Spec item | Preferred functional entry | PostgreSQL | MySQL | SQLite | HetuEngine DQL | Other built-ins |
|---|---|---|---|---|---|---|
| `=` | `eq(left, right)` | Direct | Direct | Direct | Direct | Direct |
| `!=` | `ne(left, right)` | Direct | Direct | Direct | Direct | Direct |
| `<` | `lt(left, right)` | Direct | Direct | Direct | Direct | Direct |
| `<=` | `lte(left, right)` | Direct | Direct | Direct | Direct | Direct |
| `>` | `gt(left, right)` | Direct | Direct | Direct | Direct | Direct |
| `>=` | `gte(left, right)` | Direct | Direct | Direct | Direct | Direct |
| `AND` | `and(left, right)` | Direct | Direct | Direct | Direct | Direct |
| `OR` | `or(left, right)` | Direct | Direct | Direct | Direct | Direct |
| `NOT` | `not(value)` | Direct | Direct | Direct | Direct | Direct |
| `LIKE` | `like(value, pattern)` | Direct | Direct | Direct | Direct | Direct |
| `IN` | `isIn(value, values)` | Direct | Direct | Direct | Direct | Direct |

## 4) Date and time functions

| Spec item | Preferred functional entry | PostgreSQL | MySQL | SQLite | HetuEngine DQL | Other built-ins |
|---|---|---|---|---|---|---|
| `CURRENT_DATE` | `currentDate()` | Direct | Direct | Direct | Direct | Direct |
| `CURRENT_TIMESTAMP` | `currentTimestamp()` | Direct | Direct | Direct | Direct | Direct |
| `EXTRACT` | `extract(value, field)` | Direct | Direct | Direct | Direct | Direct |
| `DATE_TRUNC` | `dateTrunc(value, unit)` | Direct | Configurable | Fallback → `STRFTIME`/`DATE` | Direct | Direct |
| `DATE_ADD` | `dateAdd(value, unit, amount)` | Fallback → epoch + `TO_TIMESTAMP` (week/day/hour/minute/second) | Configurable | Fallback → `DATETIME(..., PRINTF(...))` | Direct | Direct (dialect-dependent) |
| `DATE_DIFF` | `dateDiff(value, unit, other)` | Fallback → `EXTRACT(EPOCH ...)` + calendar diff | Configurable | Fallback → `JULIANDAY(...)` + calendar diff | Direct | Direct (dialect-dependent) |
| `DATE_PARSE` | `dateParse(value, format)` | Mapped → `TO_TIMESTAMP` | Configurable | Fallback → `DATETIME(x)` | Direct | Direct (dialect-dependent) |
| `DATE_FORMAT` | `dateFormat(value, format)` | Mapped → `TO_CHAR` | Direct | Fallback → `STRFTIME(format, x)` | Direct | Direct (dialect-dependent) |
| `TO_UNIXTIME` | `toUnixTime(value)` | Fallback → `EXTRACT(EPOCH ...)` | Configurable | Fallback → `CAST(STRFTIME('%s', x) AS INTEGER)` | Direct | Direct (dialect-dependent) |
| `FROM_UNIXTIME` | `fromUnixTime(value)` | Mapped → `TO_TIMESTAMP` | Direct | Fallback → `DATETIME(x, 'unixepoch')` | Direct | Direct (dialect-dependent) |

Convenience date-part helpers over `extract(...)`:

- `year(value)`, `month(value)`, `day(value)`
- `hour(value)`, `minute(value)`, `second(value)`

## 5) Type conversion and null handling

| Spec item | Preferred functional entry | PostgreSQL | MySQL | SQLite | HetuEngine DQL | Other built-ins |
|---|---|---|---|---|---|---|
| `CAST` | `cast(value, type)`, `toInt(value)`, `toFloat(value)`, `toDate(value)` | Direct | Direct | Direct | Direct | Direct |
| `COALESCE` | `coalesce(value, ...values)` | Direct | Direct | Direct | Direct | Direct |
| `NULLIF` | `nullIf(value, other)` | Direct | Direct | Direct | Direct | Direct |
| `IS NULL` | `isNull(value)` | Direct | Direct | Direct | Direct | Direct |
| `IS NOT NULL` | `isNotNull(value)` | Direct | Direct | Direct | Direct | Direct |
| `TRY_CAST` | `fn("TRY_CAST", ...)` | Configurable | Configurable | Configurable | Direct | Configurable |

## 6) Array manipulation

| Spec item | Preferred functional entry | PostgreSQL | MySQL | SQLite | HetuEngine DQL | Other built-ins |
|---|---|---|---|---|---|---|
| `ARRAY_LENGTH` | `arrayLength(value)` | Fallback → `ARRAY_LENGTH(x, 1)` | Configurable | Fallback → `JSON_ARRAY_LENGTH(x)` | Mapped → `CARDINALITY` | Direct (dialect-dependent) |
| `ARRAY_CONTAINS` | `arrayContains(value, item)` | Fallback → `ARRAY_POSITION(...) IS NOT NULL` | Configurable | Best-effort fallback via JSON text search | Direct (dialect-dependent) | Configurable |
| `ARRAY_POSITION` | `arrayPosition(value, item)` | Direct | Configurable | Best-effort fallback via JSON text search | Direct | Direct (dialect-dependent) |
| `ARRAY_SLICE` | `arraySlice(value, start, len?)` | Configurable | Configurable | Configurable | Mapped → `SLICE` | Configurable |
| `ARRAY_JOIN` | `arrayJoin(value, separator)` | Mapped → `ARRAY_TO_STRING` | Configurable | Best-effort fallback via JSON text cleanup | Direct | Configurable |
| `ARRAY_APPEND` | `arrayAppend(value, item)` | Direct | Configurable | Fallback → `JSON_INSERT(x, '$[#]', v)` | Configurable | Direct (dialect-dependent) |
| `ARRAY_PREPEND` | `arrayPrepend(value, item)` | Direct | Configurable | Configurable | Configurable | Direct (dialect-dependent) |
| `ARRAY_CONCAT` | `arrayConcat(value, ...values)` | Configurable (or map to `ARRAY_CAT`) | Configurable | Configurable | Mapped → `CONCAT` | Direct (dialect-dependent) |
| `ARRAY_DISTINCT` | `arrayDistinct(value)` | Configurable | Configurable | Configurable | Direct | Configurable |

## 7) Window / aggregation

| Spec item | Preferred functional entry | PostgreSQL | MySQL | SQLite | HetuEngine DQL | Other built-ins |
|---|---|---|---|---|---|---|
| `COUNT` | `count(value)` | Direct | Direct | Direct | Direct | Direct |
| `SUM` | `sum(value)`, `sumOver(value, spec)` | Direct | Direct | Direct | Direct | Direct |
| `AVG` | `avg(value)` | Direct | Direct | Direct | Direct | Direct |
| `MIN` | `min(value)` | Direct | Direct | Direct | Direct | Direct |
| `MAX` | `max(value)` | Direct | Direct | Direct | Direct | Direct |
| `ARRAY_AGG` | `arrayAgg(value)` | Direct | Configurable | Mapped → `JSON_GROUP_ARRAY` | Direct | Mapped → `COLLECT_LIST` (Hive), otherwise direct (dialect-dependent) |
| `RANK` | `over(rank(), spec)` | Direct | Direct (MySQL 8+) | Direct | Direct | Direct |
| `DENSE_RANK` | `over(denseRank(), spec)` | Direct | Direct (MySQL 8+) | Direct | Direct | Direct |
| `ROW_NUMBER` | `over(rowNumber(), spec)` | Direct | Direct (MySQL 8+) | Direct | Direct | Direct |
| `LAG` | `over(lag(value, offset?, fallback?), spec)` | Direct | Direct (MySQL 8+) | Direct | Direct | Direct |
| `LEAD` | `over(lead(value, offset?, fallback?), spec)` | Direct | Direct (MySQL 8+) | Direct | Direct | Direct |
| `PERCENT_RANK` | `over(percentRank(), spec)` | Direct | Direct (MySQL 8+) | Direct | Direct | Direct |
| `NTILE` | `over(ntile(buckets), spec)` | Direct | Direct (MySQL 8+) | Direct | Direct | Direct |

## 8) Query features

| Spec item | Preferred functional entry | PostgreSQL | MySQL | SQLite | HetuEngine DQL | Other built-ins |
|---|---|---|---|---|---|---|
| `LATERAL_JOIN` | `pipe(left, join(right, on, { lateral: true }))` | Direct (`LATERAL` kept) | Direct (MySQL 8+, engine-dependent) | Keyword removed when unsupported | Direct | Direct |
| `RECURSIVE_CTE` | `pipe(base, loop(step))` | Direct | Direct (MySQL 8+) | Direct | Direct | Direct |

If `dialect.features.recursiveCte = false`, SQL rendering throws an explicit error.

## Built-in HetuEngine DQL profile

`HetuEngine DQL` is available as a built-in canonical backend:

- `"hetu"`

Current defaults:

- Parser fallback: `Trino` (used for `node-sql-parser` SQL stringification)
- Function mappings: `ARRAY_LENGTH -> CARDINALITY`, `ARRAY_SLICE -> SLICE`, `ARRAY_CONCAT -> CONCAT`
- String mappings: `CHAR_LENGTH/CHARACTER_LENGTH -> LENGTH`

---

## Dialect customization hooks

You can override any item through `SqlOptions.dialect.language`:

```ts
import { table, t, toSql } from "@teta/teta";

const users = table("users", {
  name: t.string(),
  created_at: t.timestamp(),
});

const sqlOptions = {
  dialect: {
    name: "my_dialect",
    parserDialect: "Trino",
    features: {
      lateralJoinKeyword: true,
      recursiveCte: true,
    },
    language: {
      functions: {
        CHARACTER_LENGTH: "LENGTH",
        ARRAY_JOIN: "ARRAY_TO_STRING",
      },
      fallbacks: {
        BIT_LENGTH: "bit_length_via_length_x8",
        DATE_FORMAT: "date_format_via_strftime",
        DATE_ADD: "date_add_via_epoch_timestamp",
        DATE_DIFF: "date_diff_via_extract_epoch",
      },
      unsupported: ["OVERLAY"],
    },
  },
});

console.log(toSql(users, sqlOptions));
```

Available fallback identifiers:

- `bit_length_via_length_x8`
- `array_length_via_json_array_length`
- `array_length_dim1`
- `array_contains_via_array_position`
- `array_contains_via_json_instr`
- `array_position_via_json_instr`
- `array_join_via_json_string`
- `array_append_via_json_insert_end`
- `date_format_via_strftime`
- `date_parse_via_datetime`
- `date_trunc_via_strftime`
- `date_add_via_datetime`
- `date_add_via_epoch_timestamp`
- `date_diff_via_julianday`
- `date_diff_via_extract_epoch`
- `to_unixtime_via_strftime_s`
- `to_unixtime_via_extract_epoch`
- `from_unixtime_via_datetime`
- `regex_like_via_regexp_match`
- `regex_like_via_regexp_function`

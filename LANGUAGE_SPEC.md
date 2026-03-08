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

Method-centric policy:

- EDSL entry points are method-based when possible (`expr.someFunction(...)`)
- Global helpers remain for cases without a receiver (`currentDate()`, `currentTimestamp()`, literals)

## 1) Math (basic arithmetic)

| Spec item | Preferred EDSL entry | PostgreSQL | MySQL | SQLite | HetuEngine DQL | Other built-ins |
|---|---|---|---|---|---|---|
| `+` | `expr.add(...)` | Direct | Direct | Direct | Direct | Direct |
| `-` | `expr.sub(...)` | Direct | Direct | Direct | Direct | Direct |
| `*` | `expr.mul(...)` | Direct | Direct | Direct | Direct | Direct |
| `/` | `expr.div(...)` | Direct | Direct | Direct | Direct | Direct |
| `MOD` | `expr.mod(...)` | Direct | Direct | Direct | Direct | Direct |
| `ABS` | `expr.abs()` | Direct | Direct | Direct | Direct | Direct |
| `CEIL` | `expr.ceil()` | Direct | Direct | Mapped → `CEILING` | Direct | Direct |
| `FLOOR` | `expr.floor()` | Direct | Direct | Direct | Direct | Direct |
| `SQRT` | `expr.sqrt()` | Direct | Direct | Direct | Direct | Direct |
| `POWER` | `expr.pow(...)` | Direct | Direct | Direct | Direct | Direct |
| `ROUND` | `expr.round(...)` | Direct | Direct | Direct | Direct | Direct |
| `GREATEST` | `expr.greatest(...)` | Direct | Direct | Direct | Direct | Direct |
| `LEAST` | `expr.least(...)` | Direct | Direct | Direct | Direct | Direct |

## 2) String manipulation

| Spec item | Preferred EDSL entry | PostgreSQL | MySQL | SQLite | HetuEngine DQL | Other built-ins |
|---|---|---|---|---|---|---|
| `CONCAT` | `expr.concat(...)`, `f\`...\`` | Direct | Direct | Direct | Direct | Direct |
| `UPPER` | `expr.upper()` | Direct | Direct | Direct | Direct | Direct |
| `LOWER` | `expr.lower()` | Direct | Direct | Direct | Direct | Direct |
| `TRIM` | `expr.trim()` | Direct | Direct | Direct | Direct | Direct |
| `SUBSTRING` | `expr.substring(...)` | Direct | Direct | Direct | Direct | Direct |
| `POSITION` | `expr.position(...)` | Direct | Direct (engine-dependent) | Direct | Direct | Direct |
| `OVERLAY` | `expr.overlay(...)` | Direct | Configurable | Direct (engine-dependent) | Configurable | Direct (engine-dependent) |
| `CHAR_LENGTH` | `expr.charLength()` | Direct | Direct | Mapped → `LENGTH` | Mapped → `LENGTH` | Direct |
| `CHARACTER_LENGTH` | `expr.characterLength()` | Mapped → `CHAR_LENGTH` | Direct | Mapped → `LENGTH` | Mapped → `LENGTH` | Direct |
| `OCTET_LENGTH` | `expr.octetLength()` | Direct | Direct | Mapped → `LENGTH` | Direct (engine-dependent) | Direct |
| `BIT_LENGTH` | `expr.bitLength()` | Direct | Direct | Fallback → `LENGTH(x) * 8` | Direct | Direct |
| `REPLACE` | `expr.replace(...)` | Direct | Direct | Direct | Direct | Direct |
| `REVERSE` | `expr.reverse()` | Direct | Direct | Direct | Direct | Direct |
| `LEFT` | `expr.left(...)` | Direct | Direct | Direct (engine-dependent) | Direct (engine-dependent) | Direct |
| `RIGHT` | `expr.right(...)` | Direct | Direct | Direct (engine-dependent) | Direct (engine-dependent) | Direct |
| `LPAD` | `expr.lpad(...)` | Direct | Direct | Direct (engine-dependent) | Direct (engine-dependent) | Direct |
| `RPAD` | `expr.rpad(...)` | Direct | Direct | Direct (engine-dependent) | Direct (engine-dependent) | Direct |
| `REGEXP_LIKE` | `expr.regexLike(pattern)` | Fallback → `REGEXP_MATCH(x, p) IS NOT NULL` | Direct (MySQL 8+) | Best-effort fallback → `REGEXP(p, x)` (requires regexp function) | Direct | Direct (dialect-dependent) |
| `REGEXP_REPLACE` | `expr.regexReplace(pattern, replacement, flags?)` | Direct | Direct (MySQL 8+) | Configurable (requires regexp UDF) | Direct | Direct (dialect-dependent) |
| `REGEXP_EXTRACT` | `expr.regexExtract(pattern, group?)` | Mapped → `REGEXP_SUBSTR` (version-dependent) | Configurable | Configurable | Mapped → `REGEXP_EXTRACT` | Direct (dialect-dependent) |

## 3) Logical operators

| Spec item | Preferred EDSL entry | PostgreSQL | MySQL | SQLite | HetuEngine DQL | Other built-ins |
|---|---|---|---|---|---|---|
| `=` | `expr.eq(...)` | Direct | Direct | Direct | Direct | Direct |
| `!=` | `expr.ne(...)` | Direct | Direct | Direct | Direct | Direct |
| `<` | `expr.lt(...)` | Direct | Direct | Direct | Direct | Direct |
| `<=` | `expr.lte(...)` | Direct | Direct | Direct | Direct | Direct |
| `>` | `expr.gt(...)` | Direct | Direct | Direct | Direct | Direct |
| `>=` | `expr.gte(...)` | Direct | Direct | Direct | Direct | Direct |
| `AND` | `expr.and(...)` | Direct | Direct | Direct | Direct | Direct |
| `OR` | `expr.or(...)` | Direct | Direct | Direct | Direct | Direct |
| `NOT` | `expr.not()` | Direct | Direct | Direct | Direct | Direct |
| `LIKE` | `expr.like(...)` | Direct | Direct | Direct | Direct | Direct |
| `IN` | `expr.in([...])` | Direct | Direct | Direct | Direct | Direct |

## 4) Date and time functions

| Spec item | Preferred EDSL entry | PostgreSQL | MySQL | SQLite | HetuEngine DQL | Other built-ins |
|---|---|---|---|---|---|---|
| `CURRENT_DATE` | `currentDate()` | Direct | Direct | Direct | Direct | Direct |
| `CURRENT_TIMESTAMP` | `currentTimestamp()` | Direct | Direct | Direct | Direct | Direct |
| `EXTRACT` | `expr.extract("...")` | Direct | Direct | Direct | Direct | Direct |
| `DATE_TRUNC` | `expr.dateTrunc(unit)` | Direct | Configurable | Fallback → `STRFTIME`/`DATE` | Direct | Direct |
| `DATE_ADD` | `expr.dateAdd(unit, amount)` | Fallback → epoch + `TO_TIMESTAMP` (week/day/hour/minute/second) | Configurable | Fallback → `DATETIME(..., PRINTF(...))` | Direct | Direct (dialect-dependent) |
| `DATE_DIFF` | `expr.dateDiff(unit, other)` | Fallback → `EXTRACT(EPOCH ...)` + calendar diff | Configurable | Fallback → `JULIANDAY(...)` + calendar diff | Direct | Direct (dialect-dependent) |
| `DATE_PARSE` | `expr.dateParse(format)` | Mapped → `TO_TIMESTAMP` | Configurable | Fallback → `DATETIME(x)` | Direct | Direct (dialect-dependent) |
| `DATE_FORMAT` | `expr.dateFormat(format)` | Mapped → `TO_CHAR` | Direct | Fallback → `STRFTIME(format, x)` | Direct | Direct (dialect-dependent) |
| `TO_UNIXTIME` | `expr.toUnixTime()` | Fallback → `EXTRACT(EPOCH ...)` | Configurable | Fallback → `CAST(STRFTIME('%s', x) AS INTEGER)` | Direct | Direct (dialect-dependent) |
| `FROM_UNIXTIME` | `expr.fromUnixTime()` | Mapped → `TO_TIMESTAMP` | Direct | Fallback → `DATETIME(x, 'unixepoch')` | Direct | Direct (dialect-dependent) |

Convenience date part methods (method-centric wrappers over `EXTRACT`):

- `expr.year()`, `expr.month()`, `expr.day()`
- `expr.hour()`, `expr.minute()`, `expr.second()`

## 5) Type conversion and null handling

| Spec item | Preferred EDSL entry | PostgreSQL | MySQL | SQLite | HetuEngine DQL | Other built-ins |
|---|---|---|---|---|---|---|
| `CAST` | `expr.cast(...)`, `toInt()`, `toFloat()`, `toDate()` | Direct | Direct | Direct | Direct | Direct |
| `COALESCE` | `expr.coalesce(...)` | Direct | Direct | Direct | Direct | Direct |
| `NULLIF` | `expr.nullIf(...)` | Direct | Direct | Direct | Direct | Direct |
| `IS NULL` | `expr.isNull()` | Direct | Direct | Direct | Direct | Direct |
| `IS NOT NULL` | `expr.isNotNull()` | Direct | Direct | Direct | Direct | Direct |
| `TRY_CAST` | `fn("TRY_CAST", ...)` | Configurable | Configurable | Configurable | Direct | Configurable |

## 6) Array manipulation

| Spec item | Preferred EDSL entry | PostgreSQL | MySQL | SQLite | HetuEngine DQL | Other built-ins |
|---|---|---|---|---|---|---|
| `ARRAY_LENGTH` | `expr.arrayLength()` | Fallback → `ARRAY_LENGTH(x, 1)` | Configurable | Fallback → `JSON_ARRAY_LENGTH(x)` | Mapped → `CARDINALITY` | Direct (dialect-dependent) |
| `ARRAY_CONTAINS` | `expr.arrayContains(v)` | Fallback → `ARRAY_POSITION(...) IS NOT NULL` | Configurable | Best-effort fallback via JSON text search | Direct (dialect-dependent) | Configurable |
| `ARRAY_POSITION` | `expr.arrayPosition(v)` | Direct | Configurable | Best-effort fallback via JSON text search | Direct | Direct (dialect-dependent) |
| `ARRAY_SLICE` | `expr.arraySlice(start, len?)` | Configurable | Configurable | Configurable | Mapped → `SLICE` | Configurable |
| `ARRAY_JOIN` | `expr.arrayJoin(sep)` | Mapped → `ARRAY_TO_STRING` | Configurable | Best-effort fallback via JSON text cleanup | Direct | Configurable |
| `ARRAY_APPEND` | `expr.arrayAppend(v)` | Direct | Configurable | Fallback → `JSON_INSERT(x, '$[#]', v)` | Configurable | Direct (dialect-dependent) |
| `ARRAY_PREPEND` | `expr.arrayPrepend(v)` | Direct | Configurable | Configurable | Configurable | Direct (dialect-dependent) |
| `ARRAY_CONCAT` | `expr.arrayConcat(...)` | Configurable (or map to `ARRAY_CAT`) | Configurable | Configurable | Mapped → `CONCAT` | Direct (dialect-dependent) |
| `ARRAY_DISTINCT` | `expr.arrayDistinct()` | Configurable | Configurable | Configurable | Direct | Configurable |

## 7) Window / aggregation

| Spec item | Preferred EDSL entry | PostgreSQL | MySQL | SQLite | HetuEngine DQL | Other built-ins |
|---|---|---|---|---|---|---|
| `COUNT` | `expr.count()` | Direct | Direct | Direct | Direct | Direct |
| `SUM` | `expr.sum()`, `expr.sumOver(...)` | Direct | Direct | Direct | Direct | Direct |
| `AVG` | `expr.avg()` | Direct | Direct | Direct | Direct | Direct |
| `MIN` | `expr.min()` | Direct | Direct | Direct | Direct | Direct |
| `MAX` | `expr.max()` | Direct | Direct | Direct | Direct | Direct |
| `RANK` | `expr.rank().over(...)` | Direct | Direct (MySQL 8+) | Direct | Direct | Direct |
| `DENSE_RANK` | `expr.denseRank().over(...)` | Direct | Direct (MySQL 8+) | Direct | Direct | Direct |
| `ROW_NUMBER` | `expr.rowNumber().over(...)` | Direct | Direct (MySQL 8+) | Direct | Direct | Direct |
| `LAG` | `expr.lag(...).over(...)` | Direct | Direct (MySQL 8+) | Direct | Direct | Direct |
| `LEAD` | `expr.lead(...).over(...)` | Direct | Direct (MySQL 8+) | Direct | Direct | Direct |
| `PERCENT_RANK` | `expr.percentRank().over(...)` | Direct | Direct (MySQL 8+) | Direct | Direct | Direct |
| `NTILE` | `expr.ntile(n).over(...)` | Direct | Direct (MySQL 8+) | Direct | Direct | Direct |

## 8) Query features

| Spec item | Preferred EDSL entry | PostgreSQL | MySQL | SQLite | HetuEngine DQL | Other built-ins |
|---|---|---|---|---|---|---|
| `LATERAL_JOIN` | `query.lateralJoin(...)` | Direct (`LATERAL` kept) | Direct (MySQL 8+, engine-dependent) | Keyword removed when unsupported | Direct | Direct |
| `RECURSIVE_CTE` | `loop(...)` | Direct | Direct (MySQL 8+) | Direct | Direct | Direct |

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

You can override any item through `toSql(sqlRenderer({ dialect: { language: ... } }))`:

```ts
toSql(sqlRenderer({
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
})).sql;
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

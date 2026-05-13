import { SQLITE_UNSUPPORTED, currentDate, currentTimestamp, scalarTable, } from "./live-language-spec-shared.ts";
import type { LiveSpecCase } from "./live-language-spec-shared.ts";
import { isNotNull, map, abs, add, cast, ceil, coalesce, dateAdd, dateDiff, dateFormat, dateParse, dateTrunc, day, div, eq, extract, floor, greatest, gt, gte, hour, isIn, isNull, least, lt, lte, minute, mod, month, mul, ne, nullIf, pow, round, second, sqrt, sub, toDate, toInt, toString, trim, year, and, bitLength, charLength, characterLength, concat, fromUnixTime, left, like, lower, lpad, not, octetLength, or, overlay, position, regexExtract, regexLike, regexReplace, replace, reverse, right, rpad, substring, toFloat, upper, toUnixTime, pipe } from "../../mod.ts";
export const LIVE_LANGUAGE_SCALAR_CASES: LiveSpecCase[] = [
    {
        name: "math functions",
        build: () => {
            const scalar = scalarTable();
            return pipe(scalar, map(({ ceil_src, floor_src, i, j, k, neg_i, pow_base, pow_exp, round_src, sqrt_src, x, y }) => ({
                add_v: add(i, j),
                sub_v: sub(i, j),
                mul_v: mul(i, j),
                div_v: div(x, y),
                mod_v: mod(i, j),
                abs_v: abs(neg_i),
                ceil_v: ceil(ceil_src),
                floor_v: floor(floor_src),
                sqrt_v: sqrt(sqrt_src),
                pow_v: pow(pow_base, pow_exp),
                round_v: round(round_src, 2),
                greatest_v: greatest(i, j, k),
                least_v: least(i, j, k),
            })));
        },
        outcomes: {
            sqlite: {
                rows: [
                    {
                        add_v: 7,
                        sub_v: 3,
                        mul_v: 10,
                        div_v: 3,
                        mod_v: 1,
                        abs_v: 5,
                        ceil_v: 3,
                        floor_v: 2,
                        sqrt_v: 3,
                        pow_v: 8,
                        round_v: 2.35,
                        greatest_v: 8,
                        least_v: 2,
                    },
                ],
            },
            duckdb: {
                rows: [
                    {
                        add_v: 7,
                        sub_v: 3,
                        mul_v: 10,
                        div_v: 3,
                        mod_v: 1,
                        abs_v: 5,
                        ceil_v: 3,
                        floor_v: 2,
                        sqrt_v: 3,
                        pow_v: 8,
                        round_v: 2.35,
                        greatest_v: 8,
                        least_v: 2,
                    },
                ],
            },
        },
    },
    {
        name: "core string functions",
        build: () => {
            const scalar = scalarTable();
            return pipe(scalar, map(({ txt, txt2 }) => {
                const trimmed = trim(txt);
                return {
                    concat_v: concat(trimmed, txt2),
                    upper_v: upper(trimmed),
                    lower_v: lower(trimmed),
                    trim_v: trimmed,
                    substring_v: substring(trimmed, 2, 5),
                    char_length_v: charLength(trimmed),
                    character_length_v: characterLength(trimmed),
                    bit_length_v: bitLength(trimmed),
                    replace_v: replace(trimmed, "World", "Duck"),
                };
            }));
        },
        outcomes: {
            sqlite: {
                rows: [
                    {
                        concat_v: "HelloWorldWorld",
                        upper_v: "HELLOWORLD",
                        lower_v: "helloworld",
                        trim_v: "HelloWorld",
                        substring_v: "elloW",
                        char_length_v: 10,
                        character_length_v: 10,
                        bit_length_v: 80,
                        replace_v: "HelloDuck",
                    },
                ],
            },
            duckdb: {
                rows: [
                    {
                        concat_v: "HelloWorldWorld",
                        upper_v: "HELLOWORLD",
                        lower_v: "helloworld",
                        trim_v: "HelloWorld",
                        substring_v: "elloW",
                        char_length_v: 10,
                        character_length_v: 10,
                        bit_length_v: 80,
                        replace_v: "HelloDuck",
                    },
                ],
            },
        },
    },
    {
        name: "octet length",
        build: () => {
            const scalar = scalarTable();
            return pipe(scalar, map(({ txt }) => ({ value: octetLength(trim(txt)) })));
        },
        outcomes: {
            sqlite: { rows: [{ value: 10 }] },
            duckdb: { rows: [{ value: 10 }] },
        },
    },
    {
        name: "position",
        build: () => {
            const scalar = scalarTable();
            return pipe(scalar, map(({ txt }) => ({ value: position(trim(txt), "World") })));
        },
        outcomes: {
            sqlite: { rows: [{ value: 6 }] },
            duckdb: { rows: [{ value: 6 }] },
        },
    },
    {
        name: "overlay",
        build: () => {
            const scalar = scalarTable();
            return pipe(scalar, map(({ txt }) => ({ value: overlay(trim(txt), "Duck", 6, 5) })));
        },
        outcomes: {
            sqlite: { error: SQLITE_UNSUPPORTED },
            duckdb: { rows: [{ value: "HelloDuck" }] },
        },
    },
    {
        name: "reverse",
        build: () => {
            const scalar = scalarTable();
            return pipe(scalar, map(({ txt }) => ({ value: reverse(trim(txt)) })));
        },
        outcomes: {
            sqlite: { error: SQLITE_UNSUPPORTED },
            duckdb: { rows: [{ value: "dlroWolleH" }] },
        },
    },
    {
        name: "left",
        build: () => {
            const scalar = scalarTable();
            return pipe(scalar, map(({ txt }) => ({ value: left(trim(txt), 5) })));
        },
        outcomes: {
            sqlite: { error: SQLITE_UNSUPPORTED },
            duckdb: { rows: [{ value: "Hello" }] },
        },
    },
    {
        name: "right",
        build: () => {
            const scalar = scalarTable();
            return pipe(scalar, map(({ txt }) => ({ value: right(trim(txt), 5) })));
        },
        outcomes: {
            sqlite: { error: SQLITE_UNSUPPORTED },
            duckdb: { rows: [{ value: "World" }] },
        },
    },
    {
        name: "lpad",
        build: () => {
            const scalar = scalarTable();
            return pipe(scalar, map(({ txt }) => ({ value: lpad(trim(txt), 12, "_") })));
        },
        outcomes: {
            sqlite: { error: SQLITE_UNSUPPORTED },
            duckdb: { rows: [{ value: "__HelloWorld" }] },
        },
    },
    {
        name: "rpad",
        build: () => {
            const scalar = scalarTable();
            return pipe(scalar, map(({ txt }) => ({ value: rpad(trim(txt), 12, "_") })));
        },
        outcomes: {
            sqlite: { error: SQLITE_UNSUPPORTED },
            duckdb: { rows: [{ value: "HelloWorld__" }] },
        },
    },
    {
        name: "regex like",
        build: () => {
            const scalar = scalarTable();
            return pipe(scalar, map(({ txt }) => ({ value: regexLike(trim(txt), "^Hello") })));
        },
        outcomes: {
            sqlite: { error: SQLITE_UNSUPPORTED },
            duckdb: { rows: [{ value: true }] },
        },
    },
    {
        name: "regex replace",
        build: () => {
            const scalar = scalarTable();
            return pipe(scalar, map(({ txt }) => ({ value: regexReplace(trim(txt), "World", "Duck") })));
        },
        outcomes: {
            sqlite: { error: SQLITE_UNSUPPORTED },
            duckdb: { rows: [{ value: "HelloDuck" }] },
        },
    },
    {
        name: "regex extract",
        build: () => {
            const scalar = scalarTable();
            return pipe(scalar, map(({ txt }) => ({ value: regexExtract(trim(txt), "Hello(.*)", 1) })));
        },
        outcomes: {
            sqlite: { error: SQLITE_UNSUPPORTED },
            duckdb: { rows: [{ value: "World" }] },
        },
    },
    {
        name: "logical operators",
        build: () => {
            const scalar = scalarTable();
            return pipe(scalar, map(({ i, j, txt, txt2 }) => ({
                eq_v: eq(i, 5),
                ne_v: ne(i, 4),
                lt_v: lt(j, i),
                lte_v: lte(j, 2),
                gt_v: gt(i, j),
                gte_v: gte(i, 5),
                and_v: and(gt(i, j), eq(txt2, "World")),
                or_v: or(lt(i, j), eq(txt2, "World")),
                not_v: not(lt(i, j)),
                like_v: like(trim(txt), "Hello%"),
                in_v: isIn(txt2, ["Duck", "World"]),
            })));
        },
        outcomes: {
            sqlite: {
                rows: [
                    {
                        eq_v: 1,
                        ne_v: 1,
                        lt_v: 1,
                        lte_v: 1,
                        gt_v: 1,
                        gte_v: 1,
                        and_v: 1,
                        or_v: 1,
                        not_v: 1,
                        like_v: 1,
                        in_v: 1,
                    },
                ],
            },
            duckdb: {
                rows: [
                    {
                        eq_v: true,
                        ne_v: true,
                        lt_v: true,
                        lte_v: true,
                        gt_v: true,
                        gte_v: true,
                        and_v: true,
                        or_v: true,
                        not_v: true,
                        like_v: true,
                        in_v: true,
                    },
                ],
            },
        },
    },
    {
        name: "date and time functions",
        build: () => {
            const scalar = scalarTable();
            return pipe(scalar, map(({ i, parse_txt, ts, ts_next }) => ({
                current_date_ok: isNotNull(currentDate()),
                current_ts_ok: isNotNull(currentTimestamp()),
                date_trunc_v: dateFormat(dateTrunc(ts, "day"), "%Y-%m-%d %H:%M:%S"),
                date_add_v: dateFormat(dateAdd(ts, "day", 2), "%Y-%m-%d %H:%M:%S"),
                date_diff_v: dateDiff(ts, "day", ts_next),
                date_parse_v: dateFormat(dateParse(parse_txt, "%Y-%m-%d %H:%M:%S"), "%Y-%m-%d %H:%M:%S"),
                date_format_v: dateFormat(ts, "%Y-%m-%d"),
                to_unixtime_v: toInt(toUnixTime(fromUnixTime(sub(i, 5)))),
                from_unixtime_v: dateFormat(fromUnixTime(sub(i, 5)), "%Y-%m-%d %H:%M:%S"),
            })));
        },
        outcomes: {
            sqlite: {
                rows: [
                    {
                        current_date_ok: 1,
                        current_ts_ok: 1,
                        date_trunc_v: "2024-01-02 00:00:00",
                        date_add_v: "2024-01-04 03:04:05",
                        date_diff_v: 1,
                        date_parse_v: "2024-02-03 04:05:06",
                        date_format_v: "2024-01-02",
                        to_unixtime_v: 0,
                        from_unixtime_v: "1970-01-01 00:00:00",
                    },
                ],
            },
            duckdb: {
                rows: [
                    {
                        current_date_ok: true,
                        current_ts_ok: true,
                        date_trunc_v: "2024-01-02 00:00:00",
                        date_add_v: "2024-01-04 03:04:05",
                        date_diff_v: 1,
                        date_parse_v: "2024-02-03 04:05:06",
                        date_format_v: "2024-01-02",
                        to_unixtime_v: 0,
                        from_unixtime_v: "1970-01-01 00:00:00",
                    },
                ],
            },
        },
    },
    {
        name: "extract and date part helpers",
        build: () => {
            const scalar = scalarTable();
            return pipe(scalar, map(({ ts }) => ({
                extract_year_v: extract(ts, "year"),
                year_v: year(ts),
                month_v: month(ts),
                day_v: day(ts),
                hour_v: hour(ts),
                minute_v: minute(ts),
                second_v: second(ts),
            })));
        },
        outcomes: {
            sqlite: {
                rows: [
                    {
                        extract_year_v: 2024,
                        year_v: 2024,
                        month_v: 1,
                        day_v: 2,
                        hour_v: 3,
                        minute_v: 4,
                        second_v: 5,
                    },
                ],
            },
            duckdb: {
                rows: [
                    {
                        extract_year_v: 2024,
                        year_v: 2024,
                        month_v: 1,
                        day_v: 2,
                        hour_v: 3,
                        minute_v: 4,
                        second_v: 5,
                    },
                ],
            },
        },
    },
    {
        name: "type conversion and null handling",
        build: () => {
            const scalar = scalarTable();
            return pipe(scalar, map(({ i, nullable_txt, num_txt, ts, txt, txt2, x }) => ({
                cast_v: cast(num_txt, "INTEGER"),
                to_int_v: toInt(x),
                to_float_v: toFloat(toInt(x)),
                to_string_v: toString(i),
                to_date_v: dateFormat(toDate(ts), "%Y-%m-%d"),
                coalesce_v: coalesce(nullable_txt, txt2),
                nullif_is_null_v: isNull(nullIf(txt2, "World")),
                is_null_v: isNull(nullable_txt),
                is_not_null_v: isNotNull(txt),
            })));
        },
        outcomes: {
            sqlite: {
                rows: [
                    {
                        cast_v: 42,
                        to_int_v: 7,
                        to_float_v: 7,
                        to_string_v: "5",
                        to_date_v: "2024-01-02",
                        coalesce_v: "World",
                        nullif_is_null_v: 1,
                        is_null_v: 1,
                        is_not_null_v: 1,
                    },
                ],
            },
            duckdb: {
                rows: [
                    {
                        cast_v: 42,
                        to_int_v: 8,
                        to_float_v: 8,
                        to_string_v: "5",
                        to_date_v: "2024-01-02",
                        coalesce_v: "World",
                        nullif_is_null_v: true,
                        is_null_v: true,
                        is_not_null_v: true,
                    },
                ],
            },
        },
    },
];

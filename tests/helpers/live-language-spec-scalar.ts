import {
  SQLITE_UNSUPPORTED,
  currentDate,
  currentTimestamp,
  scalarTable,
} from "./live-language-spec-shared.ts";
import type { LiveSpecCase } from "./live-language-spec-shared.ts";

export const LIVE_LANGUAGE_SCALAR_CASES: LiveSpecCase[] = [
  {
    name: "math functions",
    build: () => {
      const scalar = scalarTable();
      return scalar.select(
        ({ ceil_src, floor_src, i, j, k, neg_i, pow_base, pow_exp, round_src, sqrt_src, x, y }) => ({
          add_v: i.add(j),
          sub_v: i.sub(j),
          mul_v: i.mul(j),
          div_v: x.div(y),
          mod_v: i.mod(j),
          abs_v: neg_i.abs(),
          ceil_v: ceil_src.ceil(),
          floor_v: floor_src.floor(),
          sqrt_v: sqrt_src.sqrt(),
          pow_v: pow_base.pow(pow_exp),
          round_v: round_src.round(2),
          greatest_v: i.greatest(j, k),
          least_v: i.least(j, k),
        })
      );
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
      return scalar.select(({ txt, txt2 }) => {
        const trimmed = txt.trim();
        return {
          concat_v: trimmed.concat(txt2),
          upper_v: trimmed.upper(),
          lower_v: trimmed.lower(),
          trim_v: trimmed,
          substring_v: trimmed.substring(2, 5),
          char_length_v: trimmed.charLength(),
          character_length_v: trimmed.characterLength(),
          bit_length_v: trimmed.bitLength(),
          replace_v: trimmed.replace("World", "Duck"),
        };
      });
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
      return scalar.select(({ txt }) => ({ value: txt.trim().octetLength() }));
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
      return scalar.select(({ txt }) => ({ value: txt.trim().position("World") }));
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
      return scalar.select(({ txt }) => ({ value: txt.trim().overlay("Duck", 6, 5) }));
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
      return scalar.select(({ txt }) => ({ value: txt.trim().reverse() }));
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
      return scalar.select(({ txt }) => ({ value: txt.trim().left(5) }));
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
      return scalar.select(({ txt }) => ({ value: txt.trim().right(5) }));
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
      return scalar.select(({ txt }) => ({ value: txt.trim().lpad(12, "_") }));
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
      return scalar.select(({ txt }) => ({ value: txt.trim().rpad(12, "_") }));
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
      return scalar.select(({ txt }) => ({ value: txt.trim().regexLike("^Hello") }));
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
      return scalar.select(({ txt }) => ({ value: txt.trim().regexReplace("World", "Duck") }));
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
      return scalar.select(({ txt }) => ({ value: txt.trim().regexExtract("Hello(.*)", 1) }));
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
      return scalar.select(({ i, j, txt, txt2 }) => ({
        eq_v: i.eq(5),
        ne_v: i.ne(4),
        lt_v: j.lt(i),
        lte_v: j.lte(2),
        gt_v: i.gt(j),
        gte_v: i.gte(5),
        and_v: i.gt(j).and(txt2.eq("World")),
        or_v: i.lt(j).or(txt2.eq("World")),
        not_v: i.lt(j).not(),
        like_v: txt.trim().like("Hello%"),
        in_v: txt2["in"](["Duck", "World"]),
      }));
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
      return scalar.select(({ i, parse_txt, ts, ts_next }) => ({
        current_date_ok: currentDate().isNotNull(),
        current_ts_ok: currentTimestamp().isNotNull(),
        date_trunc_v: ts.dateTrunc("day").dateFormat("%Y-%m-%d %H:%M:%S"),
        date_add_v: ts.dateAdd("day", 2).dateFormat("%Y-%m-%d %H:%M:%S"),
        date_diff_v: ts.dateDiff("day", ts_next),
        date_parse_v: parse_txt.dateParse("%Y-%m-%d %H:%M:%S").dateFormat("%Y-%m-%d %H:%M:%S"),
        date_format_v: ts.dateFormat("%Y-%m-%d"),
        to_unixtime_v: i.sub(5).fromUnixTime().toUnixTime().toInt(),
        from_unixtime_v: i.sub(5).fromUnixTime().dateFormat("%Y-%m-%d %H:%M:%S"),
      }));
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
      return scalar.select(({ ts }) => ({
        extract_year_v: ts.extract("year"),
        year_v: ts.year(),
        month_v: ts.month(),
        day_v: ts.day(),
        hour_v: ts.hour(),
        minute_v: ts.minute(),
        second_v: ts.second(),
      }));
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
      return scalar.select(({ nullable_txt, num_txt, ts, txt, txt2, x }) => ({
        cast_v: num_txt.cast<number>("INTEGER"),
        to_int_v: x.toInt(),
        to_float_v: x.toInt().toFloat(),
        to_date_v: ts.toDate().dateFormat("%Y-%m-%d"),
        coalesce_v: nullable_txt.coalesce(txt2),
        nullif_is_null_v: txt2.nullIf("World").isNull(),
        is_null_v: nullable_txt.isNull(),
        is_not_null_v: txt.isNotNull(),
      }));
    },
    outcomes: {
      sqlite: {
        rows: [
          {
            cast_v: 42,
            to_int_v: 7,
            to_float_v: 7,
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

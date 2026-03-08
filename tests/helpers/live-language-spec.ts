import {
  currentDate,
  currentTimestamp,
  loop,
  table,
  t,
} from "../../mod.ts";

import type { SqlRenderer, SqlResult } from "../../mod.ts";
import type { LiveDialect, LiveRow } from "./live-db.ts";

export type LiveOutcome =
  | { rows: LiveRow[] }
  | { error: RegExp };

export type LiveSpecCase = {
  name: string;
  build: () => { toSql: (renderer: SqlRenderer<any, SqlResult>) => SqlResult };
  outcomes: Record<LiveDialect, LiveOutcome>;
};

function scalarTable() {
  return table("spec_scalar", {
    i: t.int(),
    j: t.int(),
    k: t.int(),
    neg_i: t.int(),
    x: t.float(),
    y: t.float(),
    ceil_src: t.float(),
    floor_src: t.float(),
    sqrt_src: t.float(),
    pow_base: t.float(),
    pow_exp: t.float(),
    round_src: t.float(),
    txt: t.string(),
    txt2: t.string(),
    nullable_txt: t.string(),
    num_txt: t.string(),
    ts: t.timestamp(),
    ts_next: t.timestamp(),
    parse_txt: t.string(),
  });
}

function arrayTable() {
  return table("spec_array", {
    text_arr: t.string(),
    num_arr: t.string(),
    more_num_arr: t.string(),
  });
}

function metricsTable() {
  return table("spec_metrics", {
    grp: t.string(),
    seq: t.int(),
    amount: t.int(),
  });
}

function rankTable() {
  return table("spec_rank", {
    seq: t.int(),
    amount: t.int(),
  });
}

function employeeTable() {
  return table("spec_employees", {
    id: t.int(),
    name: t.string(),
    manager_id: t.int(),
  });
}

const SQLITE_UNSUPPORTED = /no such function|syntax error|wrong number of arguments|no such table/i;

export const LIVE_LANGUAGE_SPEC_CASES: LiveSpecCase[] = [
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
  {
    name: "array core functions",
    build: () => {
      const arrays = arrayTable();
      return arrays.select(({ num_arr, text_arr }) => ({
        length_v: text_arr.arrayLength(),
        contains_v: text_arr.arrayContains("blue"),
        join_v: text_arr.arrayJoin("|"),
        append_v: num_arr.arrayAppend(4),
      }));
    },
    outcomes: {
      sqlite: {
        rows: [
          {
            length_v: 3,
            contains_v: 1,
            join_v: "red|blue|red",
            append_v: "[1,2,3,4]",
          },
        ],
      },
      duckdb: {
        rows: [
          {
            length_v: 3,
            contains_v: true,
            join_v: "red|blue|red",
            append_v: [1, 2, 3, 4],
          },
        ],
      },
    },
  },
  {
    name: "array position",
    build: () => {
      const arrays = arrayTable();
      return arrays.select(({ text_arr }) => ({ value: text_arr.arrayPosition("blue") }));
    },
    outcomes: {
      sqlite: { rows: [{ value: 8 }] },
      duckdb: { rows: [{ value: 2 }] },
    },
  },
  {
    name: "array slice",
    build: () => {
      const arrays = arrayTable();
      return arrays.select(({ num_arr }) => ({ value: num_arr.arraySlice(2, 2) }));
    },
    outcomes: {
      sqlite: { error: SQLITE_UNSUPPORTED },
      duckdb: { rows: [{ value: [2, 3] }] },
    },
  },
  {
    name: "array prepend",
    build: () => {
      const arrays = arrayTable();
      return arrays.select(({ num_arr }) => ({ value: num_arr.arrayPrepend(0) }));
    },
    outcomes: {
      sqlite: { error: SQLITE_UNSUPPORTED },
      duckdb: { rows: [{ value: [0, 1, 2, 3] }] },
    },
  },
  {
    name: "array concat",
    build: () => {
      const arrays = arrayTable();
      return arrays.select(({ more_num_arr, num_arr }) => ({
        value: num_arr.arrayConcat(more_num_arr),
      }));
    },
    outcomes: {
      sqlite: { error: SQLITE_UNSUPPORTED },
      duckdb: { rows: [{ value: [1, 2, 3, 4, 5] }] },
    },
  },
  {
    name: "array distinct",
    build: () => {
      const arrays = arrayTable();
      return arrays.select(({ text_arr }) => ({ value: text_arr.arrayDistinct() }));
    },
    outcomes: {
      sqlite: { error: SQLITE_UNSUPPORTED },
      duckdb: { rows: [{ value: ["blue", "red"] }] },
    },
  },
  {
    name: "aggregates",
    build: () => {
      const metrics = metricsTable();
      return metrics
        .aggregate(({ amount, grp }) => ({
          grp: grp.group(),
          count_v: amount.count(),
          sum_v: amount.sum(),
          avg_v: amount.avg(),
          min_v: amount.min(),
          max_v: amount.max(),
        }))
        .orderBy(({ grp }) => grp.asc());
    },
    outcomes: {
      sqlite: {
        rows: [
          { grp: "a", count_v: 2, sum_v: 30, avg_v: 15, min_v: 10, max_v: 20 },
          { grp: "b", count_v: 2, sum_v: 70, avg_v: 35, min_v: 30, max_v: 40 },
        ],
      },
      duckdb: {
        rows: [
          { grp: "a", count_v: 2, sum_v: 30, avg_v: 15, min_v: 10, max_v: 20 },
          { grp: "b", count_v: 2, sum_v: 70, avg_v: 35, min_v: 30, max_v: 40 },
        ],
      },
    },
  },
  {
    name: "window functions",
    build: () => {
      const ranks = rankTable();
      return ranks
        .select(({ amount, seq }) => ({
          seq,
          amount,
          rank_v: amount.rank().over({ orderBy: amount.desc() }),
          dense_rank_v: amount.denseRank().over({ orderBy: amount.desc() }),
          row_number_v: amount.rowNumber().over({ orderBy: seq.asc() }),
          lag_v: amount.lag(1, 0).over({ orderBy: seq.asc() }),
          lead_v: amount.lead(1, 0).over({ orderBy: seq.asc() }),
          percent_rank_v: amount.percentRank().over({ orderBy: amount.desc() }),
          ntile_v: amount.ntile(2).over({ orderBy: seq.asc() }),
          sum_over_v: amount.sumOver({ orderBy: seq.asc() }),
        }))
        .orderBy(({ seq }) => seq.asc());
    },
    outcomes: {
      sqlite: {
        rows: [
          {
            seq: 1,
            amount: 40,
            rank_v: 1,
            dense_rank_v: 1,
            row_number_v: 1,
            lag_v: 0,
            lead_v: 20,
            percent_rank_v: 0,
            ntile_v: 1,
            sum_over_v: 40,
          },
          {
            seq: 2,
            amount: 20,
            rank_v: 2,
            dense_rank_v: 2,
            row_number_v: 2,
            lag_v: 40,
            lead_v: 20,
            percent_rank_v: 0.3333333333333333,
            ntile_v: 1,
            sum_over_v: 60,
          },
          {
            seq: 3,
            amount: 20,
            rank_v: 2,
            dense_rank_v: 2,
            row_number_v: 3,
            lag_v: 20,
            lead_v: 10,
            percent_rank_v: 0.3333333333333333,
            ntile_v: 2,
            sum_over_v: 80,
          },
          {
            seq: 4,
            amount: 10,
            rank_v: 4,
            dense_rank_v: 3,
            row_number_v: 4,
            lag_v: 20,
            lead_v: 0,
            percent_rank_v: 1,
            ntile_v: 2,
            sum_over_v: 90,
          },
        ],
      },
      duckdb: {
        rows: [
          {
            seq: 1,
            amount: 40,
            rank_v: 1,
            dense_rank_v: 1,
            row_number_v: 1,
            lag_v: 0,
            lead_v: 20,
            percent_rank_v: 0,
            ntile_v: 1,
            sum_over_v: 40,
          },
          {
            seq: 2,
            amount: 20,
            rank_v: 2,
            dense_rank_v: 2,
            row_number_v: 2,
            lag_v: 40,
            lead_v: 20,
            percent_rank_v: 0.3333333333333333,
            ntile_v: 1,
            sum_over_v: 60,
          },
          {
            seq: 3,
            amount: 20,
            rank_v: 2,
            dense_rank_v: 2,
            row_number_v: 3,
            lag_v: 20,
            lead_v: 10,
            percent_rank_v: 0.3333333333333333,
            ntile_v: 2,
            sum_over_v: 80,
          },
          {
            seq: 4,
            amount: 10,
            rank_v: 4,
            dense_rank_v: 3,
            row_number_v: 4,
            lag_v: 20,
            lead_v: 0,
            percent_rank_v: 1,
            ntile_v: 2,
            sum_over_v: 90,
          },
        ],
      },
    },
  },
  {
    name: "recursive cte",
    build: () => {
      const employees = employeeTable();
      const orgTree = loop(
        employees
          .filter((employee) => employee.manager_id.isNull())
          .select((employee) => ({
            id: employee.id,
            name: employee.name,
            manager_id: employee.manager_id,
          })),
        (self) =>
          employees.join(
            self,
            (employee, current) => employee.manager_id.eq(current.id),
            (employee) => ({
              id: employee.id,
              name: employee.name,
              manager_id: employee.manager_id,
            })
          )
      );

      return orgTree
        .select((employee) => ({ id: employee.id, name: employee.name }))
        .orderBy((employee) => employee.id.asc());
    },
    outcomes: {
      sqlite: {
        rows: [
          { id: 1, name: "CEO" },
          { id: 2, name: "CTO" },
          { id: 3, name: "DEV" },
        ],
      },
      duckdb: {
        rows: [
          { id: 1, name: "CEO" },
          { id: 2, name: "CTO" },
          { id: 3, name: "DEV" },
        ],
      },
    },
  },
];

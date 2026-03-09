import { SQLITE_UNSUPPORTED, arrayTable } from "./live-language-spec-shared.ts";
import type { LiveSpecCase } from "./live-language-spec-shared.ts";

export const LIVE_LANGUAGE_ARRAY_CASES: LiveSpecCase[] = [
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
];

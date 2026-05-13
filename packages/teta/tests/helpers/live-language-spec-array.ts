import { SQLITE_UNSUPPORTED, arrayTable } from "./live-language-spec-shared.ts";
import type { LiveSpecCase } from "./live-language-spec-shared.ts";
import { map, arrayAppend, arrayConcat, arrayContains, arrayDistinct, arrayJoin, arrayLength, arrayPosition, arrayPrepend, arraySlice, pipe } from "../../mod.ts";
export const LIVE_LANGUAGE_ARRAY_CASES: LiveSpecCase[] = [
    {
        name: "array core functions",
        build: () => {
            const arrays = arrayTable();
            return pipe(arrays, map(({ num_arr, text_arr }) => ({
                length_v: arrayLength(text_arr),
                contains_v: arrayContains(text_arr, "blue"),
                join_v: arrayJoin(text_arr, "|"),
                append_v: arrayAppend(num_arr, 4),
            })));
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
            return pipe(arrays, map(({ text_arr }) => ({ value: arrayPosition(text_arr, "blue") })));
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
            return pipe(arrays, map(({ num_arr }) => ({ value: arraySlice(num_arr, 2, 2) })));
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
            return pipe(arrays, map(({ num_arr }) => ({ value: arrayPrepend(num_arr, 0) })));
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
            return pipe(arrays, map(({ more_num_arr, num_arr }) => ({
                value: arrayConcat(num_arr, more_num_arr),
            })));
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
            return pipe(arrays, map(({ text_arr }) => ({ value: arrayDistinct(text_arr) })));
        },
        outcomes: {
            sqlite: { error: SQLITE_UNSUPPORTED },
            duckdb: { rows: [{ value: ["blue", "red"] }] },
        },
    },
];

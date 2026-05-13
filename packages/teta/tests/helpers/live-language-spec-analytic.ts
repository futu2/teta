import { employeeTable, metricsTable, rankTable } from "./live-language-spec-shared.ts";
import type { LiveSpecCase } from "./live-language-spec-shared.ts";
import { fold, filter, join, map, asc, avg, count, denseRank, desc, eq, group, isNull, lag, lead, max, min, ntile, sort, percentRank, rank, rowNumber, sum, sumOver, loop, over, pipe } from "../../mod.ts";
export const LIVE_LANGUAGE_ANALYTIC_CASES: LiveSpecCase[] = [
    {
        name: "aggregates",
        build: () => {
            const metrics = metricsTable();
            return pipe(metrics, fold(({ amount, grp }) => ({
                grp: group(grp),
                count_v: count(amount),
                sum_v: sum(amount),
                avg_v: avg(amount),
                min_v: min(amount),
                max_v: max(amount),
            })), sort(({ grp }) => asc(grp)));
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
            return pipe(ranks, map(({ amount, seq }) => ({
                seq,
                amount,
                rank_v: over(rank(amount), { orderBy: desc(amount) }),
                dense_rank_v: over(denseRank(amount), { orderBy: desc(amount) }),
                row_number_v: over(rowNumber(amount), { orderBy: asc(seq) }),
                lag_v: over(lag(amount, 1, 0), { orderBy: asc(seq) }),
                lead_v: over(lead(amount, 1, 0), { orderBy: asc(seq) }),
                percent_rank_v: over(percentRank(amount), { orderBy: desc(amount) }),
                ntile_v: over(ntile(amount, 2), { orderBy: asc(seq) }),
                sum_over_v: sumOver(amount, { orderBy: asc(seq) }),
            })), sort(({ seq }) => asc(seq)));
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
                pipe(
                    employees,
                    filter((employee) => isNull(employee.manager_id)),
                    map((employee) => ({
                        id: employee.id,
                        name: employee.name,
                        manager_id: employee.manager_id,
                    }))
                ),
                (self) => pipe(
                    employees,
                    join(
                        self,
                        (employee, current) => eq(employee.manager_id, current.id),
                        (employee) => ({
                            id: employee.id,
                            name: employee.name,
                            manager_id: employee.manager_id,
                        })
                    )
                )
            );
            return pipe(orgTree, map((employee) => ({ id: employee.id, name: employee.name })), sort((employee) => asc(employee.id)));
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

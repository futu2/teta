import { employeeTable, loop, metricsTable, rankTable } from "./live-language-spec-shared.ts";
import type { LiveSpecCase } from "./live-language-spec-shared.ts";

export const LIVE_LANGUAGE_ANALYTIC_CASES: LiveSpecCase[] = [
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
            { merge: (employee) => ({
              id: employee.id,
              name: employee.name,
              manager_id: employee.manager_id,
            }) }
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

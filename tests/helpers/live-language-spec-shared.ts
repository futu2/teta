import {
  currentDate,
  currentTimestamp,
  table,
  t,
} from "../../mod.ts";

import type { SqlCompilable } from "../../mod.ts";
import type { LiveDialect, LiveRow } from "./live-db.ts";

export { currentDate, currentTimestamp };

export type LiveOutcome =
  | { rows: LiveRow[] }
  | { error: RegExp };

export type LiveSpecCase = {
  name: string;
  build: () => SqlCompilable;
  outcomes: Record<LiveDialect, LiveOutcome>;
};

export function scalarTable() {
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

export function arrayTable() {
  return table("spec_array", {
    text_arr: t.string(),
    num_arr: t.string(),
    more_num_arr: t.string(),
  });
}

export function metricsTable() {
  return table("spec_metrics", {
    grp: t.string(),
    seq: t.int(),
    amount: t.int(),
  });
}

export function rankTable() {
  return table("spec_rank", {
    seq: t.int(),
    amount: t.int(),
  });
}

export function employeeTable() {
  return table("spec_employees", {
    id: t.int(),
    name: t.string(),
    manager_id: t.int(),
  });
}

export const SQLITE_UNSUPPORTED = /no such function|syntax error|wrong number of arguments|no such table/i;

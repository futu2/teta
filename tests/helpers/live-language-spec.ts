export type { LiveOutcome, LiveSpecCase } from "./live-language-spec-shared.ts";

import { LIVE_LANGUAGE_ANALYTIC_CASES } from "./live-language-spec-analytic.ts";
import { LIVE_LANGUAGE_ARRAY_CASES } from "./live-language-spec-array.ts";
import { LIVE_LANGUAGE_SCALAR_CASES } from "./live-language-spec-scalar.ts";

export const LIVE_LANGUAGE_SPEC_CASES = [
  ...LIVE_LANGUAGE_SCALAR_CASES,
  ...LIVE_LANGUAGE_ARRAY_CASES,
  ...LIVE_LANGUAGE_ANALYTIC_CASES,
];

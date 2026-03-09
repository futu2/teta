import {
  avg,
  count,
  denseRank,
  group,
  lag,
  lead,
  max,
  min,
  ntile,
  percentRank,
  rank,
  rowNumber,
  sum,
  sumOver,
} from "../ops/aggregate";
import { defineExprMethods } from "./shared";

defineExprMethods([
  ["group", group],
  ["count", count],
  ["sum", sum],
  ["avg", avg],
  ["min", min],
  ["max", max],
  ["rank", rank],
  ["denseRank", denseRank],
  ["rowNumber", rowNumber],
  ["lag", lag],
  ["lead", lead],
  ["percentRank", percentRank],
  ["ntile", ntile],
  ["sumOver", sumOver],
]);

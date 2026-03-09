import { and, asc, desc, eq, gt, gte, isIn, isNotNull, isNull, like, lt, lte, ne, not, or } from "../ops/comparison";
import { defineExprMethods } from "./shared";

defineExprMethods([
  ["eq", eq],
  ["ne", ne],
  ["gt", gt],
  ["gte", gte],
  ["lt", lt],
  ["lte", lte],
  ["like", like],
  ["in", isIn],
  ["and", and],
  ["or", or],
  ["not", not],
  ["isNull", isNull],
  ["isNotNull", isNotNull],
  ["asc", asc],
  ["desc", desc],
]);

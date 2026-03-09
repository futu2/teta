import { coalesce, nullIf } from "../ops/null";
import { defineExprMethods } from "./shared";

defineExprMethods([
  ["coalesce", coalesce],
  ["nullIf", nullIf],
]);

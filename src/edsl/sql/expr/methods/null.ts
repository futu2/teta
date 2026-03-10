import { coalesce, nullIf } from "../ops/null.ts";
import { defineExprMethods } from "./shared.ts";

defineExprMethods([
  ["coalesce", coalesce],
  ["nullIf", nullIf],
]);

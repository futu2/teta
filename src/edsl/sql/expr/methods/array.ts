import {
  arrayAppend,
  arrayConcat,
  arrayContains,
  arrayDistinct,
  arrayJoin,
  arrayLength,
  arrayPosition,
  arrayPrepend,
  arraySlice,
} from "../ops/array.ts";
import { defineExprMethods } from "./shared.ts";

defineExprMethods([
  ["arrayLength", arrayLength],
  ["arrayContains", arrayContains],
  ["arrayPosition", arrayPosition],
  ["arraySlice", arraySlice],
  ["arrayJoin", arrayJoin],
  ["arrayAppend", arrayAppend],
  ["arrayPrepend", arrayPrepend],
  ["arrayConcat", arrayConcat],
  ["arrayDistinct", arrayDistinct],
]);

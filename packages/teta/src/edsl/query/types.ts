import type {
  SqlBigInt,
  SqlBoolean,
  SqlBytes,
  SqlDate,
  SqlDecimal,
  SqlFloat,
  SqlInt,
  SqlJson,
  SqlString,
  SqlTimestamp,
  SqlUuid,
} from "../types.ts";

export type QueryValue =
  | SqlInt
  | SqlFloat
  | SqlBigInt
  | SqlDecimal
  | SqlString
  | SqlBoolean
  | SqlDate
  | SqlTimestamp
  | SqlUuid
  | SqlBytes
  | SqlJson
  | null
  | readonly QueryValue[];

export type QueryColumns = Record<string, QueryValue>;

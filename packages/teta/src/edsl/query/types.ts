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
  SqlUnknown,
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
  | SqlUnknown
  | null
  | readonly QueryValue[];

export type QueryColumns = Readonly<Record<string, QueryValue>>;

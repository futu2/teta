import type { Dialect, QueryDialect } from "../types.ts";
import { getDefaultDialect, resolveNamedDialect } from "./resolve_common.ts";
import { isDialectSpec, resolveDialectSpec } from "./resolve_spec.ts";

export function resolveDialect(dialect?: Dialect): QueryDialect {
  if (!dialect) return getDefaultDialect();
  if (typeof dialect === "object") {
    if (isDialectSpec(dialect)) return resolveDialectSpec(dialect);
    return getDefaultDialect();
  }

  const raw = dialect.toString().trim();
  if (!raw) return getDefaultDialect();
  return resolveNamedDialect(raw);
}

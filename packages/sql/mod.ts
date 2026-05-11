export * from "./src/errors.ts";
export * from "./src/ir/types.ts";
export { validateQueryIR } from "./src/ir/validate.ts";
export * as ir from "./src/ir/builders.ts";

function backendNotMigrated(name: string): never {
  throw new Error(`${name} is not migrated yet`);
}

export function irToAst(): never {
  backendNotMigrated("irToAst");
}

export function irToSql(): never {
  backendNotMigrated("irToSql");
}

export function irToSqlResult(): never {
  backendNotMigrated("irToSqlResult");
}

export function exprToSql(): never {
  backendNotMigrated("exprToSql");
}

export function exprToSqlResult(): never {
  backendNotMigrated("exprToSqlResult");
}

export function explainIR(): never {
  backendNotMigrated("explainIR");
}

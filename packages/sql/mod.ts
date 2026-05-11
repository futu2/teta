function backendNotMigrated(name: string): never {
  throw new Error(`${name} is not migrated yet`);
}

export const ir = {
  validateQueryIR: (value: unknown): void => {
    if (typeof value !== "object" || value === null) {
      backendNotMigrated("validateQueryIR");
    }
  },
};

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

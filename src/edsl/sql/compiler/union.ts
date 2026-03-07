import type { With } from "node-sql-parser";
import type { Source, SourceRef, Stage } from "../../core/types";
import type { QueryDialect } from "../types";
import { createColumnRefs } from "../../core/expr";
import type { SelectAst } from "./types";
import { ensureAlias, toParserSelect } from "./ast";
import { buildPipelineAst } from "./build";
import { getDefaultDialect } from "../dialect";
import { exprToAst, qualifyForBase } from "./render";
import { buildSelectAst, sourceToFrom } from "./select";

export function compileUnionStage(
  stage: Extract<Stage, { kind: "union" }>,
  source: SourceRef,
  ctes: With[],
  rightPrefix: string,
  keepTables?: Set<string>,
  dialect: QueryDialect = getDefaultDialect()
): SelectAst {
  const baseFrom = sourceToFrom(source);
  const baseAlias = ensureAlias(baseFrom);
  const leftAst = buildSelectAst({
    from: [baseFrom],
    columns: stage.selectAll.map((item) => ({
      expr: exprToAst(qualifyForBase(item.expr, baseAlias, keepTables, dialect)),
      as: item.as,
    })),
    where: null,
    groupby: null,
    orderby: null,
    limit: null,
  });

  const rightColumns = createColumnRefs<Record<string, unknown>>(null, stage.right.columnNames);
  void rightColumns;
  const rightCompiled = buildPipelineAst(stage.right.source, stage.right.stages, stage.right.columnNames, {
    ctePrefix: rightPrefix,
    keepTables,
    dialect,
  });
  if (rightCompiled.ctes.length) {
    ctes.push(...rightCompiled.ctes);
  }
  const rightAst = rightCompiled.ast;
  rightAst.with = null;

  return attachUnion(leftAst, rightAst, stage.op);
}

export function attachUnion(
  left: SelectAst,
  right: SelectAst,
  op: "union" | "union all"
): SelectAst {
  left.set_op = op;
  left._next = toParserSelect(right);
  return left;
}

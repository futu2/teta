import { describe, expect, test } from "bun:test";
import { table, t, map, replace } from "../mod.ts";
import { renderPipelineAst } from "../src/edsl/sql/render/pipeline.ts";
describe("pipeline render pipeline", () => {
    test("prepends base CTEs before generated stage CTEs", () => {
        const users = table("users", {
            id: t.int(),
            name: t.string(),
        });
        const base = table("base_users", {
            id: t.int(),
        });
        const filtered = map(map(users, (user) => ({
            id: user.id,
            normalized_name: replace(user.name, " ", "_"),
        })), (row) => ({
            id: row.id,
        }));
        const ast = renderPipelineAst(filtered.source, filtered.stages, filtered.columnNames, filtered.sourceScopeId, {
            ctePrefix: "test_",
            baseCtes: [
                {
                    kind: "query",
                    name: "seed",
                    query: {
                        source: base.source,
                        stages: base.stages,
                        columnNames: base.columnNames,
                        columnIdentifiers: base.columnIdentifiers,
                        scopeId: base.sourceScopeId,
                    },
                },
            ],
        }) as any;
        expect(ast.with).toHaveLength(2);
        expect(ast.with[0].name.value).toBe("seed");
        expect(ast.with[0].columns?.map((column: any) => column.column.expr.value)).toEqual(["id"]);
        expect(ast.with[1].name.value).toBe("test_cte_0");
    });
});

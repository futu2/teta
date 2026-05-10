import { describe, expect, test } from "bun:test";
import { pipe } from "remeda";
import { table, t, map, replace } from "../mod.ts";
import { renderPipelineAst } from "../src/edsl/sql/render/pipeline.ts";
describe("pipeline render pipeline", () => {
    test("drops unused base CTEs before attaching generated stage CTEs", () => {
        const users = table("users", {
            id: t.int(),
            name: t.string(),
        });
        const base = table("base_users", {
            id: t.int(),
        });
        const filtered = pipe(
            users,
            map((user) => ({
                id: user.id,
                normalized_name: replace(user.name, " ", "_"),
            })),
            map((row) => ({
                id: row.id,
            }))
        );
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
        expect(ast.with).toHaveLength(1);
        expect(ast.with[0].name.value).toBe("test_cte_0");
        expect(ast.with.map((cte: any) => cte.name.value)).not.toContain("seed");
    });
});

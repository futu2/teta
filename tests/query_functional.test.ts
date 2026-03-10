import { describe, expect, test } from "bun:test";
import { pipe } from "remeda";
import { filter, limit, orderBy, select, sqlRenderer, toSql, asc, desc, eq, gte, replace, and, coalesce } from "../mod.ts";
import { USER_PIPELINE_POSTGRES_COMPACT } from "./helpers/expected-sql.ts";
import { createUsersPipelineTable } from "./helpers/fixtures.ts";
describe("function-first query api", () => {
    test("composes a pipeline with remeda pipe", () => {
        const users = createUsersPipelineTable();
        const query = pipe(users, filter((user: typeof users.columns) => and(eq(user.active, true), gte(user.age, 18))), select((user) => ({
            id: user.id,
            name: coalesce(replace(user.name, " ", "_"), "unknown"),
            age: user.age,
        })), orderBy((row) => [asc(row.name), desc(row.id)]), limit(20));
        expect(toSql(query, sqlRenderer({ dialect: "postgresql", format: "compact" }))).toBe(USER_PIPELINE_POSTGRES_COMPACT);
    });
});

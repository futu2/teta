import { describe, expect, test } from "bun:test";

import { eq, filter, map, pipe, t, table } from "../mod.ts";
import { getQueryState } from "../src/edsl/query/core.ts";

describe("persistent query state", () => {
  test("shares frozen source and prior stages across derived queries", () => {
    const users = table("users", { id: t.int(), name: t.string() });
    const projected = pipe(users, map((user) => ({ id: user.id })));
    const filtered = pipe(projected, filter((user) => eq(user.id, 1)));

    const projectedState = getQueryState(projected);
    const filteredState = getQueryState(filtered);

    expect(filteredState.source).toBe(projectedState.source);
    expect(filteredState.stages[0]).toBe(projectedState.stages[0]);
    expect(Object.isFrozen(filteredState.source)).toBe(true);
    expect(Object.isFrozen(filteredState.stages)).toBe(true);
  });
});

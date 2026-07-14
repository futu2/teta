import { describe, expect, test } from "bun:test";
import {
  composeSteps,
  eq,
  filter,
  gt,
  identityStep,
  map,
  pipe,
  table,
  t,
  take,
  toIR,
  toSql,
} from "../mod.ts";
import {
  composeSteps as composeStepsFromQuery,
  filter as filterFromQuery,
  table as tableFromQuery,
} from "../query.ts";
import { eq as eqFromExpr } from "../expr.ts";
import { pipe as pipeFromSubpath } from "../pipe.ts";

describe("query algebra laws", () => {
  const users = table("users", {
    id: t.int(),
    name: t.string(),
  });

  test("identityStep is a left and right identity for rendered queries", () => {
    const query = pipe(
      users,
      filter((user) => gt(user.id, 0)),
      map((user) => ({
        id: user.id,
        name: user.name,
      }))
    );
    const options = { dialect: "postgresql", format: "compact" } as const;

    expect(toSql(pipe(users, identityStep()), options)).toBe(toSql(users, options));
    expect(toSql(pipe(query, identityStep()), options)).toBe(toSql(query, options));
  });

  test("composeSteps has identity and associative rendering laws", () => {
    const positiveId = filter((user: typeof users.columns) => gt(user.id, 0));
    const namedAda = filter((user: typeof users.columns) => eq(user.name, "Ada"));
    const belowHundred = filter((user: typeof users.columns) => gt(100, user.id));
    const options = { dialect: "postgresql", format: "compact" } as const;

    const expected = toSql(pipe(users, positiveId, namedAda, belowHundred), options);
    const leftAssociated = composeSteps(
      composeSteps(positiveId, namedAda),
      belowHundred
    );
    const rightAssociated = composeSteps(
      positiveId,
      composeSteps(namedAda, belowHundred)
    );

    expect(toSql(pipe(users, composeSteps()), options)).toBe(toSql(users, options));
    expect(toSql(pipe(users, composeSteps(identityStep(), positiveId)), options)).toBe(
      toSql(pipe(users, positiveId), options)
    );
    expect(toSql(pipe(users, composeSteps(positiveId, identityStep())), options)).toBe(
      toSql(pipe(users, positiveId), options)
    );
    expect(toSql(pipe(users, leftAssociated), options)).toBe(expected);
    expect(toSql(pipe(users, rightAssociated), options)).toBe(expected);
  });

  test("adjacent filters normalize to one conjunctive filter", () => {
    const separateFilters = pipe(
      users,
      filter((user) => gt(user.id, 0)),
      filter((user) => eq(user.name, "Ada"))
    );
    const stages = toIR(separateFilters).stages;

    expect(stages).toHaveLength(1);
    expect(stages[0]?.kind).toBe("filter");
    expect(toSql(separateFilters, { dialect: "postgresql", format: "compact" })).toBe(
      "SELECT users_0.id AS id, users_0.name AS name FROM users AS users_0 WHERE users_0.id > 0 AND users_0.name = 'Ada'"
    );
  });

  test("subpath entrypoints compose with the root entrypoint", () => {
    const accounts = tableFromQuery("accounts", {
      id: t.int(),
    });
    const query = pipeFromSubpath(
      accounts,
      composeStepsFromQuery(
        filterFromQuery((account) => eqFromExpr(account.id, 1)),
        take(1)
      )
    );

    expect(toSql(query, { dialect: "postgresql", format: "compact" })).toBe(
      "SELECT accounts_0.id AS id FROM accounts AS accounts_0 WHERE accounts_0.id = 1 LIMIT 1"
    );
  });
});

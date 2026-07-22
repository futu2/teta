import { expect, test } from "bun:test";

import { dayOfWeek, timestampLiteral, toSql } from "../mod.ts";

test("dayOfWeek renders the day_of_week SQL function", () => {
  expect(toSql(dayOfWeek(timestampLiteral("2024-01-02 03:04:05")), {
    dialect: "postgresql",
  })).toBe("day_of_week(TIMESTAMP '2024-01-02 03:04:05')");
});

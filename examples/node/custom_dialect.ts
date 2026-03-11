import { bitLength, characterLength, dateFormat, map, table, t, toSql } from "../../mod.ts";

const users = table("users", {
  id: t.int(),
  name: t.string(),
  created_at: t.timestamp(),
});

const customSqliteRenderer = {
  dialect: {
    name: "sqlite_custom",
    parserDialect: "SQLite",
    language: {
      functions: {
        CHARACTER_LENGTH: "LENGTH",
      },
      fallbacks: {
        BIT_LENGTH: "bit_length_via_length_x8",
        DATE_FORMAT: "date_format_via_strftime",
      },
      unsupported: ["OVERLAY"],
    },
  },
  format: "pretty",
});

const report = map(users, (user) => ({
  id: user.id,
  name_chars: characterLength(user.name),
  name_bits: bitLength(user.name),
  created_fmt: dateFormat(user.created_at, "%Y-%m-%d"),
}));

console.log(toSql(report, customSqliteRenderer));

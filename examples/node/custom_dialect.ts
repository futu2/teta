import { sqlRenderer, table, t } from "../../mod.ts";

const users = table("users", {
  id: t.int(),
  name: t.string(),
  created_at: t.timestamp(),
});

const customSqliteRenderer = sqlRenderer({
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

const report = users.select((user) => ({
  id: user.id,
  name_chars: user.name.characterLength(),
  name_bits: user.name.bitLength(),
  created_fmt: user.created_at.dateFormat("%Y-%m-%d"),
}));

console.log(report.toSql(customSqliteRenderer));

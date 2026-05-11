export function normalizeUnit(value: string | null): string | null {
  if (!value) return null;
  const unit = value.trim().toLowerCase();
  if (!unit) return null;
  switch (unit) {
    case "years":
    case "year":
    case "yy":
    case "yyyy":
      return "year";
    case "quarters":
    case "quarter":
    case "qq":
      return "quarter";
    case "months":
    case "month":
    case "mm":
      return "month";
    case "weeks":
    case "week":
    case "wk":
      return "week";
    case "days":
    case "day":
    case "dd":
      return "day";
    case "hours":
    case "hour":
    case "hh":
      return "hour";
    case "minutes":
    case "minute":
    case "mi":
      return "minute";
    case "seconds":
    case "second":
    case "ss":
      return "second";
    default:
      return unit;
  }
}

export const SQLITE_EXTRACT_FORMATS: Record<string, string> = {
  year: "%Y",
  quarter: "%m",
  month: "%m",
  week: "%W",
  day: "%d",
  hour: "%H",
  minute: "%M",
  second: "%S",
  epoch: "%s",
};

export const DATE_TRUNC_FORMATS: Record<string, string> = {
  year: "%Y-01-01 00:00:00",
  quarter: "%Y-%m-01 00:00:00",
  month: "%Y-%m-01 00:00:00",
  day: "%Y-%m-%d 00:00:00",
  hour: "%Y-%m-%d %H:00:00",
  minute: "%Y-%m-%d %H:%M:00",
  second: "%Y-%m-%d %H:%M:%S",
};

export const DATE_ADD_TEMPLATES: Record<string, { unit: string; factor: number }> = {
  year: { unit: "year", factor: 1 },
  quarter: { unit: "month", factor: 3 },
  month: { unit: "month", factor: 1 },
  week: { unit: "day", factor: 7 },
  day: { unit: "day", factor: 1 },
  hour: { unit: "hour", factor: 1 },
  minute: { unit: "minute", factor: 1 },
  second: { unit: "second", factor: 1 },
};

export const DATE_ADD_EPOCH_FACTORS: Record<string, number> = {
  week: 60 * 60 * 24 * 7,
  day: 60 * 60 * 24,
  hour: 60 * 60,
  minute: 60,
  second: 1,
};

export const DATE_DIFF_EPOCH_FACTORS: Record<string, number> = {
  week: 60 * 60 * 24 * 7,
  day: 60 * 60 * 24,
  hour: 60 * 60,
  minute: 60,
  second: 1,
};

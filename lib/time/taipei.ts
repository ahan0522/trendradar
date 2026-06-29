function monthPart(value: string) {
  const month = value.slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("Month must use YYYY-MM");
  const parsed = new Date(`${month}-01T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 7) !== month) {
    throw new Error("Invalid month");
  }
  return month;
}

export function taipeiMonthStartIso(value: string) {
  return `${monthPart(value)}-01T00:00:00+08:00`;
}

export function taipeiNextMonthStartIso(value: string) {
  const month = monthPart(value);
  const date = new Date(`${month}-01T00:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + 1);
  return `${date.toISOString().slice(0, 7)}-01T00:00:00+08:00`;
}

export function taipeiMonthForTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid timestamp");
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
  }).format(date);
}

export function taipeiDateForTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid timestamp");
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

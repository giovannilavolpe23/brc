const argentinaFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Argentina/Buenos_Aires",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export class DateKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DateKeyError";
  }
}

export function todayInArgentina(now = new Date()): string {
  const parts = argentinaFormatter.formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) {
    throw new DateKeyError("invalid_argentina_date");
  }

  return `${year}-${month}-${day}`;
}

export function validatePastDateKey(dateKey: string, now = new Date()): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || !isRealDateKey(dateKey)) {
    throw new DateKeyError("invalid_date_key");
  }

  if (dateKey >= todayInArgentina(now)) {
    throw new DateKeyError("date_must_be_before_today");
  }

  return dateKey;
}

function isRealDateKey(dateKey: string): boolean {
  const [year, month, day] = dateKey.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

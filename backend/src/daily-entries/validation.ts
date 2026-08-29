import type { DailyEntryInput } from "./types";

export class DailyEntryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DailyEntryValidationError";
  }
}

export function parseDailyEntryInput(body: unknown): DailyEntryInput {
  const record = getRecord(body);
  if ("computed" in record) {
    throw new DailyEntryValidationError("computed_fields_are_not_accepted");
  }

  const sleep = parseSleep(record.sleep);
  const nap = parseNap(record.nap);
  const fifthMeal = parseFifthMeal(record.fifthMeal);
  const bathroom = parseBathroom(record.bathroom);
  const boliche = parseBoliche(record.boliche);

  return { sleep, nap, fifthMeal, bathroom, boliche };
}

function parseSleep(value: unknown): DailyEntryInput["sleep"] {
  const sleep = getRecord(value);
  const didNotSleep = parseBoolean(sleep.didNotSleep, "invalid_sleep");
  const bedtime = didNotSleep ? null : parseNullableTime(sleep.bedtime, "invalid_sleep_bedtime");
  const wake = didNotSleep ? null : parseNullableTime(sleep.wake, "invalid_sleep_wake");
  return { didNotSleep, bedtime, wake };
}

function parseNap(value: unknown): DailyEntryInput["nap"] {
  if (value === null || value === undefined) return null;
  const nap = getRecord(value);
  const start = parseRequiredTime(nap.start, "invalid_nap_start");
  const end = parseRequiredTime(nap.end, "invalid_nap_end");
  if (end < start) {
    throw new DailyEntryValidationError("invalid_nap_range");
  }

  return { start, end };
}

function parseFifthMeal(value: unknown): DailyEntryInput["fifthMeal"] {
  if (value === null || value === undefined) return null;
  if (value === "yes" || value === "no") return value;
  throw new DailyEntryValidationError("invalid_fifth_meal");
}

function parseBathroom(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 5) {
    throw new DailyEntryValidationError("invalid_bathroom");
  }

  return value;
}

function parseBoliche(value: unknown): DailyEntryInput["boliche"] {
  const boliche = getRecord(value);
  const didNotGo = parseBoolean(boliche.didNotGo, "invalid_boliche");
  const time = didNotGo ? null : parseNullableTime(boliche.time, "invalid_boliche_time");
  return { didNotGo, time };
}

function getRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new DailyEntryValidationError("invalid_body");
  }

  return value as Record<string, unknown>;
}

function parseBoolean(value: unknown, error: string): boolean {
  if (typeof value !== "boolean") {
    throw new DailyEntryValidationError(error);
  }

  return value;
}

function parseNullableTime(value: unknown, error: string): string | null {
  if (value === null || value === undefined) return null;
  return parseRequiredTime(value, error);
}

function parseRequiredTime(value: unknown, error: string): string {
  if (typeof value !== "string" || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    throw new DailyEntryValidationError(error);
  }

  return value;
}

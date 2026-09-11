import type { DailyEntryInput } from "./types";

const BOLICHE_CLOSED_CLUB_TIME = "06:45";

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
  validateLogicalTimes(sleep, nap, boliche);

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
  if (timeToMinutes(end) <= timeToMinutes(start)) {
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
  const closedClub = didNotGo ? false : parseOptionalBoolean(boliche.closedClub, "invalid_boliche_closed_club");
  const time = didNotGo || closedClub ? null : parseNullableTime(boliche.time, "invalid_boliche_time");
  if (!didNotGo && closedClub && boliche.time !== null && boliche.time !== undefined) {
    throw new DailyEntryValidationError("invalid_boliche_closed_club_conflict");
  }
  if (didNotGo && boliche.closedClub === true) {
    throw new DailyEntryValidationError("invalid_boliche_closed_club_conflict");
  }
  return { didNotGo, time, closedClub };
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

function parseOptionalBoolean(value: unknown, error: string): boolean {
  if (value === null || value === undefined) return false;
  return parseBoolean(value, error);
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

function validateLogicalTimes(
  sleep: DailyEntryInput["sleep"],
  nap: DailyEntryInput["nap"],
  boliche: DailyEntryInput["boliche"]
): void {
  if (!sleep.didNotSleep && sleep.bedtime && sleep.wake && wakeAbsoluteMinutes(sleep.wake) <= bedtimeAbsoluteMinutes(sleep.bedtime)) {
    throw new DailyEntryValidationError("invalid_sleep_range");
  }

  if (nap && sleep.wake && timeToMinutes(nap.start) < timeToMinutes(sleep.wake)) {
    throw new DailyEntryValidationError("invalid_nap_start_before_wake");
  }

  const bolicheExitTime = boliche.closedClub ? BOLICHE_CLOSED_CLUB_TIME : boliche.time;
  if (!boliche.didNotGo && bolicheExitTime) {
    if (!sleep.didNotSleep && !sleep.bedtime) {
      throw new DailyEntryValidationError("invalid_boliche_sleep_required");
    }

    const exit = timeToMinutes(bolicheExitTime);
    const exitAbsolute = exit + 24 * 60;
    const openAbsolute = 25 * 60;
    const closeAbsolute = 31 * 60;
    const latestExit = sleep.didNotSleep ? closeAbsolute : bedtimeAbsoluteMinutes(sleep.bedtime as string) - 10;
    if (exitAbsolute < openAbsolute || exitAbsolute > latestExit) {
      throw new DailyEntryValidationError("invalid_boliche_time_range");
    }
  }
}

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function bedtimeAbsoluteMinutes(value: string): number {
  const minutes = timeToMinutes(value);
  return minutes <= 9 * 60 ? minutes + 24 * 60 : minutes;
}

function wakeAbsoluteMinutes(value: string): number {
  return timeToMinutes(value) + 24 * 60;
}

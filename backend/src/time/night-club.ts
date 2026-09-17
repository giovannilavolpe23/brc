export const DEFAULT_CLUB_OPEN_TIME = "01:00";
export const DEFAULT_CLUB_CLOSE_TIME = "06:45";
export const NIGHT_CLUB_MAX_RANGE_MINUTES = 12 * 60;

export type ClubTimeConfig = {
  openTime: string;
  closeTime: string;
};

export const DEFAULT_CLUB_TIME_CONFIG: ClubTimeConfig = {
  openTime: DEFAULT_CLUB_OPEN_TIME,
  closeTime: DEFAULT_CLUB_CLOSE_TIME,
};

export class ClubTimeConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClubTimeConfigError";
  }
}

export function validateClubTimeConfig(config: ClubTimeConfig): ClubTimeConfig {
  assertTime(config.openTime, "invalid_club_open_time");
  assertTime(config.closeTime, "invalid_club_close_time");
  if (config.openTime === config.closeTime) throw new ClubTimeConfigError("invalid_club_time_range");
  const range = nightRange(config);
  if (range.close <= range.open || range.close - range.open > NIGHT_CLUB_MAX_RANGE_MINUTES) {
    throw new ClubTimeConfigError("invalid_club_time_range");
  }
  return config;
}

export function nightRange(config: ClubTimeConfig): { open: number; close: number } {
  const open = nightTimelineMinutes(config.openTime);
  const close = normalizeAfterOpen(config.closeTime, open);
  return { open, close };
}

export function normalizeClubTime(value: string, config: ClubTimeConfig): number {
  assertTime(value, "invalid_time");
  return normalizeAfterOpen(value, nightTimelineMinutes(config.openTime));
}

export function isClubEntryTime(value: string, config: ClubTimeConfig): boolean {
  const range = nightRange(config);
  const candidate = normalizeAfterOpen(value, range.open);
  return candidate >= range.open && candidate < range.close;
}

export function isRegularClubExitTime(entryTime: string, exitTime: string, config: ClubTimeConfig): boolean {
  const range = nightRange(config);
  const entry = normalizeAfterOpen(entryTime, range.open);
  const exit = normalizeAfterOpen(exitTime, range.open);
  return entry >= range.open && entry < range.close && exit > entry && exit < range.close;
}

export function canCloseClubFromEntry(entryTime: string, config: ClubTimeConfig): boolean {
  return isClubEntryTime(entryTime, config);
}

export function clubDurationMinutes(entryTime: string, exitTime: string, config: ClubTimeConfig): number | null {
  const range = nightRange(config);
  const entry = normalizeAfterOpen(entryTime, range.open);
  const exit = normalizeAfterOpen(exitTime, range.open);
  const duration = exit - entry;
  return duration > 0 && entry >= range.open && exit <= range.close ? duration : null;
}

export function closedClubExitTime(config: ClubTimeConfig): string {
  return config.closeTime;
}

export function timeToMinutes(value: string): number {
  const [hours, minutes] = value.slice(0, 5).split(":").map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(minutes: number): string {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
}

function normalizeAfterOpen(value: string, openMinutes: number): number {
  const minutes = timeToMinutes(value);
  return minutes < openMinutes ? minutes + 1440 : minutes;
}

function nightTimelineMinutes(value: string): number {
  const minutes = timeToMinutes(value);
  return minutes < 12 * 60 ? minutes + 1440 : minutes;
}

function assertTime(value: string, error: string): void {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new ClubTimeConfigError(error);
}

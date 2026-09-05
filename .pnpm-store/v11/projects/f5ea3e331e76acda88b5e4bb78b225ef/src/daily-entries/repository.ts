import { pool } from "../db/pool";
import type { DailyEntry, DailyEntryInput } from "./types";

type DailyEntryRow = {
  id: string;
  user_id: string;
  date_key: string | Date;
  sleep_did_not_sleep: boolean;
  sleep_bedtime: string | null;
  sleep_wake: string | null;
  nap_start: string | null;
  nap_end: string | null;
  fifth_meal: "yes" | "no" | null;
  bathroom_count: number | null;
  boliche_did_not_go: boolean;
  boliche_exit_time: string | null;
  created_at: string | Date;
  updated_at: string | Date;
};

export type DailyEntriesRepository = {
  listEntries(userId: string): Promise<DailyEntry[]>;
  findEntry(userId: string, dateKey: string): Promise<DailyEntry | null>;
  upsertEntry(userId: string, dateKey: string, input: DailyEntryInput): Promise<DailyEntry>;
};

export const postgresDailyEntriesRepository: DailyEntriesRepository = {
  async listEntries(userId) {
    const result = await pool.query<DailyEntryRow>(
      `
        select id, user_id, date_key, sleep_did_not_sleep, sleep_bedtime, sleep_wake,
               nap_start, nap_end, fifth_meal, bathroom_count,
               boliche_did_not_go, boliche_exit_time, created_at, updated_at
        from daily_entries
        where user_id = $1
        order by date_key desc
      `,
      [userId]
    );

    return result.rows.map(toDailyEntry);
  },

  async findEntry(userId, dateKey) {
    const result = await pool.query<DailyEntryRow>(
      `
        select id, user_id, date_key, sleep_did_not_sleep, sleep_bedtime, sleep_wake,
               nap_start, nap_end, fifth_meal, bathroom_count,
               boliche_did_not_go, boliche_exit_time, created_at, updated_at
        from daily_entries
        where user_id = $1 and date_key = $2
      `,
      [userId, dateKey]
    );

    return result.rows[0] ? toDailyEntry(result.rows[0]) : null;
  },

  async upsertEntry(userId, dateKey, input) {
    const result = await pool.query<DailyEntryRow>(
      `
        insert into daily_entries (
          user_id, date_key, sleep_did_not_sleep, sleep_bedtime, sleep_wake,
          nap_start, nap_end, fifth_meal, bathroom_count, boliche_did_not_go, boliche_exit_time
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        on conflict (user_id, date_key) do update
        set sleep_did_not_sleep = excluded.sleep_did_not_sleep,
            sleep_bedtime = excluded.sleep_bedtime,
            sleep_wake = excluded.sleep_wake,
            nap_start = excluded.nap_start,
            nap_end = excluded.nap_end,
            fifth_meal = excluded.fifth_meal,
            bathroom_count = excluded.bathroom_count,
            boliche_did_not_go = excluded.boliche_did_not_go,
            boliche_exit_time = excluded.boliche_exit_time,
            updated_at = now()
        returning id, user_id, date_key, sleep_did_not_sleep, sleep_bedtime, sleep_wake,
                  nap_start, nap_end, fifth_meal, bathroom_count,
                  boliche_did_not_go, boliche_exit_time, created_at, updated_at
      `,
      [
        userId,
        dateKey,
        input.sleep.didNotSleep,
        input.sleep.bedtime,
        input.sleep.wake,
        input.nap?.start ?? null,
        input.nap?.end ?? null,
        input.fifthMeal,
        input.bathroom,
        input.boliche.didNotGo,
        input.boliche.time,
      ]
    );

    return toDailyEntry(result.rows[0]);
  },
};

function toDailyEntry(row: DailyEntryRow): DailyEntry {
  return {
    id: row.id,
    userId: row.user_id,
    dateKey: toDateOnly(row.date_key),
    sleep: {
      didNotSleep: row.sleep_did_not_sleep,
      bedtime: toTime(row.sleep_bedtime),
      wake: toTime(row.sleep_wake),
    },
    nap:
      row.nap_start && row.nap_end
        ? {
            start: toTime(row.nap_start) as string,
            end: toTime(row.nap_end) as string,
          }
        : null,
    fifthMeal: row.fifth_meal,
    bathroom: row.bathroom_count,
    boliche: {
      didNotGo: row.boliche_did_not_go,
      time: toTime(row.boliche_exit_time),
    },
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function toDateOnly(value: string | Date): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value.slice(0, 10);
}

function toTime(value: string | null): string | null {
  return value ? value.slice(0, 5) : null;
}

function toIso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

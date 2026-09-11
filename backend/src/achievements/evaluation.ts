import type { PoolClient } from "pg";
import { pool } from "../db/pool";
import { calculateStats } from "../stats/calculations";
import { loadStatsData } from "../stats/repository";
import type { DailyEntryStatsRow, RankingRow, StatsData } from "../stats/types";
import { ACHIEVEMENT_BY_KEY } from "./definitions";
import type { AchievementCandidate } from "./types";

type QueryClient = Pick<PoolClient, "query">;

const FIRST_BOTTOM_KEY = "first_bottom";
const FIRST_EXTRA_SLEEP_KEY = "first_extra_sleep";
const FIRST_BROKE_WALLET_KEY = "first_broke_wallet";
const FIRST_THREE_CLOSED_CLUBS_KEY = "first_three_closed_clubs";
const SECRET_NO_SLEEP_REQUIRED_KEY = "secret_no_sleep_required";
const SECRET_NOT_A_COMPETITION_KEY = "secret_not_a_competition";
const SECRET_CAME_TO_BREAK_KEY = "secret_came_to_break";
const SECRET_CLUB_STAFF_KEY = "secret_club_staff";
const WALLET_THRESHOLD = 350000;

export async function evaluateAchievementsThroughDate(
  dateKey: string,
  client: QueryClient = pool,
  options: { isDemo?: boolean } = {}
): Promise<AchievementCandidate[]> {
  const completeDays = await loadCompleteDaysThrough(dateKey, client);
  const inserted: AchievementCandidate[] = [];
  const resolvedKeys = await loadResolvedKeys(client);

  for (const day of completeDays) {
    const data = await loadStatsData(addDays(day, 1), client);
    const candidates = collectAchievementCandidatesForDate(day, data, resolvedKeys);
    for (const candidate of candidates) {
      const persisted = await persistCandidate(candidate, client, options.isDemo ?? false);
      if (persisted) {
        resolvedKeys.add(candidate.key);
        inserted.push(candidate);
      }
    }
  }

  return inserted;
}

export function collectAchievementCandidatesForDate(
  dateKey: string,
  data: StatsData,
  resolvedKeys: Set<string> = new Set()
): AchievementCandidate[] {
  const candidates: AchievementCandidate[] = [];
  const activeUserIds = new Set(data.users.map((user) => user.id));
  const dayEntries = data.dailyEntries.filter((entry) => entry.dateKey === dateKey && activeUserIds.has(entry.userId));

  addCandidate(candidates, resolvedKeys, FIRST_BOTTOM_KEY, dateKey, sleepWinners(dayEntries, (minutes) => minutes < 180));
  addCandidate(candidates, resolvedKeys, FIRST_EXTRA_SLEEP_KEY, dateKey, sleepWinners(dayEntries, (minutes) => minutes > 480));
  addCandidate(candidates, resolvedKeys, FIRST_BROKE_WALLET_KEY, dateKey, cumulativeExpenseWinners(dateKey, data, activeUserIds));
  addCandidate(candidates, resolvedKeys, FIRST_THREE_CLOSED_CLUBS_KEY, dateKey, cumulativeClosedClubWinners(dateKey, data, activeUserIds, 3));
  addCandidate(candidates, resolvedKeys, SECRET_NO_SLEEP_REQUIRED_KEY, dateKey, sleepWinners(dayEntries, (minutes) => minutes < 60));
  addCandidate(candidates, resolvedKeys, SECRET_NOT_A_COMPETITION_KEY, dateKey, fourDynamicStatsWinners(dateKey, data, activeUserIds));
  addCandidate(candidates, resolvedKeys, SECRET_CAME_TO_BREAK_KEY, dateKey, cameToBreakWinners(dateKey, data, activeUserIds));
  addCandidate(candidates, resolvedKeys, SECRET_CLUB_STAFF_KEY, dateKey, cumulativeClosedClubWinners(dateKey, data, activeUserIds, 6));

  return candidates;
}

async function loadCompleteDaysThrough(dateKey: string, client: QueryClient): Promise<string[]> {
  const result = await client.query<{ date_key: string | Date }>(
    `
      with active_users as (
        select id from users where is_active = true
      ),
      candidate_days as (
        select distinct date_key from daily_entries where date_key <= $1::date
      )
      select candidate_days.date_key
      from candidate_days
      where (select count(*) from active_users) > 0
        and (
          select count(*)
          from daily_entries
          join active_users on active_users.id = daily_entries.user_id
          where daily_entries.date_key = candidate_days.date_key
        ) = (select count(*) from active_users)
      order by candidate_days.date_key
    `,
    [dateKey]
  );

  return result.rows.map((row) => toDateOnly(row.date_key));
}

async function loadResolvedKeys(client: QueryClient): Promise<Set<string>> {
  const result = await client.query<{ achievement_key: string }>("select achievement_key from achievement_resolutions");
  return new Set(result.rows.map((row) => row.achievement_key));
}

async function persistCandidate(candidate: AchievementCandidate, client: QueryClient, isDemo: boolean): Promise<boolean> {
  const definition = ACHIEVEMENT_BY_KEY.get(candidate.key);
  if (!definition || candidate.userIds.length === 0) return false;

  const duplicate = candidate.userIds.length > 1;
  const inserted = await client.query<{ achievement_key: string }>(
    `
      insert into achievement_resolutions (achievement_key, achievement_type, unlocked_date, is_duplicate, is_demo)
      values ($1, $2, $3, $4, $5)
      on conflict (achievement_key) do nothing
      returning achievement_key
    `,
    [candidate.key, candidate.type, candidate.dateKey, duplicate, isDemo]
  );

  if (!inserted.rows.length) return false;

  for (const userId of candidate.userIds) {
    await client.query(
      `
        insert into achievement_unlocks (achievement_key, user_id, achievement_type, unlocked_date, is_duplicate, is_demo)
        values ($1, $2, $3, $4, $5, $6)
        on conflict (achievement_key, user_id) do nothing
      `,
      [candidate.key, userId, candidate.type, candidate.dateKey, duplicate, isDemo]
    );
  }

  return true;
}

function addCandidate(
  candidates: AchievementCandidate[],
  resolvedKeys: Set<string>,
  key: string,
  dateKey: string,
  userIds: string[]
): void {
  if (resolvedKeys.has(key) || userIds.length === 0) return;
  const definition = ACHIEVEMENT_BY_KEY.get(key);
  if (!definition) return;
  candidates.push({ key, type: definition.type, dateKey, userIds: uniqueSorted(userIds) });
}

function sleepWinners(entries: DailyEntryStatsRow[], predicate: (minutes: number) => boolean): string[] {
  return entries
    .map((entry) => ({ userId: entry.userId, minutes: sleepDurationMinutes(entry) }))
    .filter((row): row is { userId: string; minutes: number } => row.minutes !== null && predicate(row.minutes))
    .map((row) => row.userId);
}

function cumulativeExpenseWinners(dateKey: string, data: StatsData, activeUserIds: Set<string>): string[] {
  const totals = new Map<string, number>();
  data.expenses
    .filter((expense) => expense.dateKey <= dateKey && activeUserIds.has(expense.userId))
    .forEach((expense) => totals.set(expense.userId, (totals.get(expense.userId) ?? 0) + expense.amount));

  return Array.from(totals)
    .filter(([, total]) => total >= WALLET_THRESHOLD)
    .map(([userId]) => userId);
}

function cumulativeClosedClubWinners(dateKey: string, data: StatsData, activeUserIds: Set<string>, threshold: number): string[] {
  const totals = new Map<string, number>();
  data.dailyEntries
    .filter((entry) => entry.dateKey <= dateKey && activeUserIds.has(entry.userId) && !entry.bolicheDidNotGo && entry.bolicheClosedClub)
    .forEach((entry) => totals.set(entry.userId, (totals.get(entry.userId) ?? 0) + 1));

  return Array.from(totals)
    .filter(([, total]) => total >= threshold)
    .map(([userId]) => userId);
}

function fourDynamicStatsWinners(dateKey: string, data: StatsData, activeUserIds: Set<string>): string[] {
  const wins = new Map<string, Set<string>>();
  const stats = calculateStats("day", data, dateKey);
  const addWins = (statKey: string, winners: string[]) => {
    winners.forEach((userId) => {
      if (!activeUserIds.has(userId)) return;
      const wonStats = wins.get(userId) ?? new Set<string>();
      wonStats.add(statKey);
      wins.set(userId, wonStats);
    });
  };

  addWins("sleep_most", rankingWinners(stats.dailyEntries.sleepMinutes));
  addWins("sleep_least", rankingWinners(stats.dailyEntries.leastSleepMinutes, "min"));
  addWins("siestas", rankingWinners(stats.dailyEntries.siestas));
  addWins("fifth_meals", rankingWinners(stats.dailyEntries.fifthMeals));
  addWins("bathroom", rankingWinners(stats.dailyEntries.bathroom));
  addWins("boliche", rankingWinners(stats.dailyEntries.bolicheMinutes));
  addWins("money_total", rankingWinners(stats.money.totalSpentByUser));
  addWins("previas", rankingWinners(stats.previas.byParticipant));
  addWins("survey_destroyed", rankingWinners(stats.surveys.destroyed_vote));
  addWins("survey_flirty", rankingWinners(stats.surveys.most_flirty));
  addWins("survey_outfit", rankingWinners(stats.surveys.best_outfit));

  Object.entries(stats.money.byCategoryAndUser).forEach(([category, rows]) => {
    addWins(`money_category_${category}`, rankingWinners(rows));
  });

  return Array.from(wins)
    .filter(([, wonStats]) => wonStats.size >= 4)
    .map(([userId]) => userId);
}

function cameToBreakWinners(dateKey: string, data: StatsData, activeUserIds: Set<string>): string[] {
  const stats = calculateStats("day", data, dateKey);
  const destroyed = new Set(rankingWinners(stats.surveys.destroyed_vote).filter((userId) => activeUserIds.has(userId)));
  const alcohol = new Set(rankingWinners(stats.money.byCategoryAndUser.Alcohol ?? []).filter((userId) => activeUserIds.has(userId)));
  return Array.from(destroyed).filter((userId) => alcohol.has(userId));
}

function rankingWinners(rows: RankingRow[], mode: "max" | "min" = "max"): string[] {
  const positiveRows = rows.filter((row) => row.value > 0);
  if (!positiveRows.length) return [];
  const values = positiveRows.map((row) => row.value);
  const target = mode === "min" ? Math.min(...values) : Math.max(...values);
  return positiveRows.filter((row) => row.value === target).map((row) => row.userId);
}

function sleepDurationMinutes(entry: DailyEntryStatsRow): number | null {
  if (entry.sleepDidNotSleep || !entry.sleepBedtime || !entry.sleepWake) return null;
  const bedtime = timeToMinutes(entry.sleepBedtime);
  let wake = timeToMinutes(entry.sleepWake);
  if (wake <= bedtime) wake += 24 * 60;
  return wake - bedtime;
}

function timeToMinutes(value: string): number {
  const [hour, minute] = value.slice(0, 5).split(":").map(Number);
  return hour * 60 + minute;
}

function uniqueSorted(userIds: string[]): string[] {
  return Array.from(new Set(userIds)).sort();
}

function addDays(dateKey: string, offset: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + offset));
  return date.toISOString().slice(0, 10);
}

function toDateOnly(value: string | Date): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value.slice(0, 10);
}

import type {
  DailyEntryStatsRow,
  ExpenseRow,
  PreviaParticipantStatsRow,
  RankingRow,
  StatsData,
  StatsResponse,
  SurveyVoteStatsRow,
} from "./types";

const BOLICHE_ARRIVAL_MINUTES = 60;

export function calculateStats(scope: "day" | "total", data: StatsData, dateKey?: string): StatsResponse {
  const closedDays = collectClosedDays(data, dateKey);
  const daySet = new Set(scope === "day" && dateKey ? [dateKey] : closedDays);
  const expenses = data.expenses.filter((expense) => daySet.has(expense.dateKey));
  const entries = data.dailyEntries.filter((entry) => daySet.has(entry.dateKey));
  const votes = data.surveyVotes.filter((vote) => daySet.has(vote.dateKey));
  const previaParticipants = data.previaParticipants.filter((participant) => daySet.has(participant.dateKey));

  return {
    scope,
    ...(dateKey ? { dateKey } : {}),
    closedDays,
    users: data.users,
    money: moneyStats(expenses),
    dailyEntries: dailyEntryStats(entries),
    surveys: {
      destroyed_vote: rankingFromCounts(countBy(votes.filter((vote) => vote.surveyKey === "destroyed_vote"), "votedUserId")),
    },
    previas: previaStats(previaParticipants),
    streaks: scope === "total" ? streakStats(closedDays, data) : emptyStreakStats(),
  };
}

function moneyStats(expenses: ExpenseRow[]): StatsResponse["money"] {
  const totalSpentByUser = sumBy(expenses, "userId", (expense) => expense.amount);
  const rankingByCategory = sumBy(expenses, "category", (expense) => expense.amount).map(({ userId, value }) => ({
    category: userId,
    value,
  }));
  const sortedCategories = sortCategoryRows(rankingByCategory);
  const byCategoryAndUser = Object.fromEntries(
    sortedCategories.map((category) => [
      category.category,
      sortRankingRows(
        sumBy(
          expenses.filter((expense) => expense.category === category.category),
          "userId",
          (expense) => expense.amount
        )
      ),
    ])
  );

  return {
    totalSpentGlobal: expenses.reduce((sum, expense) => sum + expense.amount, 0),
    totalSpentByUser: sortRankingRows(totalSpentByUser),
    rankingByCategory: sortedCategories,
    byCategoryAndUser,
    topCategory: sortedCategories[0] ?? null,
  };
}

function dailyEntryStats(entries: DailyEntryStatsRow[]): StatsResponse["dailyEntries"] {
  return {
    sleepMinutes: sortRankingRows(sumDefined(entries, sleepDurationMinutes)),
    leastSleepMinutes: sortRankingRowsAsc(sumDefined(entries, totalSleepDurationMinutes)),
    siestas: sortRankingRows(sumDefined(entries, (entry) => (entry.napStart && entry.napEnd ? 1 : 0))),
    fifthMeals: sortRankingRows(sumDefined(entries, (entry) => (entry.fifthMeal === null ? null : entry.fifthMeal === "yes" ? 1 : 0))),
    bathroom: sortRankingRows(sumDefined(entries, (entry) => entry.bathroom)),
    bolicheMinutes: sortRankingRows(sumDefined(entries, bolicheDurationMinutes)),
  };
}

function previaStats(previaParticipants: PreviaParticipantStatsRow[]): StatsResponse["previas"] {
  return {
    totalCount: new Set(previaParticipants.map((participant) => participant.previaId)).size,
    byParticipant: rankingFromCounts(countBy(previaParticipants, "userId")),
  };
}

function streakStats(days: string[], data: StatsData): StatsResponse["streaks"] {
  const userIds = new Set<string>();
  data.dailyEntries.forEach((entry) => userIds.add(entry.userId));
  data.expenses.forEach((expense) => userIds.add(expense.userId));
  data.surveyVotes.forEach((vote) => userIds.add(vote.votedUserId));

  const entriesByUserAndDay = new Map<string, DailyEntryStatsRow>();
  data.dailyEntries.forEach((entry) => entriesByUserAndDay.set(`${entry.userId}:${entry.dateKey}`, entry));

  const expenseCategoriesByUserAndDay = new Map<string, Set<string>>();
  data.expenses.forEach((expense) => {
    const key = `${expense.userId}:${expense.dateKey}`;
    const categories = expenseCategoriesByUserAndDay.get(key) ?? new Set<string>();
    categories.add(expense.category);
    expenseCategoriesByUserAndDay.set(key, categories);
  });

  const rowsFor = (predicate: (userId: string, day: string) => boolean) =>
    sortRankingRows(
      Array.from(userIds)
        .map((userId) => ({ userId, value: longestStreak(days, (day) => predicate(userId, day)) }))
        .filter((row) => row.value > 0)
    );

  return {
    boliche: rowsFor((userId, day) => bolicheDurationMinutes(entriesByUserAndDay.get(`${userId}:${day}`)) !== null),
    fifthMeal: rowsFor((userId, day) => entriesByUserAndDay.get(`${userId}:${day}`)?.fifthMeal === "yes"),
    bathroom: rowsFor((userId, day) => {
      const bathroom = entriesByUserAndDay.get(`${userId}:${day}`)?.bathroom;
      return bathroom !== null && bathroom !== undefined && bathroom > 0;
    }),
    chocolates: rowsFor((userId, day) => expenseCategoriesByUserAndDay.get(`${userId}:${day}`)?.has("Chocolates") ?? false),
    alcohol: rowsFor((userId, day) => expenseCategoriesByUserAndDay.get(`${userId}:${day}`)?.has("Alcohol") ?? false),
    zombie: negativeStreakRows(days, userIds, (day) => dailyLeastSleepWinners(day, data.dailyEntries)),
    alcoholSpender: negativeStreakRows(days, userIds, (day) => dailyCategorySpendingWinners(day, data.expenses, "Alcohol")),
    destroyedVote: negativeStreakRows(days, userIds, (day) => dailyDestroyedVoteWinners(day, data.surveyVotes)),
    moneySpender: negativeStreakRows(days, userIds, (day) => dailyMoneySpendingWinners(day, data.expenses)),
  };
}

function emptyStreakStats(): StatsResponse["streaks"] {
  return {
    boliche: [],
    fifthMeal: [],
    bathroom: [],
    chocolates: [],
    alcohol: [],
    zombie: [],
    alcoholSpender: [],
    destroyedVote: [],
    moneySpender: [],
  };
}

function negativeStreakRows(
  days: string[],
  userIds: Set<string>,
  winnersForDay: (day: string) => Set<string>
): RankingRow[] {
  return sortRankingRows(
    Array.from(userIds)
      .map((userId) => ({
        userId,
        value: longestStreak(days, (day) => winnersForDay(day).has(userId)),
      }))
      .filter((row) => row.value > 0)
  );
}

function dailyLeastSleepWinners(day: string, entries: DailyEntryStatsRow[]): Set<string> {
  const rows = entries
    .filter((entry) => entry.dateKey === day)
    .map((entry) => ({ userId: entry.userId, value: totalSleepDurationMinutes(entry) }))
    .filter((row): row is { userId: string; value: number } => row.value !== null);
  return winnersByValue(rows, "min");
}

function dailyCategorySpendingWinners(day: string, expenses: ExpenseRow[], category: string): Set<string> {
  const rows = sumBy(
    expenses.filter((expense) => expense.dateKey === day && expense.category === category),
    "userId",
    (expense) => expense.amount
  );
  return winnersByValue(rows, "max");
}

function dailyDestroyedVoteWinners(day: string, votes: SurveyVoteStatsRow[]): Set<string> {
  const rows = rankingFromCounts(countBy(votes.filter((vote) => vote.dateKey === day && vote.surveyKey === "destroyed_vote"), "votedUserId"));
  return winnersByValue(rows, "max");
}

function dailyMoneySpendingWinners(day: string, expenses: ExpenseRow[]): Set<string> {
  const rows = sumBy(
    expenses.filter((expense) => expense.dateKey === day),
    "userId",
    (expense) => expense.amount
  );
  return winnersByValue(rows, "max");
}

function winnersByValue(rows: RankingRow[], mode: "max" | "min"): Set<string> {
  if (!rows.length) return new Set();
  const values = rows.map((row) => row.value);
  const target = mode === "max" ? Math.max(...values) : Math.min(...values);
  return new Set(rows.filter((row) => row.value === target).map((row) => row.userId));
}

function collectClosedDays(data: StatsData, upToDateKey?: string): string[] {
  const days = new Set<string>();
  const addDay = (dateKey: string) => {
    if (!upToDateKey || dateKey <= upToDateKey) days.add(dateKey);
  };

  data.expenses.forEach((expense) => addDay(expense.dateKey));
  data.dailyEntries.forEach((entry) => addDay(entry.dateKey));
  data.surveyVotes.forEach((vote) => addDay(vote.dateKey));
  data.previaParticipants.forEach((participant) => addDay(participant.dateKey));

  return Array.from(days).sort();
}

function sleepDurationMinutes(entry: DailyEntryStatsRow | undefined): number | null {
  if (!entry || entry.sleepDidNotSleep || !entry.sleepBedtime || !entry.sleepWake) return null;
  const bedtime = timeToMinutes(entry.sleepBedtime);
  let wake = timeToMinutes(entry.sleepWake);
  if (wake <= bedtime) wake += 24 * 60;
  return wake - bedtime;
}

function totalSleepDurationMinutes(entry: DailyEntryStatsRow | undefined): number | null {
  const sleepMinutes = sleepDurationMinutes(entry);
  const napMinutes = napDurationMinutes(entry);
  if (sleepMinutes === null && napMinutes === null) return null;
  return (sleepMinutes ?? 0) + (napMinutes ?? 0);
}

function napDurationMinutes(entry: DailyEntryStatsRow | undefined): number | null {
  if (!entry || !entry.napStart || !entry.napEnd) return null;
  return Math.max(0, timeToMinutes(entry.napEnd) - timeToMinutes(entry.napStart));
}

function bolicheDurationMinutes(entry: DailyEntryStatsRow | undefined): number | null {
  if (!entry || entry.bolicheDidNotGo || !entry.bolicheExitTime) return null;
  return Math.max(0, timeToMinutes(entry.bolicheExitTime) - BOLICHE_ARRIVAL_MINUTES);
}

function timeToMinutes(value: string): number {
  const [hour, minute] = value.slice(0, 5).split(":").map(Number);
  return hour * 60 + minute;
}

function sumDefined<T extends { userId: string }>(items: T[], valueFor: (item: T) => number | null | undefined): RankingRow[] {
  const registered = new Set<string>();
  const totals = new Map<string, number>();
  items.forEach((item) => {
    const value = valueFor(item);
    if (value === null || value === undefined) return;
    registered.add(item.userId);
    totals.set(item.userId, (totals.get(item.userId) ?? 0) + value);
  });

  return Array.from(registered).map((userId) => ({ userId, value: totals.get(userId) ?? 0 }));
}

function sumBy<T>(items: T[], key: keyof T, valueFor: (item: T) => number): RankingRow[] {
  const totals = new Map<string, number>();
  items.forEach((item) => {
    const mapKey = String(item[key]);
    totals.set(mapKey, (totals.get(mapKey) ?? 0) + valueFor(item));
  });
  return Array.from(totals, ([userId, value]) => ({ userId, value }));
}

function countBy<T>(items: T[], key: keyof T): Map<string, number> {
  const counts = new Map<string, number>();
  items.forEach((item) => {
    const mapKey = String(item[key]);
    counts.set(mapKey, (counts.get(mapKey) ?? 0) + 1);
  });
  return counts;
}

function rankingFromCounts(counts: Map<string, number>): RankingRow[] {
  return sortRankingRows(Array.from(counts, ([userId, value]) => ({ userId, value })));
}

function sortRankingRows(rows: RankingRow[]): RankingRow[] {
  return rows.slice().sort((a, b) => b.value - a.value || a.userId.localeCompare(b.userId));
}

function sortRankingRowsAsc(rows: RankingRow[]): RankingRow[] {
  return rows.slice().sort((a, b) => a.value - b.value || a.userId.localeCompare(b.userId));
}

function sortCategoryRows(rows: { category: string; value: number }[]): { category: string; value: number }[] {
  return rows.slice().sort((a, b) => b.value - a.value || a.category.localeCompare(b.category));
}

function longestStreak(days: string[], predicate: (day: string) => boolean): number {
  let best = 0;
  let current = 0;
  let previous: string | null = null;
  days.forEach((day) => {
    const consecutive = previous !== null && isNextDay(previous, day);
    if (predicate(day)) {
      current = consecutive ? current + 1 : 1;
      best = Math.max(best, current);
    } else {
      current = 0;
    }
    previous = day;
  });
  return best;
}

function isNextDay(previous: string, current: string): boolean {
  const [year, month, day] = previous.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10) === current;
}

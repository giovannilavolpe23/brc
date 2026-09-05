import type { UserAppearance } from "../users/appearance";

export type RankingRow = {
  userId: string;
  value: number;
};

export type CategoryRow = {
  category: string;
  value: number;
};

export type StatsResponse = {
  scope: "day" | "total";
  dateKey?: string;
  closedDays: string[];
  users: StatsUser[];
  money: {
    totalSpentGlobal: number;
    totalSpentByUser: RankingRow[];
    rankingByCategory: CategoryRow[];
    byCategoryAndUser: Record<string, RankingRow[]>;
    topCategory: CategoryRow | null;
  };
  dailyEntries: {
    sleepMinutes: RankingRow[];
    leastSleepMinutes: RankingRow[];
    siestas: RankingRow[];
    fifthMeals: RankingRow[];
    bathroom: RankingRow[];
    bolicheMinutes: RankingRow[];
  };
  surveys: {
    destroyed_vote: RankingRow[];
  };
  previas: {
    totalCount: number;
    byParticipant: RankingRow[];
  };
  streaks: {
    boliche: RankingRow[];
    fifthMeal: RankingRow[];
    bathroom: RankingRow[];
    chocolates: RankingRow[];
    alcohol: RankingRow[];
    zombie: RankingRow[];
    alcoholSpender: RankingRow[];
    destroyedVote: RankingRow[];
    moneySpender: RankingRow[];
  };
};

export type StatsData = {
  users: StatsUser[];
  expenses: ExpenseRow[];
  dailyEntries: DailyEntryStatsRow[];
  surveyVotes: SurveyVoteStatsRow[];
  previaParticipants: PreviaParticipantStatsRow[];
};

export type StatsUser = {
  id: string;
  legacyId: string;
  displayName: string;
  appearance?: UserAppearance | null;
};

export type ExpenseRow = {
  userId: string;
  category: string;
  amount: number;
  dateKey: string;
};

export type DailyEntryStatsRow = {
  userId: string;
  dateKey: string;
  sleepDidNotSleep: boolean;
  sleepBedtime: string | null;
  sleepWake: string | null;
  napStart: string | null;
  napEnd: string | null;
  fifthMeal: "yes" | "no" | null;
  bathroom: number | null;
  bolicheDidNotGo: boolean;
  bolicheExitTime: string | null;
};

export type SurveyVoteStatsRow = {
  surveyKey: string;
  dateKey: string;
  votedUserId: string;
};

export type PreviaParticipantStatsRow = {
  previaId: string;
  userId: string;
  dateKey: string;
};

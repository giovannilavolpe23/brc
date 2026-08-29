import { pool } from "../db/pool";
import type {
  DailyEntryStatsRow,
  ExpenseRow,
  PreviaParticipantStatsRow,
  StatsData,
  StatsUser,
  SurveyVoteStatsRow,
} from "./types";

type UserDbRow = {
  id: string;
  legacy_id: string;
  display_name: string;
};

type ExpenseDbRow = {
  user_id: string;
  category: string;
  amount_pesos: number;
  date_key: string | Date;
};

type DailyEntryDbRow = {
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
};

type SurveyVoteDbRow = {
  survey_key: string;
  date_key: string | Date;
  voted_user_id: string;
};

type PreviaParticipantDbRow = {
  previa_id: string;
  user_id: string;
  date_key: string | Date;
};

export type StatsRepository = {
  loadStatsData(todayKey: string): Promise<StatsData>;
};

export const postgresStatsRepository: StatsRepository = {
  async loadStatsData(todayKey) {
    const [users, expenses, dailyEntries, surveyVotes, previaParticipants] = await Promise.all([
      pool.query<UserDbRow>(
        "select id, legacy_id, display_name from users where is_active = true order by display_name"
      ),
      pool.query<ExpenseDbRow>(
        `
          select user_id, category, amount_pesos, movement_date as date_key
          from money_movements
          where type = 'expense'
            and movement_date < $1
            and category is not null
        `,
        [todayKey]
      ),
      pool.query<DailyEntryDbRow>(
        `
          select user_id, date_key, sleep_did_not_sleep, sleep_bedtime, sleep_wake,
                 nap_start, nap_end, fifth_meal, bathroom_count,
                 boliche_did_not_go, boliche_exit_time
          from daily_entries
          where date_key < $1
        `,
        [todayKey]
      ),
      pool.query<SurveyVoteDbRow>(
        `
          select survey_questions.key as survey_key, survey_votes.date_key, survey_votes.voted_user_id
          from survey_votes
          join survey_questions on survey_questions.id = survey_votes.survey_question_id
          where survey_votes.date_key < $1
        `,
        [todayKey]
      ),
      pool.query<PreviaParticipantDbRow>(
        `
          select previas.id as previa_id,
                 previa_participants.user_id,
                 ((previas.occurred_at at time zone 'America/Argentina/Buenos_Aires')::date - 1) as date_key
          from previa_participants
          join previas on previas.id = previa_participants.previa_id
          where ((previas.occurred_at at time zone 'America/Argentina/Buenos_Aires')::date - 1) < $1::date
        `,
        [todayKey]
      ),
    ]);

    return {
      users: users.rows.map(toStatsUser),
      expenses: expenses.rows.map(toExpenseRow),
      dailyEntries: dailyEntries.rows.map(toDailyEntryStatsRow),
      surveyVotes: surveyVotes.rows.map(toSurveyVoteStatsRow),
      previaParticipants: previaParticipants.rows.map(toPreviaParticipantStatsRow),
    };
  },
};

function toStatsUser(row: UserDbRow): StatsUser {
  return {
    id: row.id,
    legacyId: row.legacy_id,
    displayName: row.display_name,
  };
}

function toExpenseRow(row: ExpenseDbRow): ExpenseRow {
  return {
    userId: row.user_id,
    category: row.category,
    amount: row.amount_pesos,
    dateKey: toDateOnly(row.date_key),
  };
}

function toDailyEntryStatsRow(row: DailyEntryDbRow): DailyEntryStatsRow {
  return {
    userId: row.user_id,
    dateKey: toDateOnly(row.date_key),
    sleepDidNotSleep: row.sleep_did_not_sleep,
    sleepBedtime: toTime(row.sleep_bedtime),
    sleepWake: toTime(row.sleep_wake),
    napStart: toTime(row.nap_start),
    napEnd: toTime(row.nap_end),
    fifthMeal: row.fifth_meal,
    bathroom: row.bathroom_count,
    bolicheDidNotGo: row.boliche_did_not_go,
    bolicheExitTime: toTime(row.boliche_exit_time),
  };
}

function toSurveyVoteStatsRow(row: SurveyVoteDbRow): SurveyVoteStatsRow {
  return {
    surveyKey: row.survey_key,
    dateKey: toDateOnly(row.date_key),
    votedUserId: row.voted_user_id,
  };
}

function toPreviaParticipantStatsRow(row: PreviaParticipantDbRow): PreviaParticipantStatsRow {
  return {
    previaId: row.previa_id,
    userId: row.user_id,
    dateKey: toDateOnly(row.date_key),
  };
}

function toDateOnly(value: string | Date): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value.slice(0, 10);
}

function toTime(value: string | null): string | null {
  return value ? value.slice(0, 5) : null;
}

import type { PoolClient } from "pg";
import { pool } from "../db/pool";
import type { UserAppearance } from "../users/appearance";
import { toAppearance } from "../users/appearance.repository";
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
  preset: UserAppearance["preset"] | null;
  primary_color: string | null;
  secondary_color: string | null;
  gradient_direction: UserAppearance["gradientDirection"] | null;
  intensity: UserAppearance["intensity"] | null;
  visual_style: UserAppearance["visualStyle"] | null;
  avatar_border_style: UserAppearance["avatarBorderStyle"] | null;
  king_phrase: string | null;
  premium_glow: UserAppearance["premiumGlow"] | null;
  premium_shadow: UserAppearance["premiumShadow"] | null;
  premium_border: UserAppearance["premiumBorder"] | null;
  premium_intensity: UserAppearance["premiumIntensity"] | null;
  premium_motion: UserAppearance["premiumMotion"] | null;
  premium_border_animation: UserAppearance["premiumBorderAnimation"] | null;
  premium_shimmer: UserAppearance["premiumShimmer"] | null;
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
  boliche_entry_time: string | null;
  boliche_exit_time: string | null;
  boliche_closed_club: boolean;
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

type StatsQueryClient = Pick<PoolClient, "query">;

export const postgresStatsRepository: StatsRepository = {
  async loadStatsData(todayKey) {
    return loadStatsData(todayKey);
  },
};

export async function loadStatsData(todayKey: string, client: StatsQueryClient = pool): Promise<StatsData> {
    const [users, expenses, dailyEntries, surveyVotes, previaParticipants] = await Promise.all([
      client.query<UserDbRow>(
        `
          select users.id,
                 users.legacy_id,
                 users.display_name,
                 user_appearances.preset,
                 user_appearances.primary_color,
                 user_appearances.secondary_color,
                 user_appearances.gradient_direction,
                 user_appearances.intensity,
                 user_appearances.visual_style,
                 user_appearances.avatar_border_style,
                 user_appearances.king_phrase,
                 user_appearances.premium_glow,
                 user_appearances.premium_shadow,
                 user_appearances.premium_border,
                 user_appearances.premium_intensity,
                 user_appearances.premium_motion,
                 user_appearances.premium_border_animation,
                 user_appearances.premium_shimmer
          from users
          left join user_appearances on user_appearances.user_id = users.id
          where users.is_active = true
          order by users.display_name
        `
      ),
      client.query<ExpenseDbRow>(
        `
          select user_id, category, amount_pesos, movement_date as date_key
          from money_movements
          where type = 'expense'
            and movement_date < $1
            and category is not null
        `,
        [todayKey]
      ),
      client.query<DailyEntryDbRow>(
        `
          select user_id, date_key, sleep_did_not_sleep, sleep_bedtime, sleep_wake,
                 nap_start, nap_end, fifth_meal, bathroom_count,
                 boliche_did_not_go, boliche_entry_time, boliche_exit_time, boliche_closed_club
          from daily_entries
          where date_key < $1
        `,
        [todayKey]
      ),
      client.query<SurveyVoteDbRow>(
        `
          select survey_questions.key as survey_key, survey_votes.date_key, survey_votes.voted_user_id
          from survey_votes
          join survey_questions on survey_questions.id = survey_votes.survey_question_id
          where survey_votes.date_key < $1
        `,
        [todayKey]
      ),
      client.query<PreviaParticipantDbRow>(
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
}

function toStatsUser(row: UserDbRow): StatsUser {
  return {
    id: row.id,
    legacyId: row.legacy_id,
    displayName: row.display_name,
    appearance: row.preset
      ? toAppearance({
          preset: row.preset,
          primary_color: row.primary_color || "",
          secondary_color: row.secondary_color || "",
          gradient_direction: row.gradient_direction || "135deg",
          intensity: row.intensity || "normal",
          visual_style: row.visual_style || "gradient",
          avatar_border_style: row.avatar_border_style || "gradient",
          king_phrase: row.king_phrase,
          premium_glow: row.premium_glow,
          premium_shadow: row.premium_shadow,
          premium_border: row.premium_border,
          premium_intensity: row.premium_intensity,
          premium_motion: row.premium_motion,
          premium_border_animation: row.premium_border_animation,
          premium_shimmer: row.premium_shimmer,
        })
      : null,
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
    bolicheEntryTime: toTime(row.boliche_entry_time),
    bolicheExitTime: toTime(row.boliche_exit_time),
    bolicheClosedClub: row.boliche_closed_club,
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

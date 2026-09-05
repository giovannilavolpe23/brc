import { pool } from "../db/pool";
import type { SurveyQuestion, SurveyVote } from "./types";

type SurveyQuestionRow = {
  id: string;
  key: string;
  title: string;
};

type SurveyVoteRow = {
  id: string;
  survey_key: string;
  date_key: string | Date;
  voter_user_id: string;
  voted_user_id: string;
  created_at: string | Date;
  updated_at: string | Date;
};

export type SurveysRepository = {
  listQuestions(): Promise<SurveyQuestion[]>;
  findQuestionByKey(surveyKey: string): Promise<SurveyQuestion | null>;
  findActiveUserId(identifier: string): Promise<string | null>;
  listMyVotes(userId: string, dateKey: string): Promise<SurveyVote[]>;
  upsertVote(surveyKey: string, dateKey: string, voterUserId: string, votedUserId: string): Promise<SurveyVote>;
};

export const postgresSurveysRepository: SurveysRepository = {
  async listQuestions() {
    const result = await pool.query<SurveyQuestionRow>(
      "select id, key, title from survey_questions where is_active = true order by key"
    );
    return result.rows.map(toSurveyQuestion);
  },

  async findQuestionByKey(surveyKey) {
    const result = await pool.query<SurveyQuestionRow>(
      "select id, key, title from survey_questions where key = $1 and is_active = true",
      [surveyKey]
    );
    return result.rows[0] ? toSurveyQuestion(result.rows[0]) : null;
  },

  async findActiveUserId(identifier) {
    const result = await pool.query<{ id: string }>(
      "select id from users where (id::text = $1 or legacy_id = $1) and is_active = true",
      [identifier]
    );
    return result.rows[0]?.id ?? null;
  },

  async listMyVotes(userId, dateKey) {
    const result = await pool.query<SurveyVoteRow>(
      `
        select survey_votes.id, survey_questions.key as survey_key, survey_votes.date_key,
               survey_votes.voter_user_id, survey_votes.voted_user_id,
               survey_votes.created_at, survey_votes.updated_at
        from survey_votes
        join survey_questions on survey_questions.id = survey_votes.survey_question_id
        where survey_votes.voter_user_id = $1 and survey_votes.date_key = $2
        order by survey_questions.key
      `,
      [userId, dateKey]
    );
    return result.rows.map(toSurveyVote);
  },

  async upsertVote(surveyKey, dateKey, voterUserId, votedUserId) {
    const result = await pool.query<SurveyVoteRow>(
      `
        insert into survey_votes (survey_question_id, date_key, voter_user_id, voted_user_id)
        select survey_questions.id, $2, $3, $4
        from survey_questions
        where survey_questions.key = $1 and survey_questions.is_active = true
        on conflict (survey_question_id, date_key, voter_user_id) do update
        set voted_user_id = excluded.voted_user_id,
            updated_at = now()
        returning id,
                  (select key from survey_questions where id = survey_question_id) as survey_key,
                  date_key, voter_user_id, voted_user_id, created_at, updated_at
      `,
      [surveyKey, dateKey, voterUserId, votedUserId]
    );

    return toSurveyVote(result.rows[0]);
  },
};

function toSurveyQuestion(row: SurveyQuestionRow): SurveyQuestion {
  return {
    id: row.id,
    key: row.key,
    title: row.title,
  };
}

function toSurveyVote(row: SurveyVoteRow): SurveyVote {
  return {
    id: row.id,
    surveyKey: row.survey_key,
    dateKey: toDateOnly(row.date_key),
    voterUserId: row.voter_user_id,
    votedUserId: row.voted_user_id,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function toDateOnly(value: string | Date): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value.slice(0, 10);
}

function toIso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

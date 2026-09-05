import assert from "node:assert/strict";
import { describe, it } from "node:test";
import express, { type RequestHandler } from "express";
import request from "supertest";
import { createSurveysRouter } from "../src/surveys/routes";
import type { SurveysRepository } from "../src/surveys/repository";
import type { SurveyQuestion, SurveyVote } from "../src/surveys/types";
import type { AuthUser } from "../src/auth/types";

const now = () => new Date("2026-08-29T15:00:00.000Z");

const gio: AuthUser = {
  id: "11111111-1111-4111-8111-111111111111",
  legacyId: "gio",
  displayName: "Gio",
  role: "admin",
  permissions: [],
};

const jere: AuthUser = {
  id: "22222222-2222-4222-8222-222222222222",
  legacyId: "jere",
  displayName: "Jere",
  role: "user",
  permissions: ["create_previa"],
};

const destroyedVote: SurveyQuestion = {
  id: "33333333-3333-4333-8333-333333333333",
  key: "destroyed_vote",
  title: "Quien estuvo mas destruido anoche",
};

function authAs(user: AuthUser): RequestHandler {
  return (req, _res, next) => {
    req.user = user;
    next();
  };
}

function makeVote(voterUserId: string, votedUserId: string): SurveyVote {
  return {
    id: `${voterUserId}-2026-08-28`,
    surveyKey: "destroyed_vote",
    dateKey: "2026-08-28",
    voterUserId,
    votedUserId,
    createdAt: "2026-08-29T12:00:00.000Z",
    updatedAt: "2026-08-29T12:00:00.000Z",
  };
}

function makeRepository(): SurveysRepository & { calls: string[]; votes: SurveyVote[] } {
  const votes: SurveyVote[] = [];
  const calls: string[] = [];
  const existingUsers = new Map([
    [gio.id, gio.id],
    [gio.legacyId, gio.id],
    [jere.id, jere.id],
    [jere.legacyId, jere.id],
  ]);

  return {
    calls,
    votes,
    async listQuestions() {
      calls.push("list");
      return [destroyedVote];
    },
    async findQuestionByKey(surveyKey) {
      calls.push(`question:${surveyKey}`);
      return surveyKey === destroyedVote.key ? destroyedVote : null;
    },
    async findActiveUserId(identifier) {
      calls.push(`user:${identifier}`);
      return existingUsers.get(identifier) ?? null;
    },
    async listMyVotes(userId, dateKey) {
      calls.push(`my:${userId}:${dateKey}`);
      return votes.filter((vote) => vote.voterUserId === userId && vote.dateKey === dateKey);
    },
    async upsertVote(surveyKey, dateKey, voterUserId, votedUserId) {
      calls.push(`vote:${surveyKey}:${dateKey}:${voterUserId}:${votedUserId}`);
      const index = votes.findIndex(
        (vote) => vote.surveyKey === surveyKey && vote.dateKey === dateKey && vote.voterUserId === voterUserId
      );
      const vote = makeVote(voterUserId, votedUserId);
      if (index === -1) votes.push(vote);
      else votes[index] = vote;
      return vote;
    },
  };
}

function makeApp(user: AuthUser, repository: SurveysRepository) {
  const app = express();
  app.use(express.json());
  app.use("/surveys", createSurveysRouter(repository, authAs(user), now));
  return app;
}

describe("survey routes", () => {
  it("lists the initial destroyed_vote survey", async () => {
    const repo = makeRepository();
    const app = makeApp(jere, repo);

    const response = await request(app).get("/surveys");

    assert.equal(response.status, 200);
    assert.equal(response.body.surveys[0].key, "destroyed_vote");
  });

  it("stores votes using the authenticated voter and ignores body voter ids", async () => {
    const repo = makeRepository();
    const app = makeApp(jere, repo);

    const response = await request(app).put("/surveys/destroyed_vote/2026-08-28/vote").send({
      voterUserId: gio.id,
      votedUserId: gio.id,
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.vote.voterUserId, jere.id);
    assert.equal(response.body.vote.votedUserId, gio.id);
  });

  it("accepts voted users by legacy id and stores the database user id", async () => {
    const repo = makeRepository();
    const app = makeApp(jere, repo);

    const response = await request(app).put("/surveys/destroyed_vote/2026-08-28/vote").send({
      votedUserId: "gio",
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.vote.votedUserId, gio.id);
  });

  it("rejects self votes", async () => {
    const repo = makeRepository();
    const app = makeApp(jere, repo);

    const response = await request(app).put("/surveys/destroyed_vote/2026-08-28/vote").send({
      votedUserId: jere.id,
    });

    assert.equal(response.status, 400);
    assert.equal(response.body.error, "self_vote_not_allowed");
  });

  it("rejects votes to missing users", async () => {
    const repo = makeRepository();
    const app = makeApp(jere, repo);

    const response = await request(app).put("/surveys/destroyed_vote/2026-08-28/vote").send({
      votedUserId: "99999999-9999-4999-8999-999999999999",
    });

    assert.equal(response.status, 400);
    assert.equal(response.body.error, "voted_user_not_found");
  });

  it("replaces duplicate votes for the same user survey and date", async () => {
    const repo = makeRepository();
    const app = makeApp(jere, repo);

    await request(app).put("/surveys/destroyed_vote/2026-08-28/vote").send({ votedUserId: gio.id });
    const response = await request(app).put("/surveys/destroyed_vote/2026-08-28/vote").send({ votedUserId: gio.id });

    assert.equal(response.status, 200);
    assert.equal(repo.votes.length, 1);
  });

  it("rejects today and future survey votes", async () => {
    const repo = makeRepository();
    const app = makeApp(jere, repo);

    const today = await request(app).put("/surveys/destroyed_vote/2026-08-29/vote").send({ votedUserId: gio.id });
    const future = await request(app).put("/surveys/destroyed_vote/2026-08-30/vote").send({ votedUserId: gio.id });

    assert.equal(today.status, 400);
    assert.equal(future.status, 400);
  });
});

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

const lara: AuthUser = {
  id: "44444444-4444-4444-8444-444444444444",
  legacyId: "lara",
  displayName: "Lara",
  role: "user",
  permissions: [],
};

const destroyedVote: SurveyQuestion = {
  id: "33333333-3333-4333-8333-333333333333",
  key: "destroyed_vote",
  title: "Quien estuvo mas destruido anoche",
};

const mostFlirty: SurveyQuestion = {
  id: "55555555-5555-4555-8555-555555555555",
  key: "most_flirty",
  title: "¿Quién fue el más chamullero anoche?",
};

const bestOutfit: SurveyQuestion = {
  id: "66666666-6666-4666-8666-666666666666",
  key: "best_outfit",
  title: "¿Quién tuvo el mejor outfit anoche?",
};

const questions = [destroyedVote, mostFlirty, bestOutfit];

function authAs(user: AuthUser): RequestHandler {
  return (req, _res, next) => {
    req.user = user;
    next();
  };
}

function makeVote(surveyKey: string, voterUserId: string, votedUserId: string): SurveyVote {
  return {
    id: `${surveyKey}-${voterUserId}-2026-08-28`,
    surveyKey,
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
    [lara.id, lara.id],
    [lara.legacyId, lara.id],
  ]);

  return {
    calls,
    votes,
    async listQuestions() {
      calls.push("list");
      return questions;
    },
    async findQuestionByKey(surveyKey) {
      calls.push(`question:${surveyKey}`);
      return questions.find((question) => question.key === surveyKey) ?? null;
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
      const vote = makeVote(surveyKey, voterUserId, votedUserId);
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
  it("lists the daily surveys", async () => {
    const repo = makeRepository();
    const app = makeApp(jere, repo);

    const response = await request(app).get("/surveys");

    assert.equal(response.status, 200);
    assert.deepEqual(
      response.body.surveys.map((survey) => survey.key),
      ["destroyed_vote", "most_flirty", "best_outfit"]
    );
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

  it("stores most_flirty and best_outfit votes", async () => {
    const repo = makeRepository();
    const app = makeApp(jere, repo);

    const flirty = await request(app).put("/surveys/most_flirty/2026-08-28/vote").send({ votedUserId: gio.id });
    const outfit = await request(app).put("/surveys/best_outfit/2026-08-28/vote").send({ votedUserId: lara.id });

    assert.equal(flirty.status, 200);
    assert.equal(flirty.body.vote.surveyKey, "most_flirty");
    assert.equal(outfit.status, 200);
    assert.equal(outfit.body.vote.surveyKey, "best_outfit");
    assert.equal(repo.votes.length, 2);
  });

  it("supports dynamically created active users as vote targets", async () => {
    const repo = makeRepository();
    const app = makeApp(jere, repo);

    const response = await request(app).put("/surveys/best_outfit/2026-08-28/vote").send({ votedUserId: "lara" });

    assert.equal(response.status, 200);
    assert.equal(response.body.vote.votedUserId, lara.id);
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

  it("rejects self votes in the new daily surveys", async () => {
    const repo = makeRepository();
    const app = makeApp(jere, repo);

    const flirty = await request(app).put("/surveys/most_flirty/2026-08-28/vote").send({ votedUserId: jere.id });
    const outfit = await request(app).put("/surveys/best_outfit/2026-08-28/vote").send({ votedUserId: jere.id });

    assert.equal(flirty.status, 400);
    assert.equal(flirty.body.error, "self_vote_not_allowed");
    assert.equal(outfit.status, 400);
    assert.equal(outfit.body.error, "self_vote_not_allowed");
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

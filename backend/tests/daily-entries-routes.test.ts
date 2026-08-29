import assert from "node:assert/strict";
import { describe, it } from "node:test";
import express, { type RequestHandler } from "express";
import request from "supertest";
import { createDailyEntriesRouter } from "../src/daily-entries/routes";
import type { DailyEntriesRepository } from "../src/daily-entries/repository";
import type { DailyEntry, DailyEntryInput } from "../src/daily-entries/types";
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

const validInput: DailyEntryInput = {
  sleep: { didNotSleep: false, bedtime: "02:00", wake: "10:00" },
  nap: { start: "16:00", end: "17:00" },
  fifthMeal: "yes",
  bathroom: 2,
  boliche: { didNotGo: false, time: "05:30" },
};

function authAs(user: AuthUser): RequestHandler {
  return (req, _res, next) => {
    req.user = user;
    next();
  };
}

function makeEntry(userId: string, dateKey = "2026-08-28", input: DailyEntryInput = validInput): DailyEntry {
  return {
    id: `${userId}-${dateKey}`,
    userId,
    dateKey,
    ...input,
    createdAt: "2026-08-29T12:00:00.000Z",
    updatedAt: "2026-08-29T12:00:00.000Z",
  };
}

function makeRepository(seed: DailyEntry[] = []): DailyEntriesRepository & { calls: string[] } {
  const entries = [...seed];
  const calls: string[] = [];

  return {
    calls,
    async listEntries(userId) {
      calls.push(`list:${userId}`);
      return entries.filter((entry) => entry.userId === userId);
    },
    async findEntry(userId, dateKey) {
      calls.push(`find:${userId}:${dateKey}`);
      return entries.find((entry) => entry.userId === userId && entry.dateKey === dateKey) ?? null;
    },
    async upsertEntry(userId, dateKey, input) {
      calls.push(`upsert:${userId}:${dateKey}`);
      const index = entries.findIndex((entry) => entry.userId === userId && entry.dateKey === dateKey);
      const entry = makeEntry(userId, dateKey, input);
      if (index === -1) entries.push(entry);
      else entries[index] = entry;
      return entry;
    },
  };
}

function makeApp(user: AuthUser, repository: DailyEntriesRepository) {
  const app = express();
  app.use(express.json());
  app.use("/daily-entries", createDailyEntriesRouter(repository, authAs(user), now));
  return app;
}

describe("daily entries routes", () => {
  it("rejects today and future dates", async () => {
    const repo = makeRepository();
    const app = makeApp(jere, repo);

    const today = await request(app).put("/daily-entries/2026-08-29").send(validInput);
    const future = await request(app).put("/daily-entries/2026-08-30").send(validInput);

    assert.equal(today.status, 400);
    assert.equal(today.body.error, "date_must_be_before_today");
    assert.equal(future.status, 400);
  });

  it("allows registering yesterday", async () => {
    const repo = makeRepository();
    const app = makeApp(jere, repo);

    const response = await request(app).put("/daily-entries/2026-08-28").send(validInput);

    assert.equal(response.status, 200);
    assert.equal(response.body.entry.userId, jere.id);
    assert.equal(response.body.entry.dateKey, "2026-08-28");
    assert.deepEqual(repo.calls, [`upsert:${jere.id}:2026-08-28`]);
  });

  it("updates the same user/date instead of creating duplicates", async () => {
    const repo = makeRepository();
    const app = makeApp(jere, repo);

    await request(app).put("/daily-entries/2026-08-28").send(validInput);
    const response = await request(app).put("/daily-entries/2026-08-28").send({
      ...validInput,
      bathroom: 4,
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.entry.bathroom, 4);
    assert.deepEqual(repo.calls, [`upsert:${jere.id}:2026-08-28`, `upsert:${jere.id}:2026-08-28`]);
  });

  it("does not accept or persist computed fields", async () => {
    const repo = makeRepository();
    const app = makeApp(jere, repo);

    const rejected = await request(app)
      .put("/daily-entries/2026-08-28")
      .send({ ...validInput, computed: { sleepMinutes: 480 } });
    const accepted = await request(app).put("/daily-entries/2026-08-28").send(validInput);

    assert.equal(rejected.status, 400);
    assert.equal(rejected.body.error, "computed_fields_are_not_accepted");
    assert.equal(accepted.status, 200);
    assert.equal(accepted.body.entry.computed, undefined);
  });

  it("cannot read or modify another user's entries, even as admin", async () => {
    const repo = makeRepository([makeEntry(jere.id)]);
    const app = makeApp(gio, repo);

    const read = await request(app).get("/daily-entries/2026-08-28?userId=22222222-2222-4222-8222-222222222222");
    const write = await request(app).put("/daily-entries/2026-08-28").send({ ...validInput, userId: jere.id });

    assert.equal(read.status, 404);
    assert.equal(write.status, 200);
    assert.equal(write.body.entry.userId, gio.id);
    assert.deepEqual(repo.calls, [`find:${gio.id}:2026-08-28`, `upsert:${gio.id}:2026-08-28`]);
  });
});

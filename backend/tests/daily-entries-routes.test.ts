import assert from "node:assert/strict";
import { describe, it } from "node:test";
import express, { type RequestHandler } from "express";
import request from "supertest";
import { createDailyEntriesRouter, runDailyEntryFollowUps } from "../src/daily-entries/routes";
import type { DailyEntriesRepository } from "../src/daily-entries/repository";
import type { DailyEntry, DailyEntryInput } from "../src/daily-entries/types";
import type { AuthUser } from "../src/auth/types";
import type { TripConfig } from "../src/trip-config/repository";

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
  sleep: { didNotSleep: false, bedtime: "06:00", wake: "10:00" },
  nap: { start: "16:00", end: "17:00" },
  fifthMeal: "yes",
  bathroom: 2,
  boliche: { didNotGo: false, entryTime: "01:30", time: "05:30", closedClub: false },
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

function makeApp(
  user: AuthUser,
  repository: DailyEntriesRepository,
  afterUpsert: (dateKey: string) => Promise<unknown> = async () => null,
  tripConfig: TripConfig = { openTime: "01:00", closeTime: "06:45" }
) {
  const app = express();
  app.use(express.json());
  app.use("/daily-entries", createDailyEntriesRouter(repository, authAs(user), now, afterUpsert, { getConfig: async () => tripConfig }));
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

  it("keeps the daily entry saved if the stats-ready push notification fails", async () => {
    const repo = makeRepository();
    const app = makeApp(jere, repo, async () => {
      throw new Error("push failed");
    });
    const originalWarn = console.warn;
    console.warn = () => {};

    try {
      const response = await request(app).put("/daily-entries/2026-08-28").send(validInput);

      assert.equal(response.status, 200);
      assert.equal(response.body.entry.userId, jere.id);
      assert.deepEqual(repo.calls, [`upsert:${jere.id}:2026-08-28`]);
    } finally {
      console.warn = originalWarn;
    }
  });

  it("runs daily reminder fallback only for yesterday before stats-ready and achievements", async () => {
    const calls: string[] = [];

    await runDailyEntryFollowUps("2026-08-28", {
      now,
      push: {
        async sendDailyRemindersForDate(dateKey, source) {
          calls.push(`fallback:${source}:${dateKey}`);
          return {
            dateKey,
            source: source || "cron",
            usersChecked: 13,
            activeUsers: 13,
            missingUsers: 12,
            subscribedUsers: 12,
            sent: 12,
            failed: 0,
          };
        },
        async notifyStatsReadyIfComplete(dateKey) {
          calls.push(`stats:${dateKey}`);
          return { sent: false, deliveries: 0 };
        },
      },
      async evaluateAchievements(dateKey) {
        calls.push(`achievements:${dateKey}`);
      },
    });

    assert.deepEqual(calls, ["fallback:daily-fallback:2026-08-28", "stats:2026-08-28", "achievements:2026-08-28"]);
  });

  it("runs daily reminder fallback for yesterday only inside the Argentina daytime window", async () => {
    const cases = [
      { label: "06:59", now: "2026-08-29T09:59:00.000Z", fallback: false },
      { label: "07:00", now: "2026-08-29T10:00:00.000Z", fallback: true },
      { label: "12:00", now: "2026-08-29T15:00:00.000Z", fallback: true },
      { label: "18:59", now: "2026-08-29T21:59:59.000Z", fallback: true },
      { label: "19:00", now: "2026-08-29T22:00:00.000Z", fallback: false },
      { label: "22:00", now: "2026-08-30T01:00:00.000Z", fallback: false },
      { label: "23:30", now: "2026-08-30T02:30:00.000Z", fallback: false },
      { label: "00:30", now: "2026-08-29T03:30:00.000Z", fallback: false },
    ];

    for (const testCase of cases) {
      const calls: string[] = [];
      await runDailyEntryFollowUps("2026-08-28", {
        now: () => new Date(testCase.now),
        push: {
          async sendDailyRemindersForDate(dateKey, source) {
            calls.push(`fallback:${testCase.label}:${source}:${dateKey}`);
            return {
              dateKey,
              source: source || "cron",
              usersChecked: 13,
              activeUsers: 13,
              missingUsers: 12,
              subscribedUsers: 12,
              sent: 12,
              failed: 0,
            };
          },
          async notifyStatsReadyIfComplete(dateKey) {
            calls.push(`stats:${testCase.label}:${dateKey}`);
            return { sent: true, deliveries: 13 };
          },
        },
        async evaluateAchievements(dateKey) {
          calls.push(`achievements:${testCase.label}:${dateKey}`);
        },
      });

      const expected = testCase.fallback
        ? [
            `fallback:${testCase.label}:daily-fallback:2026-08-28`,
            `stats:${testCase.label}:2026-08-28`,
            `achievements:${testCase.label}:2026-08-28`,
          ]
        : [`stats:${testCase.label}:2026-08-28`, `achievements:${testCase.label}:2026-08-28`];
      assert.deepEqual(calls, expected);
    }
  });

  it("does not run daily reminder fallback for historical daily entries", async () => {
    const calls: string[] = [];

    await runDailyEntryFollowUps("2026-08-27", {
      now,
      push: {
        async sendDailyRemindersForDate(dateKey) {
          calls.push(`fallback:${dateKey}`);
          throw new Error("fallback should not run");
        },
        async notifyStatsReadyIfComplete(dateKey) {
          calls.push(`stats:${dateKey}`);
          return { sent: false, deliveries: 0 };
        },
      },
      async evaluateAchievements(dateKey) {
        calls.push(`achievements:${dateKey}`);
      },
    });

    assert.deepEqual(calls, ["stats:2026-08-27", "achievements:2026-08-27"]);
  });

  it("continues stats-ready and achievements when the fallback push fails", async () => {
    const calls: string[] = [];
    const originalWarn = console.warn;
    console.warn = () => {};

    try {
      await runDailyEntryFollowUps("2026-08-28", {
        now,
        push: {
          async sendDailyRemindersForDate(dateKey) {
            calls.push(`fallback:${dateKey}`);
            throw new Error("render woke up too slowly");
          },
          async notifyStatsReadyIfComplete(dateKey) {
            calls.push(`stats:${dateKey}`);
            return { sent: true, deliveries: 13 };
          },
        },
        async evaluateAchievements(dateKey) {
          calls.push(`achievements:${dateKey}`);
        },
      });
    } finally {
      console.warn = originalWarn;
    }

    assert.deepEqual(calls, ["fallback:2026-08-28", "stats:2026-08-28", "achievements:2026-08-28"]);
  });

  it("does not send reminders when the last active user completes yesterday", async () => {
    const calls: string[] = [];

    await runDailyEntryFollowUps("2026-08-28", {
      now,
      push: {
        async sendDailyRemindersForDate(dateKey, source) {
          calls.push(`fallback:${source}:${dateKey}:missing=0`);
          return {
            dateKey,
            source: source || "cron",
            usersChecked: 13,
            activeUsers: 13,
            missingUsers: 0,
            subscribedUsers: 0,
            sent: 0,
            failed: 0,
          };
        },
        async notifyStatsReadyIfComplete(dateKey) {
          calls.push(`stats:${dateKey}`);
          return { sent: true, deliveries: 13 };
        },
      },
      async evaluateAchievements(dateKey) {
        calls.push(`achievements:${dateKey}`);
      },
    });

    assert.deepEqual(calls, ["fallback:daily-fallback:2026-08-28:missing=0", "stats:2026-08-28", "achievements:2026-08-28"]);
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

  it("rejects wake times that are not after bedtime", async () => {
    const repo = makeRepository();
    const app = makeApp(jere, repo);

    const response = await request(app)
      .put("/daily-entries/2026-08-28")
      .send({ ...validInput, sleep: { didNotSleep: false, bedtime: "07:00", wake: "06:00" } });

    assert.equal(response.status, 400);
    assert.equal(response.body.error, "invalid_sleep_range");
    assert.deepEqual(repo.calls, []);
  });

  it("rejects nap times before wake time or not after start time", async () => {
    const repo = makeRepository();
    const app = makeApp(jere, repo);

    const beforeWake = await request(app)
      .put("/daily-entries/2026-08-28")
      .send({ ...validInput, sleep: { didNotSleep: false, bedtime: "07:00", wake: "15:40" }, nap: { start: "14:00", end: "16:00" } });
    const sameEnd = await request(app)
      .put("/daily-entries/2026-08-28")
      .send({ ...validInput, nap: { start: "19:00", end: "19:00" } });

    assert.equal(beforeWake.status, 400);
    assert.equal(beforeWake.body.error, "invalid_nap_start_before_wake");
    assert.equal(sameEnd.status, 400);
    assert.equal(sameEnd.body.error, "invalid_nap_range");
    assert.deepEqual(repo.calls, []);
  });

  it("rejects boliche exits that are not before bedtime", async () => {
    const repo = makeRepository();
    const app = makeApp(jere, repo);

    const afterBedtime = await request(app)
      .put("/daily-entries/2026-08-28")
      .send({
        ...validInput,
        sleep: { didNotSleep: false, bedtime: "05:00", wake: "10:00" },
        boliche: { didNotGo: false, entryTime: "03:00", time: "05:00", closedClub: false },
      });
    const beforeOpening = await request(app)
      .put("/daily-entries/2026-08-28")
      .send({
        ...validInput,
        sleep: { didNotSleep: false, bedtime: "00:50", wake: "10:00" },
        boliche: { didNotGo: false, entryTime: "01:00", time: "01:10", closedClub: false },
      });

    assert.equal(afterBedtime.status, 400);
    assert.equal(afterBedtime.body.error, "invalid_boliche_time_range");
    assert.equal(beforeOpening.status, 400);
    assert.equal(beforeOpening.body.error, "invalid_boliche_time_range");
    assert.deepEqual(repo.calls, []);
  });

  it("allows boliche exits before closing time when the user did not sleep", async () => {
    const repo = makeRepository();
    const app = makeApp(jere, repo);

    const response = await request(app)
      .put("/daily-entries/2026-08-28")
      .send({
        ...validInput,
        sleep: { didNotSleep: true, bedtime: null, wake: null },
        boliche: { didNotGo: false, entryTime: "02:00", time: "06:40", closedClub: false },
      });

    assert.equal(response.status, 200);
    assert.equal(response.body.entry.sleep.didNotSleep, true);
    assert.equal(response.body.entry.boliche.entryTime, "02:00");
    assert.equal(response.body.entry.boliche.time, "06:40");
  });

  it("rejects regular boliche exits at or after closing time when the user did not sleep", async () => {
    const repo = makeRepository();
    const app = makeApp(jere, repo);

    const atClosing = await request(app)
      .put("/daily-entries/2026-08-28")
      .send({
        ...validInput,
        sleep: { didNotSleep: true, bedtime: null, wake: null },
        boliche: { didNotGo: false, entryTime: "02:00", time: "06:45", closedClub: false },
      });
    const afterClosing = await request(app)
      .put("/daily-entries/2026-08-28")
      .send({
        ...validInput,
        sleep: { didNotSleep: true, bedtime: null, wake: null },
        boliche: { didNotGo: false, entryTime: "02:00", time: "07:10", closedClub: false },
      });

    assert.equal(atClosing.status, 400);
    assert.equal(atClosing.body.error, "invalid_boliche_time_range");
    assert.equal(afterClosing.status, 400);
    assert.equal(afterClosing.body.error, "invalid_boliche_time_range");
    assert.deepEqual(repo.calls, []);
  });

  it("allows closed club without storing a regular exit time", async () => {
    const repo = makeRepository();
    const app = makeApp(jere, repo);

    const response = await request(app)
      .put("/daily-entries/2026-08-28")
      .send({
        ...validInput,
        sleep: { didNotSleep: false, bedtime: "07:00", wake: "12:00" },
        boliche: { didNotGo: false, entryTime: "02:00", time: null, closedClub: true },
      });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body.entry.boliche, { didNotGo: false, entryTime: "02:00", time: null, closedClub: true });
  });

  it("allows closed club when the user did not sleep", async () => {
    const repo = makeRepository();
    const app = makeApp(jere, repo);

    const response = await request(app)
      .put("/daily-entries/2026-08-28")
      .send({
        ...validInput,
        sleep: { didNotSleep: true, bedtime: null, wake: null },
        boliche: { didNotGo: false, entryTime: "02:00", time: null, closedClub: true },
      });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body.entry.boliche, { didNotGo: false, entryTime: "02:00", time: null, closedClub: true });
  });

  it("rejects closed club when sleep timing is incompatible", async () => {
    const repo = makeRepository();
    const app = makeApp(jere, repo);

    const response = await request(app)
      .put("/daily-entries/2026-08-28")
      .send({
        ...validInput,
        sleep: { didNotSleep: false, bedtime: "06:50", wake: "07:00" },
        boliche: { didNotGo: false, entryTime: "02:00", time: null, closedClub: true },
      });

    assert.equal(response.status, 400);
    assert.equal(response.body.error, "invalid_boliche_time_range");
    assert.deepEqual(repo.calls, []);
  });

  it("rejects closed club when the entry is at or after technical closing", async () => {
    const repo = makeRepository();
    const app = makeApp(jere, repo);

    const response = await request(app)
      .put("/daily-entries/2026-08-28")
      .send({
        ...validInput,
        sleep: { didNotSleep: true, bedtime: null, wake: null },
        boliche: { didNotGo: false, entryTime: "06:45", time: null, closedClub: true },
      });

    assert.equal(response.status, 400);
    assert.equal(response.body.error, "invalid_boliche_time_range");
    assert.deepEqual(repo.calls, []);
  });

  it("rejects closed club mixed with a regular exit time", async () => {
    const repo = makeRepository();
    const app = makeApp(jere, repo);

    const response = await request(app)
      .put("/daily-entries/2026-08-28")
      .send({ ...validInput, boliche: { didNotGo: false, entryTime: "02:00", time: "06:30", closedClub: true } });

    assert.equal(response.status, 400);
    assert.equal(response.body.error, "invalid_boliche_closed_club_conflict");
    assert.deepEqual(repo.calls, []);
  });

  it("rejects boliche exits before their entry time", async () => {
    const repo = makeRepository();
    const app = makeApp(jere, repo);

    const response = await request(app)
      .put("/daily-entries/2026-08-28")
      .send({
        ...validInput,
        sleep: { didNotSleep: true, bedtime: null, wake: null },
        boliche: { didNotGo: false, entryTime: "03:00", time: "02:00", closedClub: false },
      });

    assert.equal(response.status, 400);
    assert.equal(response.body.error, "invalid_boliche_time_range");
    assert.deepEqual(repo.calls, []);
  });

  it("validates boliche entry and exit against configurable club times", async () => {
    const repo = makeRepository();
    const app = makeApp(jere, repo, async () => null, { openTime: "00:30", closeTime: "05:00" });

    const beforeOpen = await request(app)
      .put("/daily-entries/2026-08-28")
      .send({ ...validInput, sleep: { didNotSleep: true, bedtime: null, wake: null }, boliche: { didNotGo: false, entryTime: "00:20", time: "01:10", closedClub: false } });
    const valid = await request(app)
      .put("/daily-entries/2026-08-28")
      .send({ ...validInput, sleep: { didNotSleep: true, bedtime: null, wake: null }, boliche: { didNotGo: false, entryTime: "00:30", time: "04:50", closedClub: false } });
    const atClose = await request(app)
      .put("/daily-entries/2026-08-28")
      .send({ ...validInput, sleep: { didNotSleep: true, bedtime: null, wake: null }, boliche: { didNotGo: false, entryTime: "01:00", time: "05:00", closedClub: false } });

    assert.equal(beforeOpen.status, 400);
    assert.equal(beforeOpen.body.error, "invalid_boliche_time_range");
    assert.equal(valid.status, 200);
    assert.equal(valid.body.entry.boliche.entryTime, "00:30");
    assert.equal(valid.body.entry.boliche.time, "04:50");
    assert.equal(atClose.status, 400);
  });

  it("validates closed club and sleep against configured closing time", async () => {
    const repo = makeRepository();
    const app = makeApp(jere, repo, async () => null, { openTime: "00:30", closeTime: "05:00" });

    const tooEarlySleep = await request(app)
      .put("/daily-entries/2026-08-28")
      .send({
        ...validInput,
        sleep: { didNotSleep: false, bedtime: "04:50", wake: "09:00" },
        boliche: { didNotGo: false, entryTime: "01:00", time: null, closedClub: true },
      });
    const valid = await request(app)
      .put("/daily-entries/2026-08-28")
      .send({
        ...validInput,
        sleep: { didNotSleep: false, bedtime: "05:10", wake: "09:00" },
        boliche: { didNotGo: false, entryTime: "01:00", time: null, closedClub: true },
      });
    const didNotSleep = await request(app)
      .put("/daily-entries/2026-08-28")
      .send({
        ...validInput,
        sleep: { didNotSleep: true, bedtime: null, wake: null },
        boliche: { didNotGo: false, entryTime: "01:00", time: null, closedClub: true },
      });

    assert.equal(tooEarlySleep.status, 400);
    assert.equal(tooEarlySleep.body.error, "invalid_boliche_time_range");
    assert.equal(valid.status, 200);
    assert.equal(didNotSleep.status, 200);
  });

  it("supports configurable club ranges crossing midnight", async () => {
    const repo = makeRepository();
    const app = makeApp(jere, repo, async () => null, { openTime: "23:30", closeTime: "05:15" });

    const valid = await request(app)
      .put("/daily-entries/2026-08-28")
      .send({
        ...validInput,
        sleep: { didNotSleep: false, bedtime: "05:30", wake: "11:00" },
        boliche: { didNotGo: false, entryTime: "00:30", time: "04:00", closedClub: false },
      });
    const closed = await request(app)
      .put("/daily-entries/2026-08-28")
      .send({
        ...validInput,
        sleep: { didNotSleep: false, bedtime: "05:30", wake: "11:00" },
        boliche: { didNotGo: false, entryTime: "00:30", time: null, closedClub: true },
      });

    assert.equal(valid.status, 200);
    assert.equal(closed.status, 200);
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

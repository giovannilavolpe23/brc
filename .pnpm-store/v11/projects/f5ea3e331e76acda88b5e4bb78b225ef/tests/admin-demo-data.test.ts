import assert from "node:assert/strict";
import { describe, it } from "node:test";
import express, { type RequestHandler } from "express";
import request from "supertest";
import {
  buildDemoDataset,
  createAdminDemoDataRouter,
  createPostgresDemoDataRepository,
  type DemoDataRepository,
  type DemoUser,
  type GeneratedDemoDataset,
} from "../src/admin/demo-data";
import type { AuthUser } from "../src/auth/types";
import { calculateStats } from "../src/stats/calculations";
import type { DailyEntryStatsRow, ExpenseRow, PreviaParticipantStatsRow, StatsData, SurveyVoteStatsRow } from "../src/stats/types";

const gioId = "11111111-1111-4111-8111-111111111111";
const jereId = "22222222-2222-4222-8222-222222222222";
const nataId = "33333333-3333-4333-8333-333333333333";
const sebasId = "44444444-4444-4444-8444-444444444444";

const admin: AuthUser = {
  id: gioId,
  legacyId: "gio",
  displayName: "Gio",
  role: "admin",
  permissions: [],
};

const user: AuthUser = {
  id: jereId,
  legacyId: "jere",
  displayName: "Jere",
  role: "user",
  permissions: ["create_previa"],
};

const demoUsers: DemoUser[] = [
  { ...admin, legacyId: "gio" },
  { ...user, legacyId: "jere" },
  { id: nataId, legacyId: "nata", displayName: "Nata", role: "user", permissions: [] },
  { id: sebasId, legacyId: "sebas", displayName: "Sebas", role: "user", permissions: [] },
];

function authAs(authUser: AuthUser): RequestHandler {
  return (req, _res, next) => {
    req.user = authUser;
    next();
  };
}

function makeApp(authUser: AuthUser, repository: DemoDataRepository) {
  const app = express();
  app.use(express.json());
  app.use("/admin/dev", createAdminDemoDataRouter(repository, authAs(authUser)));
  return app;
}

function constantRng(value = 0.42): () => number {
  return () => value;
}

function sequenceRng(values: number[]): () => number {
  let index = 0;
  return () => {
    const value = values[index % values.length];
    index += 1;
    return value;
  };
}

function dateBefore(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10);
}

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function toStatsData(dataset: GeneratedDemoDataset): StatsData {
  return {
    users: dataset.users.map((user) => ({ id: user.id, legacyId: user.legacyId, displayName: user.displayName })),
    expenses: dataset.moneyMovements
      .filter((movement): movement is (typeof dataset.moneyMovements)[number] & { type: "expense"; category: string } => movement.type === "expense")
      .map<ExpenseRow>((movement) => ({
        userId: movement.userId,
        category: movement.category,
        amount: movement.amount,
        dateKey: movement.movementDate,
      })),
    dailyEntries: dataset.dailyEntries.map<DailyEntryStatsRow>((entry) => ({
      userId: entry.userId,
      dateKey: entry.dateKey,
      sleepDidNotSleep: entry.sleepDidNotSleep,
      sleepBedtime: entry.sleepBedtime,
      sleepWake: entry.sleepWake,
      napStart: entry.napStart,
      napEnd: entry.napEnd,
      fifthMeal: entry.fifthMeal,
      bathroom: entry.bathroomCount,
      bolicheDidNotGo: entry.bolicheDidNotGo,
      bolicheExitTime: entry.bolicheExitTime,
    })),
    surveyVotes: dataset.surveyVotes.map<SurveyVoteStatsRow>((vote) => ({
      surveyKey: vote.surveyKey,
      dateKey: vote.dateKey,
      votedUserId: vote.votedUserId,
    })),
    previaParticipants: dataset.previas.flatMap<PreviaParticipantStatsRow>((previa) =>
      previa.participantIds.map((userId) => ({
        previaId: previa.legacyId,
        userId,
        dateKey: dateBefore(previa.occurredAt.slice(0, 10)),
      }))
    ),
  };
}

describe("admin demo data generation", () => {
  it("rejects regular users", async () => {
    let called = false;
    const repository: DemoDataRepository = {
      async generateDemoData() {
        called = true;
        throw new Error("should not be called");
      },
    };

    const response = await request(makeApp(user, repository)).post("/admin/dev/generate-demo-data").send({ nights: 7 });

    assert.equal(response.status, 403);
    assert.equal(called, false);
  });

  it("allows admins and returns a summary", async () => {
    const repository: DemoDataRepository = {
      async generateDemoData(nights) {
        return {
          nights,
          days: ["2026-08-26"],
          users: 4,
          deleted: {
            moneyMovements: 1,
            dailyEntries: 2,
            surveyVotes: 3,
            previas: 4,
            previaProducts: 5,
            previaParticipants: 6,
            initialBalances: 0,
          },
          generated: {
            dailyEntries: 4,
            surveyVotes: 4,
            moneyMovements: 10,
            previas: 1,
            previaProducts: 3,
            previaParticipants: 4,
          },
          preserved: ["users", "roles", "permissions", "user_permissions", "survey_questions", "initial_balances"],
        };
      },
    };

    const response = await request(makeApp(admin, repository)).post("/admin/dev/generate-demo-data").send({ nights: 7 });

    assert.equal(response.status, 201);
    assert.equal(response.body.ok, true);
    assert.equal(response.body.nights, 7);
    assert.equal(response.body.deleted.initialBalances, 0);
    assert.deepEqual(response.body.preserved, ["users", "roles", "permissions", "user_permissions", "survey_questions", "initial_balances"]);
  });

  it("generates the requested amount of closed days", () => {
    const six = buildDemoDataset(demoUsers, 6, "2026-09-02", constantRng());
    const seven = buildDemoDataset(demoUsers, 7, "2026-09-02", constantRng());

    assert.equal(six.days.length, 6);
    assert.deepEqual(six.days, ["2026-08-27", "2026-08-28", "2026-08-29", "2026-08-30", "2026-08-31", "2026-09-01"]);
    assert.equal(seven.days.length, 7);
    assert.deepEqual(seven.days, ["2026-08-26", "2026-08-27", "2026-08-28", "2026-08-29", "2026-08-30", "2026-08-31", "2026-09-01"]);
  });

  it("rejects invalid nights values", async () => {
    let called = false;
    const repository: DemoDataRepository = {
      async generateDemoData() {
        called = true;
        throw new Error("should not be called");
      },
    };

    const response = await request(makeApp(admin, repository)).post("/admin/dev/generate-demo-data").send({ nights: 8 });

    assert.equal(response.status, 400);
    assert.deepEqual(response.body, { error: "invalid_nights" });
    assert.equal(called, false);
  });

  it("generates coherent daily entries, votes, money movements, and previas", () => {
    const dataset = buildDemoDataset(demoUsers, 7, "2026-09-02", sequenceRng([0.04, 0.18, 0.37, 0.62, 0.81, 0.95]));
    const userIds = new Set(demoUsers.map((demoUser) => demoUser.id));
    const categories = new Set(["Chocolates", "Alcohol", "Boliche", "Comida", "Bebida", "Actividades", "Otros"]);

    assert.equal(dataset.dailyEntries.length, demoUsers.length * 7);
    assert.equal(new Set(dataset.dailyEntries.map((entry) => `${entry.userId}:${entry.dateKey}`)).size, dataset.dailyEntries.length);
    dataset.dailyEntries.forEach((entry) => {
      assert.equal(userIds.has(entry.userId), true);
      assert.equal(dataset.days.includes(entry.dateKey), true);
      assert.equal(entry.bathroomCount >= 0 && entry.bathroomCount <= 4, true);
      assert.match(entry.fifthMeal, /^(yes|no)$/);
      if (entry.sleepDidNotSleep) {
        assert.equal(entry.sleepBedtime, null);
        assert.equal(entry.sleepWake, null);
        assert.equal(entry.bolicheExitTime, null);
      } else {
        assert.ok(entry.sleepBedtime);
        assert.ok(entry.sleepWake);
        assert.equal(timeToMinutes(entry.sleepWake) > timeToMinutes(entry.sleepBedtime), true);
      }
      if (entry.napStart && entry.napEnd) {
        assert.equal(timeToMinutes(entry.napStart) >= timeToMinutes(entry.sleepWake ?? "00:00"), true);
        assert.equal(timeToMinutes(entry.napEnd) > timeToMinutes(entry.napStart), true);
      }
      if (entry.bolicheExitTime) {
        assert.equal(timeToMinutes(entry.bolicheExitTime) >= 60, true);
        assert.equal(timeToMinutes(entry.bolicheExitTime) <= timeToMinutes(entry.sleepBedtime ?? "00:00") - 10, true);
      }
    });

    assert.equal(dataset.surveyVotes.length, demoUsers.length * 7);
    assert.equal(new Set(dataset.surveyVotes.map((vote) => `${vote.surveyKey}:${vote.voterUserId}:${vote.dateKey}`)).size, dataset.surveyVotes.length);
    dataset.surveyVotes.forEach((vote) => {
      assert.equal(vote.surveyKey, "destroyed_vote");
      assert.notEqual(vote.voterUserId, vote.votedUserId);
      assert.equal(userIds.has(vote.voterUserId), true);
      assert.equal(userIds.has(vote.votedUserId), true);
    });

    assert.equal(new Set(dataset.moneyMovements.map((movement) => `${movement.userId}:${movement.legacyId}`)).size, dataset.moneyMovements.length);
    assert.equal(new Set(dataset.moneyMovements.filter((movement) => movement.type === "expense").map((movement) => movement.category)).size, 7);
    dataset.moneyMovements.forEach((movement) => {
      assert.equal(userIds.has(movement.userId), true);
      assert.equal(movement.amount > 0, true);
      if (movement.type === "income") assert.equal(movement.category, null);
      else assert.equal(categories.has(movement.category), true);
    });

    assert.equal(dataset.previas.length > 0, true);
    assert.equal(new Set(dataset.previas.map((previa) => previa.legacyId)).size, dataset.previas.length);
    dataset.previas.forEach((previa) => {
      assert.equal(previa.creatorUserId === gioId || previa.creatorUserId === jereId, true);
      assert.equal(previa.products.length >= 1, true);
      assert.equal(previa.participantIds.length >= 1, true);
      assert.equal(new Set(previa.participantIds).size, previa.participantIds.length);
      previa.participantIds.forEach((participantId) => assert.equal(userIds.has(participantId), true));
      previa.products.forEach((product) => {
        assert.equal(product.unitPrice > 0, true);
        assert.equal(product.quantity > 0, true);
      });
      assert.equal(previa.totalAmount, previa.products.reduce((sum, product) => sum + product.unitPrice * product.quantity, 0));
      assert.equal(previa.amountPerParticipant, Math.round(previa.totalAmount / previa.participantIds.length));
    });
  });

  it("feeds stats and achievements with enough shared data", () => {
    const dataset = buildDemoDataset(demoUsers, 7, "2026-09-02", sequenceRng([0.02, 0.21, 0.44, 0.67, 0.88]));
    const stats = calculateStats("total", toStatsData(dataset));

    assert.equal(stats.closedDays.length, 7);
    assert.equal(stats.money.totalSpentGlobal > 0, true);
    assert.equal(stats.money.rankingByCategory.length, 7);
    assert.equal(stats.dailyEntries.sleepMinutes.length > 0, true);
    assert.equal(stats.dailyEntries.leastSleepMinutes.length > 0, true);
    assert.equal(stats.surveys.destroyed_vote.length > 0, true);
    assert.equal(stats.previas.totalCount, dataset.previas.length);
    assert.equal(stats.previas.byParticipant.length > 0, true);
    assert.equal(stats.streaks.zombie.some((row) => row.value >= 2), true);
    assert.equal(stats.streaks.alcoholSpender.some((row) => row.value >= 2), true);
    assert.equal(stats.streaks.destroyedVote.some((row) => row.value >= 2), true);
    assert.equal(stats.streaks.moneySpender.some((row) => row.value >= 2), true);

    const titleHolders = new Set([
      ...stats.money.totalSpentByUser.slice(0, 3).map((row) => row.userId),
      ...stats.dailyEntries.leastSleepMinutes.slice(0, 3).map((row) => row.userId),
      ...stats.surveys.destroyed_vote.slice(0, 3).map((row) => row.userId),
      ...stats.previas.byParticipant.slice(0, 3).map((row) => row.userId),
      ...stats.streaks.zombie.slice(0, 3).map((row) => row.userId),
    ]);
    assert.equal(titleHolders.size >= 2, true);
  });

  it("resets and inserts the dataset in one transaction", async () => {
    const queries: string[] = [];
    let previaId = 0;
    const client = {
      async query(sql: string) {
        queries.push(sql);
        if (sql.includes("from users")) {
          return {
            rows: demoUsers.map((demoUser) => ({
              id: demoUser.id,
              legacy_id: demoUser.legacyId,
              display_name: demoUser.displayName,
              role_key: demoUser.role,
              permissions: demoUser.permissions,
            })),
          };
        }
        if (sql.includes("from survey_questions")) return { rows: [{ id: "survey-question-id" }] };
        if (sql.includes("returning id")) {
          previaId += 1;
          return { rows: [{ id: `previa-id-${previaId}` }] };
        }
        return { rowCount: 1, rows: [] };
      },
      release() {
        queries.push("release");
      },
    };
    const repository = createPostgresDemoDataRepository(async () => client, () => "2026-09-02");

    const summary = await repository.generateDemoData(6);

    assert.equal(queries[0], "begin");
    assert.equal(queries.includes("commit"), true);
    assert.equal(queries.includes("rollback"), false);
    assert.equal(queries.at(-1), "release");
    assert.equal(summary.generated.dailyEntries, 24);
    assert.equal(summary.generated.surveyVotes, 24);
    assert.equal(summary.deleted.initialBalances, 0);
    assert.equal(queries.some((query) => /delete from (users|roles|permissions|user_permissions|initial_balances|survey_questions)/.test(query)), false);
  });

  it("rolls back the complete operation if an insert fails", async () => {
    const queries: string[] = [];
    const client = {
      async query(sql: string) {
        queries.push(sql);
        if (sql.includes("from users")) {
          return {
            rows: demoUsers.map((demoUser) => ({
              id: demoUser.id,
              legacy_id: demoUser.legacyId,
              display_name: demoUser.displayName,
              role_key: demoUser.role,
              permissions: demoUser.permissions,
            })),
          };
        }
        if (sql.includes("from survey_questions")) return { rows: [{ id: "survey-question-id" }] };
        if (sql.includes("insert into money_movements")) throw new Error("boom");
        return { rowCount: 1, rows: [{ id: "previa-id" }] };
      },
      release() {
        queries.push("release");
      },
    };
    const repository = createPostgresDemoDataRepository(async () => client, () => "2026-09-02");

    await assert.rejects(() => repository.generateDemoData(6), /boom/);
    assert.equal(queries.includes("rollback"), true);
    assert.equal(queries.includes("commit"), false);
    assert.equal(queries.at(-1), "release");
  });
});

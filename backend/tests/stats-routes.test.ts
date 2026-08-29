import assert from "node:assert/strict";
import { describe, it } from "node:test";
import express, { type RequestHandler } from "express";
import request from "supertest";
import type { AuthUser } from "../src/auth/types";
import { createStatsRouter } from "../src/stats/routes";
import type { StatsRepository } from "../src/stats/repository";
import type { StatsData } from "../src/stats/types";

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

const statsData: StatsData = {
  expenses: [{ userId: gio.id, dateKey: "2026-08-28", category: "Comida", amount: 1000 }],
  dailyEntries: [
    {
      userId: gio.id,
      dateKey: "2026-08-28",
      sleepDidNotSleep: false,
      sleepBedtime: "02:00",
      sleepWake: "10:00",
      napStart: null,
      napEnd: null,
      fifthMeal: "yes",
      bathroom: 1,
      bolicheDidNotGo: true,
      bolicheExitTime: null,
    },
  ],
  surveyVotes: [],
  previaParticipants: [],
};

function authAs(user: AuthUser): RequestHandler {
  return (req, _res, next) => {
    req.user = user;
    next();
  };
}

function makeApp(user: AuthUser, repository: StatsRepository) {
  const app = express();
  app.use("/stats", createStatsRouter(repository, authAs(user), () => new Date("2026-08-29T15:00:00.000Z")));
  return app;
}

describe("stats routes", () => {
  it("returns the same global stats to different authenticated users", async () => {
    const repository: StatsRepository = {
      async loadStatsData() {
        return statsData;
      },
    };

    const gioResponse = await request(makeApp(gio, repository)).get("/stats/total");
    const jereResponse = await request(makeApp(jere, repository)).get("/stats/total");

    assert.equal(gioResponse.status, 200);
    assert.equal(jereResponse.status, 200);
    assert.deepEqual(gioResponse.body.money, jereResponse.body.money);
  });

  it("rejects today and future day views", async () => {
    const repository: StatsRepository = {
      async loadStatsData() {
        return statsData;
      },
    };

    const today = await request(makeApp(gio, repository)).get("/stats/day/2026-08-29");
    const future = await request(makeApp(gio, repository)).get("/stats/day/2026-08-30");

    assert.equal(today.status, 400);
    assert.equal(future.status, 400);
  });

  it("loads stats data using Argentina's current day boundary", async () => {
    const calls: string[] = [];
    const repository: StatsRepository = {
      async loadStatsData(todayKey) {
        calls.push(todayKey);
        return statsData;
      },
    };

    const response = await request(makeApp(gio, repository)).get("/stats/day/2026-08-28");

    assert.equal(response.status, 200);
    assert.deepEqual(calls, ["2026-08-29"]);
  });
});

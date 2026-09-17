import assert from "node:assert/strict";
import { describe, it } from "node:test";
import express, { type RequestHandler } from "express";
import request from "supertest";
import { createTripConfigRouter } from "../src/trip-config/routes";
import type { TripConfigRepository } from "../src/trip-config/repository";
import type { AuthUser } from "../src/auth/types";

const admin: AuthUser = {
  id: "11111111-1111-4111-8111-111111111111",
  legacyId: "gio",
  displayName: "Gio",
  role: "admin",
  permissions: [],
};

const normalUser: AuthUser = {
  id: "22222222-2222-4222-8222-222222222222",
  legacyId: "jere",
  displayName: "Jere",
  role: "user",
  permissions: [],
};

function authAs(user: AuthUser): RequestHandler {
  return (req, _res, next) => {
    req.user = user;
    next();
  };
}

function makeRepository(): TripConfigRepository & { saved: { openTime: string; closeTime: string } } {
  const repository = {
    saved: { openTime: "01:00", closeTime: "06:45" },
    async getConfig() {
      return repository.saved;
    },
    async updateClubTimes(config: { openTime: string; closeTime: string }) {
      repository.saved = config;
      return repository.saved;
    },
  };
  return repository;
}

function makeApp(user: AuthUser, repository = makeRepository()) {
  const app = express();
  app.use(express.json());
  app.use("/trip-config", createTripConfigRouter(repository, authAs(user)));
  return { app, repository };
}

describe("trip config routes", () => {
  it("lets authenticated users read club times", async () => {
    const { app } = makeApp(normalUser);
    const response = await request(app).get("/trip-config");

    assert.equal(response.status, 200);
    assert.deepEqual(response.body.config, { openTime: "01:00", closeTime: "06:45" });
  });

  it("lets admin update club times", async () => {
    const { app, repository } = makeApp(admin);
    const response = await request(app).patch("/trip-config/club-times").send({ openTime: "23:30", closeTime: "05:15" });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body.config, { openTime: "23:30", closeTime: "05:15" });
    assert.deepEqual(repository.saved, { openTime: "23:30", closeTime: "05:15" });
  });

  it("rejects normal users updating club times", async () => {
    const { app } = makeApp(normalUser);
    const response = await request(app).patch("/trip-config/club-times").send({ openTime: "23:30", closeTime: "05:15" });

    assert.equal(response.status, 403);
  });

  it("rejects invalid club time payloads", async () => {
    const { app } = makeApp(admin);
    const badFormat = await request(app).patch("/trip-config/club-times").send({ openTime: "noche", closeTime: "05:15" });
    const sameTime = await request(app).patch("/trip-config/club-times").send({ openTime: "05:15", closeTime: "05:15" });

    assert.equal(badFormat.status, 400);
    assert.equal(badFormat.body.error, "invalid_club_open_time");
    assert.equal(sameTime.status, 400);
    assert.equal(sameTime.body.error, "invalid_club_time_range");
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import express, { type RequestHandler } from "express";
import request from "supertest";
import { createAdminDailyProgressRouter, type AdminDailyProgressRepository } from "../src/admin/daily-progress";
import type { AuthUser } from "../src/auth/types";

const admin: AuthUser = {
  id: "11111111-1111-4111-8111-111111111111",
  legacyId: "gio",
  displayName: "Gio",
  role: "admin",
  permissions: [],
};

const user: AuthUser = {
  id: "22222222-2222-4222-8222-222222222222",
  legacyId: "jere",
  displayName: "Jere",
  role: "user",
  permissions: ["create_previa"],
};

function authAs(authUser: AuthUser): RequestHandler {
  return (req, _res, next) => {
    req.user = authUser;
    next();
  };
}

function makeApp(authUser: AuthUser, repository: AdminDailyProgressRepository, now = () => new Date("2026-09-11T15:00:00.000Z")) {
  const app = express();
  app.use(express.json());
  app.use("/admin", createAdminDailyProgressRouter(repository, authAs(authUser), now));
  return app;
}

function makeRepository(totalActiveUsers: number, registeredCount: number): AdminDailyProgressRepository {
  return {
    async getDailyProgress(dateKey) {
      return {
        dateKey,
        totalActiveUsers,
        registeredCount,
        pendingCount: totalActiveUsers - registeredCount,
        pendingUsers: Array.from({ length: totalActiveUsers - registeredCount }, (_, index) => ({
          id: `pending-${index + 1}`,
          legacyId: `pending-${index + 1}`,
          displayName: `Pendiente ${index + 1}`,
        })),
      };
    },
  };
}

describe("admin daily progress", () => {
  it("allows admins to inspect yesterday daily registration progress", async () => {
    const response = await request(makeApp(admin, makeRepository(13, 10))).get("/admin/daily-progress");

    assert.equal(response.status, 200);
    assert.equal(response.body.dateKey, "2026-09-10");
    assert.equal(response.body.totalActiveUsers, 13);
    assert.equal(response.body.registeredCount, 10);
    assert.equal(response.body.pendingCount, 3);
    assert.deepEqual(
      response.body.pendingUsers.map((pending: { displayName: string }) => pending.displayName),
      ["Pendiente 1", "Pendiente 2", "Pendiente 3"]
    );
  });

  it("uses the active user total returned by the repository without hardcoding group size", async () => {
    const addedUser = await request(makeApp(admin, makeRepository(14, 10))).get("/admin/daily-progress");
    const deactivatedUser = await request(makeApp(admin, makeRepository(12, 10))).get("/admin/daily-progress");
    const userRegistered = await request(makeApp(admin, makeRepository(13, 11))).get("/admin/daily-progress");

    assert.equal(addedUser.body.totalActiveUsers, 14);
    assert.equal(addedUser.body.pendingCount, 4);
    assert.equal(deactivatedUser.body.totalActiveUsers, 12);
    assert.equal(deactivatedUser.body.pendingCount, 2);
    assert.equal(userRegistered.body.registeredCount, 11);
    assert.equal(userRegistered.body.pendingCount, 2);
  });

  it("rejects regular users", async () => {
    let called = false;
    const repository: AdminDailyProgressRepository = {
      async getDailyProgress() {
        called = true;
        throw new Error("should not be called");
      },
    };

    const response = await request(makeApp(user, repository)).get("/admin/daily-progress");

    assert.equal(response.status, 403);
    assert.equal(called, false);
  });
});

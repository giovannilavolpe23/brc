import assert from "node:assert/strict";
import { describe, it } from "node:test";
import express, { type RequestHandler } from "express";
import request from "supertest";
import { createAchievementsRouter, createAdminAchievementsRouter } from "../src/achievements/routes";
import type { AchievementsRepository } from "../src/achievements/repository";
import type { AchievementUnlock, AdminAchievement } from "../src/achievements/types";
import type { AuthUser } from "../src/auth/types";

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

function unlock(overrides: Partial<AchievementUnlock> = {}): AchievementUnlock {
  return {
    key: "secret_no_sleep_required",
    type: "secret",
    name: "¿Dormir era obligatorio?",
    description: "Dormir menos de una hora en una noche",
    condition: "Sueño nocturno de una noche menor a 1 hora.",
    unlockedDate: "2026-08-28",
    isDuplicate: false,
    revealedAt: null,
    user: { id: jere.id, legacyId: jere.legacyId, displayName: jere.displayName },
    ...overrides,
  };
}

function adminAchievement(overrides: Partial<AdminAchievement> = {}): AdminAchievement {
  return {
    key: "secret_no_sleep_required",
    type: "secret",
    name: "¿Dormir era obligatorio?",
    description: "Dormir menos de una hora en una noche",
    condition: "Sueño nocturno de una noche menor a 1 hora.",
    status: "blocked",
    unlockedDate: null,
    isDuplicate: false,
    winners: [],
    ...overrides,
  };
}

function authAs(user: AuthUser): RequestHandler {
  return (req, _res, next) => {
    req.user = user;
    next();
  };
}

function makeApp(user: AuthUser, repository: AchievementsRepository) {
  const app = express();
  app.use(express.json());
  app.use("/achievements", createAchievementsRouter(repository, authAs(user)));
  app.use("/admin", createAdminAchievementsRouter(repository, authAs(user)));
  return app;
}

function secretSummary() {
  return { unlockedCount: 2, totalCount: 4 };
}

describe("achievement routes", () => {
  it("returns unique and secret achievements only for Gio", async () => {
    const repository: AchievementsRepository = {
      async listVisible(userId, canViewPrivate) {
        assert.equal(userId, gio.id);
        assert.equal(canViewPrivate, true);
        return [
          unlock({ type: "unique", key: "first_bottom", name: "Primero en tocar fondo", user: { id: jere.id, legacyId: jere.legacyId, displayName: jere.displayName } }),
          unlock({ key: "secret_no_sleep_required", type: "secret", user: { id: gio.id, legacyId: gio.legacyId, displayName: gio.displayName }, isDuplicate: true }),
        ];
      },
      async getSecretSummary() {
        return secretSummary();
      },
      async listPendingSecretReveals() {
        return [];
      },
      async markSecretRevealed() {
        return false;
      },
      async listAdmin() {
        return [];
      },
    };

    const response = await request(makeApp(gio, repository)).get("/achievements");

    assert.equal(response.status, 200);
    assert.equal(response.body.achievements.length, 2);
    assert.equal(response.body.achievements[0].type, "unique");
    assert.equal(response.body.achievements[1].type, "secret");
    assert.equal(response.body.achievements[1].isDuplicate, true);
    assert.deepEqual(response.body.secretSummary, secretSummary());
  });

  it("does not expose unique or secret achievements to regular users", async () => {
    const repository: AchievementsRepository = {
      async listVisible(_userId, canViewPrivate) {
        assert.equal(canViewPrivate, false);
        return [];
      },
      async getSecretSummary() {
        return secretSummary();
      },
      async listPendingSecretReveals() {
        return [unlock()];
      },
      async markSecretRevealed() {
        return false;
      },
      async listAdmin() {
        return [];
      },
    };

    const response = await request(makeApp(jere, repository)).get("/achievements");

    assert.equal(response.status, 200);
    assert.deepEqual(response.body.achievements, []);
    assert.deepEqual(response.body.secretSummary, secretSummary());
    assert.equal(JSON.stringify(response.body).includes("¿Dormir era obligatorio?"), false);
  });

  it("marks a secret reveal as viewed only for Gio", async () => {
    let marked = false;
    const repository: AchievementsRepository = {
      async listVisible() {
        return [];
      },
      async getSecretSummary() {
        return secretSummary();
      },
      async listPendingSecretReveals(userId, canViewPrivate) {
        assert.equal(userId, gio.id);
        assert.equal(canViewPrivate, true);
        return [unlock()];
      },
      async markSecretRevealed(userId, key) {
        assert.equal(userId, gio.id);
        assert.equal(key, "secret_no_sleep_required");
        marked = true;
        return true;
      },
      async listAdmin() {
        return [];
      },
    };

    const pending = await request(makeApp(gio, repository)).get("/achievements/secret-reveals");
    const response = await request(makeApp(gio, repository)).post("/achievements/secret_no_sleep_required/revealed");

    assert.equal(pending.status, 200);
    assert.equal(pending.body.achievements.length, 1);
    assert.equal(response.status, 200);
    assert.equal(marked, true);
  });

  it("does not reveal pending secrets for regular users or mark them viewed", async () => {
    let marked = false;
    const repository: AchievementsRepository = {
      async listVisible() {
        return [];
      },
      async getSecretSummary() {
        return secretSummary();
      },
      async listPendingSecretReveals(_userId, canViewPrivate) {
        assert.equal(canViewPrivate, false);
        return [];
      },
      async markSecretRevealed() {
        marked = true;
        return true;
      },
      async listAdmin() {
        return [];
      },
    };

    const pending = await request(makeApp(jere, repository)).get("/achievements/secret-reveals");
    const revealed = await request(makeApp(jere, repository)).post("/achievements/secret_no_sleep_required/revealed");

    assert.equal(pending.status, 200);
    assert.deepEqual(pending.body.achievements, []);
    assert.equal(revealed.status, 404);
    assert.equal(marked, false);
  });

  it("lets admins inspect blocked secret achievements", async () => {
    const repository: AchievementsRepository = {
      async listVisible() {
        return [];
      },
      async getSecretSummary() {
        return secretSummary();
      },
      async listPendingSecretReveals() {
        return [];
      },
      async markSecretRevealed() {
        return false;
      },
      async listAdmin() {
        return [adminAchievement()];
      },
    };

    const response = await request(makeApp(gio, repository)).get("/admin/achievements");

    assert.equal(response.status, 200);
    assert.equal(response.body.achievements[0].status, "blocked");
    assert.equal(response.body.achievements[0].condition.includes("menor a 1 hora"), true);
  });

  it("rejects non-admin users from admin achievement inspection", async () => {
    let called = false;
    const repository: AchievementsRepository = {
      async listVisible() {
        return [];
      },
      async getSecretSummary() {
        return secretSummary();
      },
      async listPendingSecretReveals() {
        return [];
      },
      async markSecretRevealed() {
        return false;
      },
      async listAdmin() {
        called = true;
        return [];
      },
    };

    const response = await request(makeApp(jere, repository)).get("/admin/achievements");

    assert.equal(response.status, 403);
    assert.equal(called, false);
  });
});

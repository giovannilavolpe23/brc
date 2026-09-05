import assert from "node:assert/strict";
import { describe, it } from "node:test";
import express, { type RequestHandler } from "express";
import request from "supertest";
import type { AuthUser } from "../src/auth/types";
import { createUsersRouter } from "../src/users/routes";
import type { AppearanceRepository } from "../src/users/appearance.repository";
import type { UserAppearance } from "../src/users/appearance";

const gio: AuthUser = {
  id: "11111111-1111-4111-8111-111111111111",
  legacyId: "gio",
  displayName: "Gio",
  role: "admin",
  permissions: [],
};

const marto: AuthUser = {
  id: "22222222-2222-4222-8222-222222222222",
  legacyId: "marto",
  displayName: "Marto",
  role: "user",
  permissions: [],
};

const aurora: UserAppearance = {
  preset: "aurora",
  primaryColor: "#4CC9F0",
  secondaryColor: "#7B61FF",
  gradientDirection: "135deg",
  intensity: "normal",
  visualStyle: "gradient",
  avatarBorderStyle: "gradient",
};

const custom: UserAppearance = {
  preset: "custom",
  primaryColor: "#123ABC",
  secondaryColor: "#C0FFEE",
  gradientDirection: "90deg",
  intensity: "soft",
  visualStyle: "glass",
  avatarBorderStyle: "solid",
};

function authAs(user: AuthUser): RequestHandler {
  return (req, _res, next) => {
    req.user = user;
    next();
  };
}

function makeRepository(initial: Record<string, UserAppearance | null> = {}) {
  const stored = new Map<string, UserAppearance | null>(Object.entries(initial));
  const writes: Array<{ userId: string; appearance: UserAppearance }> = [];
  const repository: AppearanceRepository = {
    async findByUserId(userId) {
      return stored.get(userId) ?? null;
    },
    async upsertForUser(userId, appearance) {
      writes.push({ userId, appearance });
      stored.set(userId, appearance);
      return appearance;
    },
    async deleteForUser(userId) {
      stored.set(userId, null);
    },
  };
  return { repository, writes };
}

function makeApp(user: AuthUser, repository: AppearanceRepository) {
  const app = express();
  app.use(express.json());
  app.use("/users", createUsersRouter(repository, authAs(user)));
  return app;
}

describe("users appearance routes", () => {
  it("returns null appearance for users without customization", async () => {
    const { repository } = makeRepository();

    const response = await request(makeApp(gio, repository)).get("/users/me/appearance");

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { appearance: null });
  });

  it("persists a valid preset appearance for the authenticated user", async () => {
    const { repository, writes } = makeRepository();

    const response = await request(makeApp(gio, repository)).put("/users/me/appearance").send(aurora);

    assert.equal(response.status, 200);
    assert.deepEqual(response.body.appearance, aurora);
    assert.deepEqual(writes, [{ userId: gio.id, appearance: aurora }]);
  });

  it("persists a valid custom appearance", async () => {
    const { repository } = makeRepository();

    const response = await request(makeApp(gio, repository)).put("/users/me/appearance").send(custom);

    assert.equal(response.status, 200);
    assert.deepEqual(response.body.appearance, custom);
  });

  it("ignores body user ids and only writes to the authenticated user", async () => {
    const { repository, writes } = makeRepository();

    const response = await request(makeApp(gio, repository))
      .put("/users/me/appearance")
      .send({ ...custom, userId: marto.id });

    assert.equal(response.status, 200);
    assert.equal(writes[0].userId, gio.id);
  });

  it("rejects attempts to update another user appearance", async () => {
    const { repository, writes } = makeRepository();

    const response = await request(makeApp(gio, repository)).put(`/users/${marto.id}/appearance`).send(aurora);

    assert.equal(response.status, 403);
    assert.deepEqual(response.body, { error: "forbidden" });
    assert.deepEqual(writes, []);
  });

  it("rejects invalid hex colors", async () => {
    const { repository } = makeRepository();

    const response = await request(makeApp(gio, repository))
      .put("/users/me/appearance")
      .send({ ...custom, primaryColor: "blue" });

    assert.equal(response.status, 400);
    assert.deepEqual(response.body, { error: "invalid_primary_color" });
  });

  it("rejects invalid enum values", async () => {
    const { repository } = makeRepository();

    const response = await request(makeApp(gio, repository))
      .put("/users/me/appearance")
      .send({ ...custom, intensity: "extreme" });

    assert.equal(response.status, 400);
    assert.deepEqual(response.body, { error: "invalid_intensity" });
  });

  it("resets the authenticated user appearance to default", async () => {
    const { repository } = makeRepository({ [gio.id]: aurora });

    const reset = await request(makeApp(gio, repository)).delete("/users/me/appearance");
    const reloaded = await request(makeApp(gio, repository)).get("/users/me/appearance");

    assert.equal(reset.status, 204);
    assert.deepEqual(reloaded.body, { appearance: null });
  });
});

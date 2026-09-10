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
  kingPhrase: null,
};

const custom: UserAppearance = {
  preset: "custom",
  primaryColor: "#123ABC",
  secondaryColor: "#C0FFEE",
  gradientDirection: "90deg",
  intensity: "soft",
  visualStyle: "glass",
  avatarBorderStyle: "solid",
  kingPhrase: "Ja, pedazos de bots",
};

const royalGold: UserAppearance = {
  preset: "royal_gold",
  primaryColor: "#08111F",
  secondaryColor: "#D6B25E",
  gradientDirection: "135deg",
  intensity: "normal",
  visualStyle: "royal",
  avatarBorderStyle: "gold",
  kingPhrase: null,
  premiumGlow: "soft",
  premiumShadow: "deep",
  premiumBorder: "gold",
  premiumIntensity: "bright",
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

  it("allows Gio to persist exclusive premium appearance options", async () => {
    const { repository, writes } = makeRepository();

    const response = await request(makeApp(gio, repository)).put("/users/me/appearance").send(royalGold);

    assert.equal(response.status, 200);
    assert.deepEqual(response.body.appearance, royalGold);
    assert.deepEqual(writes, [{ userId: gio.id, appearance: royalGold }]);
  });

  it("rejects exclusive premium appearance options for other users", async () => {
    const { repository, writes } = makeRepository();

    const response = await request(makeApp(marto, repository)).put("/users/me/appearance").send(royalGold);

    assert.equal(response.status, 400);
    assert.deepEqual(response.body, { error: "gio_appearance_only" });
    assert.deepEqual(writes, []);
  });

  it("validates king phrases while allowing emojis and clearing empty phrases", async () => {
    const { repository } = makeRepository();

    const tooShort = await request(makeApp(gio, repository)).put("/users/me/appearance").send({ ...custom, kingPhrase: "ab" });
    const spaces = await request(makeApp(gio, repository)).put("/users/me/appearance").send({ ...custom, kingPhrase: "   " });
    const eightyChars = await request(makeApp(gio, repository))
      .put("/users/me/appearance")
      .send({ ...custom, kingPhrase: "a".repeat(80) });
    const tooLong = await request(makeApp(gio, repository))
      .put("/users/me/appearance")
      .send({ ...custom, kingPhrase: "a".repeat(81) });
    const emoji = await request(makeApp(gio, repository)).put("/users/me/appearance").send({ ...custom, kingPhrase: "Rey helado 🧊" });
    const htmlText = await request(makeApp(gio, repository)).put("/users/me/appearance").send({ ...custom, kingPhrase: "<b>Rey</b>" });
    const cleared = await request(makeApp(gio, repository)).put("/users/me/appearance").send({ ...custom, kingPhrase: "" });

    assert.equal(tooShort.status, 400);
    assert.equal(tooShort.body.error, "king_phrase_too_short");
    assert.equal(spaces.status, 400);
    assert.equal(spaces.body.error, "invalid_king_phrase");
    assert.equal(eightyChars.status, 200);
    assert.equal(eightyChars.body.appearance.kingPhrase.length, 80);
    assert.equal(tooLong.status, 400);
    assert.equal(tooLong.body.error, "king_phrase_too_long");
    assert.equal(emoji.status, 200);
    assert.equal(emoji.body.appearance.kingPhrase, "Rey helado 🧊");
    assert.equal(htmlText.status, 200);
    assert.equal(htmlText.body.appearance.kingPhrase, "<b>Rey</b>");
    assert.equal(cleared.status, 200);
    assert.equal(cleared.body.appearance.kingPhrase, null);
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

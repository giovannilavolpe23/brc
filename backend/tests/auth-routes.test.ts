import assert from "node:assert/strict";
import { describe, it } from "node:test";
import express from "express";
import request from "supertest";
import { createAuthRouter } from "../src/auth/routes";
import { hashPassword } from "../src/auth/password";
import type { UserCredentials } from "../src/auth/types";

async function makeApp() {
  const passwordHash = await hashPassword("correct-password");
  const user: UserCredentials = {
    id: "11111111-1111-4111-8111-111111111111",
    legacyId: "gio",
    displayName: "Gio",
    role: "admin",
    permissions: [],
    passwordHash,
  };

  const app = express();
  app.use(express.json());
  app.use(
    "/auth",
    createAuthRouter(async (legacyId) => {
      return legacyId === "gio" ? user : null;
    })
  );
  return app;
}

describe("auth routes", () => {
  it("logs in with valid credentials and returns a bearer token without exposing password hashes", async () => {
    const app = await makeApp();

    const response = await request(app).post("/auth/login").send({
      username: "Gio",
      password: "correct-password",
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers["set-cookie"], undefined);
    assert.equal(typeof response.body.accessToken, "string");
    assert.equal(response.body.user.legacyId, "gio");
    assert.equal(response.body.user.role, "admin");
    assert.equal(response.body.user.passwordHash, undefined);
  });

  it("rejects invalid credentials with a generic error", async () => {
    const app = await makeApp();

    const response = await request(app).post("/auth/login").send({
      username: "gio",
      password: "wrong-password",
    });

    assert.equal(response.status, 401);
    assert.deepEqual(response.body, { error: "invalid_credentials" });
    assert.equal(response.headers["set-cookie"], undefined);
  });

  it("keeps logout stateless and does not set cookies", async () => {
    const app = await makeApp();

    const response = await request(app).post("/auth/logout").send();

    assert.equal(response.status, 204);
    assert.equal(response.headers["set-cookie"], undefined);
  });
});

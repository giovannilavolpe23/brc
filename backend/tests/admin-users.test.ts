import assert from "node:assert/strict";
import { describe, it } from "node:test";
import express, { type RequestHandler } from "express";
import request from "supertest";
import { AdminUserValidationError, createAdminUsersRouter, type AdminUsersRepository } from "../src/admin/users";
import { createAuthRouter } from "../src/auth/routes";
import { hashPassword, verifyPassword } from "../src/auth/password";
import type { AuthUser, UserCredentials } from "../src/auth/types";

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

function makeRepository(): AdminUsersRepository & { credentials: Map<string, UserCredentials> } {
  const credentials = new Map<string, UserCredentials>();
  const displayNames = new Set<string>();
  const activeUsers = new Map<string, { legacyId: string; original?: boolean }>([
    [admin.id, { legacyId: admin.legacyId, original: true }],
    [admin.legacyId, { legacyId: admin.legacyId, original: true }],
  ]);

  return {
    credentials,
    async createUser(input) {
      const normalizedName = input.displayName.toLowerCase();
      if (displayNames.has(normalizedName)) {
        throw new AdminUserValidationError("user_already_exists");
      }
      displayNames.add(normalizedName);

      const legacyId = input.displayName
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      const created: UserCredentials = {
        id: "33333333-3333-4333-8333-333333333333",
        legacyId,
        displayName: input.displayName,
        role: "user",
        permissions: [],
        passwordHash: await hashPassword(input.password),
      };
      credentials.set(created.legacyId, created);
      activeUsers.set(created.id, { legacyId: created.legacyId });
      activeUsers.set(created.legacyId, { legacyId: created.legacyId });
      return created;
    },
    async deactivateUser(identifier) {
      const found = activeUsers.get(identifier);
      if (!found) return "not_found";
      if (found.original) return "protected";
      activeUsers.delete(identifier);
      activeUsers.delete(found.legacyId);
      return "deactivated";
    },
  };
}

function makeAdminApp(authUser: AuthUser, repository: AdminUsersRepository) {
  const app = express();
  app.use(express.json());
  app.use("/admin", createAdminUsersRouter(repository, authAs(authUser)));
  return app;
}

describe("admin user creation", () => {
  it("lets an admin create a user with a generated UUID-shaped id, user role, and hashed password", async () => {
    const repository = makeRepository();

    const response = await request(makeAdminApp(admin, repository)).post("/admin/users").send({
      name: "Nuevo Jugador",
      password: "secret-pass",
    });

    assert.equal(response.status, 201);
    assert.match(response.body.user.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    assert.equal(response.body.user.legacyId, "nuevo-jugador");
    assert.equal(response.body.user.displayName, "Nuevo Jugador");
    assert.equal(response.body.user.role, "user");
    assert.deepEqual(response.body.user.permissions, []);
    assert.equal(response.body.user.passwordHash, undefined);

    const credentials = repository.credentials.get("nuevo-jugador");
    assert.ok(credentials);
    assert.notEqual(credentials.passwordHash, "secret-pass");
    assert.equal(await verifyPassword("secret-pass", credentials.passwordHash), true);
  });

  it("rejects regular users", async () => {
    const response = await request(makeAdminApp(user, makeRepository())).post("/admin/users").send({
      name: "Nuevo Jugador",
      password: "secret-pass",
    });

    assert.equal(response.status, 403);
  });

  it("rejects invalid names before creating credentials", async () => {
    const repository = makeRepository();
    const response = await request(makeAdminApp(admin, repository)).post("/admin/users").send({
      name: "   ",
      password: "secret-pass",
    });

    assert.equal(response.status, 400);
    assert.equal(repository.credentials.size, 0);
  });

  it("rejects duplicate users safely", async () => {
    const repository = makeRepository();
    await request(makeAdminApp(admin, repository)).post("/admin/users").send({
      name: "Nuevo Jugador",
      password: "secret-pass",
    });
    const response = await request(makeAdminApp(admin, repository)).post("/admin/users").send({
      name: "nuevo jugador",
      password: "other-pass",
    });

    assert.equal(response.status, 400);
    assert.deepEqual(response.body, { error: "user_already_exists" });
    assert.equal(JSON.stringify(response.body).includes("other-pass"), false);
  });

  it("allows a newly created user to log in through the auth router", async () => {
    const repository = makeRepository();
    await request(makeAdminApp(admin, repository)).post("/admin/users").send({
      name: "Api Nuevo",
      password: "secret-pass",
    });

    const app = express();
    app.use(express.json());
    app.use("/auth", createAuthRouter(async (legacyId) => repository.credentials.get(legacyId) ?? null));

    const response = await request(app).post("/auth/login").send({
      username: "api-nuevo",
      password: "secret-pass",
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.user.legacyId, "api-nuevo");
    assert.equal(typeof response.body.accessToken, "string");
  });

  it("lets an admin deactivate a dynamic user without deleting original users", async () => {
    const repository = makeRepository();
    await request(makeAdminApp(admin, repository)).post("/admin/users").send({
      name: "Borrable",
      password: "secret-pass",
    });

    const dynamic = await request(makeAdminApp(admin, repository)).delete("/admin/users/borrable");
    const original = await request(makeAdminApp(admin, repository)).delete(`/admin/users/${admin.legacyId}`);

    assert.equal(dynamic.status, 204);
    assert.equal(original.status, 400);
    assert.deepEqual(original.body, { error: "protected_original_user" });
  });

  it("rejects regular users when deleting players", async () => {
    const response = await request(makeAdminApp(user, makeRepository())).delete("/admin/users/someone");

    assert.equal(response.status, 403);
  });
});

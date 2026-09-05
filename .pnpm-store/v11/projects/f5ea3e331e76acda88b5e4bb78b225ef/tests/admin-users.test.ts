import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import express, { type RequestHandler } from "express";
import request from "supertest";
import { AdminUserValidationError, createAdminUsersRouter, createUserWithClient, type AdminUsersRepository } from "../src/admin/users";
import { createRequireAuth } from "../src/auth/middleware";
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

type FakeDbUser = {
  id: string;
  legacyId: string;
  displayName: string;
  passwordHash: string;
  roleId: string;
  isActive: boolean;
  createdAt: string;
};

function makePostgresLikeClient(initialUsers: FakeDbUser[] = []) {
  const users = initialUsers.map((item) => ({ ...item }));
  const queries: string[] = [];
  const client = {
    async query(sql: string, params: unknown[] = []) {
      queries.push(sql);

      if (sql.includes("pg_advisory_xact_lock")) return { rows: [] };

      if (sql.includes("select id from users") && sql.includes("is_active = true")) {
        const displayName = String(params[0]).toLowerCase();
        return { rows: users.filter((user) => user.isActive && user.displayName.toLowerCase() === displayName).map((user) => ({ id: user.id })) };
      }

      if (sql.includes("select id from roles")) return { rows: [{ id: "role-user" }] };

      if (sql.includes("with inactive_user")) {
        const displayName = String(params[0]);
        const passwordHash = String(params[1]);
        const roleId = String(params[2]);
        const baseLegacyId = String(params[3]);
        const reserved = new Set(params[4] as string[]);
        const inactive = users
          .filter(
            (user) =>
              !user.isActive &&
              (user.displayName.toLowerCase() === displayName.toLowerCase() || user.legacyId === baseLegacyId) &&
              !reserved.has(user.legacyId)
          )
          .sort((a, b) => {
            const legacyDelta = Number(a.legacyId !== baseLegacyId) - Number(b.legacyId !== baseLegacyId);
            return legacyDelta || a.createdAt.localeCompare(b.createdAt);
          })[0];
        if (!inactive) return { rows: [] };

        inactive.displayName = displayName;
        inactive.passwordHash = passwordHash;
        inactive.roleId = roleId;
        inactive.isActive = true;
        return { rows: [{ id: inactive.id, legacy_id: inactive.legacyId, display_name: inactive.displayName, role_key: "user" }] };
      }

      if (sql.includes("select legacy_id from users")) {
        const base = String(params[0]);
        return { rows: users.filter((user) => user.legacyId === base || user.legacyId.startsWith(`${base}-`)).map((user) => ({ legacy_id: user.legacyId })) };
      }

      if (sql.includes("insert into users")) {
        const legacyId = String(params[0]);
        if (users.some((user) => user.legacyId === legacyId)) {
          const error = new Error("duplicate key");
          (error as { code?: string }).code = "23505";
          throw error;
        }
        const user = {
          id: "44444444-4444-4444-8444-444444444444",
          legacyId,
          displayName: String(params[1]),
          passwordHash: String(params[2]),
          roleId: String(params[3]),
          isActive: true,
          createdAt: "2026-08-31T00:00:00.000Z",
        };
        users.push(user);
        return { rows: [{ id: user.id, legacy_id: user.legacyId, display_name: user.displayName, role_key: "user" }] };
      }

      throw new Error(`Unexpected query: ${sql}`);
    },
  };

  return { client: client as Pick<import("pg").PoolClient, "query">, queries, users };
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

  it("creates Lara even when her profile image already exists", async () => {
    assert.equal(fs.existsSync(path.resolve(process.cwd(), "../images/Lara.jpeg")), true);
    const db = makePostgresLikeClient();

    const created = await createUserWithClient(db.client, { displayName: "Lara", password: "secret-pass" }, async () => "hashed-secret");

    assert.equal(created.displayName, "Lara");
    assert.equal(created.legacyId, "lara");
    assert.equal(db.users.find((item) => item.legacyId === "lara")?.isActive, true);
    assert.equal(db.queries.some((sql) => sql.includes("images") || sql.includes("PLAYER_PROFILE_IMAGES")), false);
  });

  it("reactivates an inactive Lara instead of reporting a duplicate", async () => {
    const db = makePostgresLikeClient([
      {
        id: "55555555-5555-4555-8555-555555555555",
        legacyId: "lara",
        displayName: "Lara",
        passwordHash: "old-hash",
        roleId: "role-user",
        isActive: false,
        createdAt: "2026-08-01T00:00:00.000Z",
      },
    ]);

    const created = await createUserWithClient(db.client, { displayName: "Lara", password: "secret-pass" }, async () => "new-hash");

    assert.equal(created.id, "55555555-5555-4555-8555-555555555555");
    assert.equal(created.legacyId, "lara");
    assert.equal(created.displayName, "Lara");
    assert.equal(db.users.length, 1);
    assert.equal(db.users[0].isActive, true);
    assert.equal(db.users[0].passwordHash, "new-hash");
  });

  it("reactivates an inactive Lara legacy identity even if the residual display name differs", async () => {
    const db = makePostgresLikeClient([
      {
        id: "66666666-6666-4666-8666-666666666666",
        legacyId: "lara",
        displayName: "Lara Prueba",
        passwordHash: "old-hash",
        roleId: "role-user",
        isActive: false,
        createdAt: "2026-08-01T00:00:00.000Z",
      },
    ]);

    const created = await createUserWithClient(db.client, { displayName: "Lara", password: "secret-pass" }, async () => "new-hash");

    assert.equal(created.id, "66666666-6666-4666-8666-666666666666");
    assert.equal(created.legacyId, "lara");
    assert.equal(created.displayName, "Lara");
    assert.equal(db.users.length, 1);
    assert.equal(db.users[0].displayName, "Lara");
    assert.equal(db.users[0].isActive, true);
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

  it("lets a newly created user call protected routes with the returned bearer token", async () => {
    const repository = makeRepository();
    await request(makeAdminApp(admin, repository)).post("/admin/users").send({
      name: "Api Protegido",
      password: "secret-pass",
    });

    const app = express();
    app.use(express.json());
    app.use("/auth", createAuthRouter(async (legacyId) => repository.credentials.get(legacyId) ?? null));
    app.get(
      "/protected/me",
      createRequireAuth(async (id) => Array.from(repository.credentials.values()).find((credential) => credential.id === id) ?? null),
      (req, res) => {
        res.json({ userId: req.user.id, legacyId: req.user.legacyId });
      }
    );

    const login = await request(app).post("/auth/login").send({
      username: "api-protegido",
      password: "secret-pass",
    });
    const response = await request(app).get("/protected/me").set("Authorization", `Bearer ${login.body.accessToken}`);

    assert.equal(response.status, 200);
    assert.equal(response.body.legacyId, "api-protegido");
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

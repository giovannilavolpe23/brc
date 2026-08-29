import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { NextFunction, Request, Response } from "express";
import { createRequireAuth, hasPermission, requirePermission, requireRole } from "../src/auth/middleware";
import { AUTH_COOKIE_NAME, signAuthToken } from "../src/auth/token";
import type { AuthUser } from "../src/auth/types";

function makeUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    legacyId: "gio",
    displayName: "Gio",
    role: "admin",
    permissions: [],
    ...overrides,
  };
}

function mockResponse(): Response & { statusCodeValue?: number; body?: unknown } {
  const res = {
    status(code: number) {
      this.statusCodeValue = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
  return res as Response & { statusCodeValue?: number; body?: unknown };
}

describe("auth middleware", () => {
  it("loads a fresh user from the database layer for authenticated requests", async () => {
    const user = makeUser({ displayName: "Fresh Gio" });
    const req = { cookies: { [AUTH_COOKIE_NAME]: signAuthToken(user) } } as Request;
    const res = mockResponse();
    let nextCalled = false;
    const next: NextFunction = () => {
      nextCalled = true;
    };

    const middleware = createRequireAuth(async (id) => {
      assert.equal(id, user.id);
      return user;
    });

    await middleware(req, res, next);

    assert.equal(nextCalled, true);
    assert.equal(req.user.displayName, "Fresh Gio");
  });

  it("rejects missing auth cookies", async () => {
    const req = { cookies: {} } as Request;
    const res = mockResponse();

    await createRequireAuth(async () => null)(req, res, (() => undefined) as NextFunction);

    assert.equal(res.statusCodeValue, 401);
    assert.deepEqual(res.body, { error: "unauthorized" });
  });
});

describe("authorization middleware", () => {
  it("checks roles", () => {
    const req = { user: makeUser({ role: "user" }) } as Request;
    const res = mockResponse();

    requireRole("admin")(req, res, (() => undefined) as NextFunction);

    assert.equal(res.statusCodeValue, 403);
    assert.deepEqual(res.body, { error: "forbidden" });
  });

  it("lets admins pass permission checks and supports explicit user permissions", () => {
    assert.equal(hasPermission(makeUser({ role: "admin", permissions: [] }), "create_previa"), true);
    assert.equal(hasPermission(makeUser({ role: "user", permissions: ["create_previa"] }), "create_previa"), true);
    assert.equal(hasPermission(makeUser({ role: "user", permissions: [] }), "create_previa"), false);

    const req = { user: makeUser({ role: "user", permissions: [] }) } as Request;
    const res = mockResponse();
    requirePermission("create_previa")(req, res, (() => undefined) as NextFunction);

    assert.equal(res.statusCodeValue, 403);
  });
});

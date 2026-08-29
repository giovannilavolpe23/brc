import assert from "node:assert/strict";
import { describe, it } from "node:test";
import jwt from "jsonwebtoken";
import { AUTH_COOKIE_NAME, AUTH_TOKEN_TTL_SECONDS, signAuthToken, verifyAuthToken } from "../src/auth/token";
import type { AuthUser } from "../src/auth/types";

const user: AuthUser = {
  id: "11111111-1111-4111-8111-111111111111",
  legacyId: "gio",
  displayName: "Gio",
  role: "admin",
  permissions: [],
};

describe("auth tokens", () => {
  it("uses the access token cookie and a 24 hour lifetime", () => {
    assert.equal(AUTH_COOKIE_NAME, "access_token");
    assert.equal(AUTH_TOKEN_TTL_SECONDS, 24 * 60 * 60);
  });

  it("signs and verifies a token with the user id as subject", () => {
    const token = signAuthToken(user);
    const decoded = jwt.decode(token);

    assert.equal(typeof token, "string");
    assert.equal(verifyAuthToken(token).sub, user.id);
    assert.equal(typeof decoded, "object");
    assert.equal((decoded as jwt.JwtPayload).sub, user.id);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hashPassword, verifyPassword } from "../src/auth/password";

describe("password hashing", () => {
  it("hashes passwords with bcrypt and verifies them", async () => {
    const hash = await hashPassword("sample-password");

    assert.match(hash, /^\$2[aby]\$12\$/);
    assert.equal(await verifyPassword("sample-password", hash), true);
    assert.equal(await verifyPassword("wrong-password", hash), false);
  });
});

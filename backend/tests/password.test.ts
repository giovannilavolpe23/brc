import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { hashPassword, verifyPassword } from "../src/auth/password";

describe("password hashing", () => {
  it("hashes passwords with bcrypt and verifies them", async () => {
    const hash = await hashPassword("sample-password");

    assert.match(hash, /^\$2[aby]\$12\$/);
    assert.equal(await verifyPassword("sample-password", hash), true);
    assert.equal(await verifyPassword("wrong-password", hash), false);
  });

  it("keeps Gio's seeded password rotated", async () => {
    const seedPath = path.resolve(__dirname, "../src/db/seed.ts");
    const seedFile = fs.readFileSync(seedPath, "utf8");
    const match = seedFile.match(/legacyId: "gio"[\s\S]*?passwordHash: "([^"]+)"/);

    assert.ok(match);
    assert.equal(await verifyPassword("777", match[1]), true);
    assert.equal(await verifyPassword("77", match[1]), false);
  });
});

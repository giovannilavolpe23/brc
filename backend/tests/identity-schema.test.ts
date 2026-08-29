import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import path from "node:path";

const migration = fs.readFileSync(path.resolve(__dirname, "../migrations/001_identity.sql"), "utf8");
const seed = fs.readFileSync(path.resolve(__dirname, "../src/db/seed.ts"), "utf8");

describe("identity schema", () => {
  it("creates the minimum identity tables", () => {
    for (const table of ["roles", "permissions", "users", "user_permissions"]) {
      assert.match(migration, new RegExp(`create table if not exists ${table}`));
    }
  });

  it("enforces core uniqueness and password hash constraints", () => {
    assert.match(migration, /key text not null unique/);
    assert.match(migration, /legacy_id text not null unique/);
    assert.match(migration, /primary key \(user_id, permission_id\)/);
    assert.match(migration, /users_password_hash_bcrypt/);
  });
});

describe("identity seed", () => {
  it("contains the current users, roles, and create_previa permission", () => {
    for (const legacyId of ["gio", "marto", "sebas", "ger", "nerea", "simon", "agus", "nata", "barua", "jere", "tobi"]) {
      assert.match(seed, new RegExp(`legacyId: "${legacyId}"`));
    }

    assert.match(seed, /key: "admin"/);
    assert.match(seed, /key: "user"/);
    assert.match(seed, /key: "create_previa"/);
    assert.match(seed, /legacyId: "gio", displayName: "Gio", roleKey: "admin"/);
    assert.match(seed, /legacyId: "jere", displayName: "Jere", roleKey: "user".*permissions: \["create_previa"\]/);
  });

  it("does not include the known plain-text frontend passwords", () => {
    for (const password of ["lv", "ze", "do", "te", "ri", "da", "ju", "ch", "ba", "so", "ma"]) {
      assert.doesNotMatch(seed, new RegExp(`password: "${password}"`));
    }
  });
});

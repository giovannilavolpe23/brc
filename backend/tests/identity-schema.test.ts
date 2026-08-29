import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import path from "node:path";

const migration = fs.readFileSync(path.resolve(__dirname, "../migrations/001_identity.sql"), "utf8");
const moneyMigration = fs.readFileSync(path.resolve(__dirname, "../migrations/002_money.sql"), "utf8");
const dailyMigration = fs.readFileSync(path.resolve(__dirname, "../migrations/003_daily_entries_and_surveys.sql"), "utf8");
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

describe("money schema", () => {
  it("creates initial balances and money movements", () => {
    assert.match(moneyMigration, /create table if not exists initial_balances/);
    assert.match(moneyMigration, /user_id uuid primary key references users\(id\) on delete cascade/);
    assert.match(moneyMigration, /create table if not exists money_movements/);
    assert.match(moneyMigration, /user_id uuid not null references users\(id\) on delete cascade/);
  });

  it("enforces integer amounts and valid movement categories", () => {
    assert.match(moneyMigration, /amount_pesos integer not null/);
    assert.match(moneyMigration, /initial_balances_amount_non_negative/);
    assert.match(moneyMigration, /money_movements_amount_positive/);
    assert.match(moneyMigration, /type in \('expense', 'income'\)/);
    assert.match(moneyMigration, /type = 'income' and category is null/);
    assert.match(moneyMigration, /'Chocolates'/);
    assert.doesNotMatch(moneyMigration, /'Transporte'/);
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

describe("daily entries and surveys schema", () => {
  it("creates daily entries with one entry per user and date", () => {
    assert.match(dailyMigration, /create table if not exists daily_entries/);
    assert.match(dailyMigration, /user_id uuid not null references users\(id\) on delete cascade/);
    assert.match(dailyMigration, /date_key date not null/);
    assert.match(dailyMigration, /unique \(user_id, date_key\)/);
  });

  it("stores only original daily entry fields", () => {
    for (const column of [
      "sleep_did_not_sleep",
      "sleep_bedtime",
      "sleep_wake",
      "nap_start",
      "nap_end",
      "fifth_meal",
      "bathroom_count",
      "boliche_did_not_go",
      "boliche_exit_time",
    ]) {
      assert.match(dailyMigration, new RegExp(column));
    }

    assert.doesNotMatch(dailyMigration, /computed/i);
    assert.doesNotMatch(dailyMigration, /sleep_minutes/i);
    assert.doesNotMatch(dailyMigration, /total_sleep_minutes/i);
  });

  it("creates survey questions and historical votes", () => {
    assert.match(dailyMigration, /create table if not exists survey_questions/);
    assert.match(dailyMigration, /create table if not exists survey_votes/);
    assert.match(dailyMigration, /unique \(survey_question_id, date_key, voter_user_id\)/);
    assert.match(dailyMigration, /survey_votes_no_self_vote/);
    assert.match(dailyMigration, /'destroyed_vote'/);
  });
});

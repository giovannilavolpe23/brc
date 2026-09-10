import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import path from "node:path";

const migration = fs.readFileSync(path.resolve(__dirname, "../migrations/001_identity.sql"), "utf8");
const moneyMigration = fs.readFileSync(path.resolve(__dirname, "../migrations/002_money.sql"), "utf8");
const dailyMigration = fs.readFileSync(path.resolve(__dirname, "../migrations/003_daily_entries_and_surveys.sql"), "utf8");
const previasMigration = fs.readFileSync(path.resolve(__dirname, "../migrations/004_previas.sql"), "utf8");
const userManagementMigration = fs.readFileSync(path.resolve(__dirname, "../migrations/006_user_management.sql"), "utf8");
const pushMigration = fs.readFileSync(path.resolve(__dirname, "../migrations/008_push_notifications.sql"), "utf8");
const kingPhraseMigration = fs.readFileSync(path.resolve(__dirname, "../migrations/009_user_king_phrase.sql"), "utf8");
const demoFlagsMigration = fs.readFileSync(path.resolve(__dirname, "../migrations/010_demo_data_flags.sql"), "utf8");
const dailySurveyQuestionsMigration = fs.readFileSync(path.resolve(__dirname, "../migrations/011_add_daily_survey_questions.sql"), "utf8");
const achievementsMigration = fs.readFileSync(path.resolve(__dirname, "../migrations/012_persistent_achievements.sql"), "utf8");
const gioPremiumAppearanceMigration = fs.readFileSync(path.resolve(__dirname, "../migrations/013_gio_premium_appearance.sql"), "utf8");
const gioMotionAppearanceMigration = fs.readFileSync(path.resolve(__dirname, "../migrations/014_gio_motion_appearance.sql"), "utf8");
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

  it("indexes active display names for duplicate checks", () => {
    assert.match(userManagementMigration, /index if not exists users_active_display_name_lookup_idx/);
    assert.match(userManagementMigration, /lower\(display_name\)/);
    assert.match(userManagementMigration, /where is_active = true/);
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

describe("money movement legacy id schema", () => {
  const legacyMigration = fs.readFileSync(path.resolve(__dirname, "../migrations/005_money_movement_legacy_ids.sql"), "utf8");

  it("adds an optional per-user legacy id for idempotent frontend sync", () => {
    assert.match(legacyMigration, /add column if not exists legacy_id text/);
    assert.match(legacyMigration, /money_movements_user_id_legacy_id_idx/);
    assert.match(legacyMigration, /where legacy_id is not null/);
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

  it("seeds all daily surveys", () => {
    assert.match(seed, /key: "destroyed_vote"/);
    assert.match(seed, /key: "most_flirty"/);
    assert.match(seed, /key: "best_outfit"/);
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

  it("adds the chamuyo and outfit survey questions", () => {
    assert.match(dailySurveyQuestionsMigration, /'most_flirty'/);
    assert.match(dailySurveyQuestionsMigration, /'best_outfit'/);
    assert.match(dailySurveyQuestionsMigration, /¿Quién fue el más chamullero anoche\?/);
    assert.match(dailySurveyQuestionsMigration, /¿Quién tuvo el mejor outfit anoche\?/);
  });
});

describe("previas schema", () => {
  it("creates previas, products, and participants", () => {
    assert.match(previasMigration, /create table if not exists previas/);
    assert.match(previasMigration, /create table if not exists previa_products/);
    assert.match(previasMigration, /create table if not exists previa_participants/);
    assert.match(previasMigration, /legacy_id text not null unique/);
    assert.match(previasMigration, /creator_user_id uuid not null references users\(id\) on delete restrict/);
    assert.match(previasMigration, /primary key \(previa_id, user_id\)/);
  });

  it("enforces positive integer money and quantities", () => {
    assert.match(previasMigration, /total_amount_pesos integer not null/);
    assert.match(previasMigration, /amount_per_participant_pesos integer not null/);
    assert.match(previasMigration, /unit_price_pesos integer not null/);
    assert.match(previasMigration, /quantity integer not null/);
    assert.match(previasMigration, /previas_total_amount_positive/);
    assert.match(previasMigration, /previa_products_unit_price_positive/);
    assert.match(previasMigration, /previa_products_quantity_positive/);
  });
});

describe("push notification schema", () => {
  it("creates subscriptions and idempotency tables for reminders and stats-ready pushes", () => {
    assert.match(pushMigration, /create table if not exists push_subscriptions/);
    assert.match(pushMigration, /user_id uuid not null references users\(id\) on delete cascade/);
    assert.match(pushMigration, /endpoint text not null unique/);
    assert.match(pushMigration, /create table if not exists push_daily_reminders/);
    assert.match(pushMigration, /primary key \(date_key, user_id\)/);
    assert.match(pushMigration, /create table if not exists push_stats_ready_notifications/);
    assert.match(pushMigration, /date_key date primary key/);
  });
});

describe("king phrase schema", () => {
  it("adds a bounded optional king phrase to user appearances", () => {
    assert.match(kingPhraseMigration, /add column if not exists king_phrase text/);
    assert.match(kingPhraseMigration, /user_appearances_king_phrase_check/);
    assert.match(kingPhraseMigration, /length\(king_phrase\) between 3 and 80/);
  });
});

describe("gio premium appearance schema", () => {
  it("adds bounded premium fields to user appearances", () => {
    assert.match(gioPremiumAppearanceMigration, /add column if not exists premium_glow text/);
    assert.match(gioPremiumAppearanceMigration, /add column if not exists premium_shadow text/);
    assert.match(gioPremiumAppearanceMigration, /add column if not exists premium_border text/);
    assert.match(gioPremiumAppearanceMigration, /add column if not exists premium_intensity text/);
    assert.match(gioPremiumAppearanceMigration, /'royal_gold'/);
    assert.match(gioPremiumAppearanceMigration, /'golden_power'/);
    assert.match(gioPremiumAppearanceMigration, /premium_glow in \('off', 'soft', 'strong'\)/);
  });
});

describe("gio motion appearance schema", () => {
  it("adds bounded motion controls and stronger premium presets", () => {
    assert.match(gioMotionAppearanceMigration, /add column if not exists premium_motion text/);
    assert.match(gioMotionAppearanceMigration, /add column if not exists premium_border_animation text/);
    assert.match(gioMotionAppearanceMigration, /add column if not exists premium_shimmer text/);
    assert.match(gioMotionAppearanceMigration, /'royal_motion'/);
    assert.match(gioMotionAppearanceMigration, /'aurora_power'/);
    assert.match(gioMotionAppearanceMigration, /'golden_crown'/);
    assert.match(gioMotionAppearanceMigration, /'energy'/);
    assert.match(gioMotionAppearanceMigration, /premium_motion in \('off', 'soft', 'intense'\)/);
    assert.match(gioMotionAppearanceMigration, /premium_border_animation in \('solid', 'gradient', 'animated'\)/);
    assert.match(gioMotionAppearanceMigration, /premium_shimmer in \('off', 'subtle'\)/);
  });
});

describe("demo data flags schema", () => {
  it("marks simulated rows without changing identity tables", () => {
    assert.match(demoFlagsMigration, /alter table money_movements\s+add column if not exists is_demo boolean not null default false/);
    assert.match(demoFlagsMigration, /alter table daily_entries\s+add column if not exists is_demo boolean not null default false/);
    assert.match(demoFlagsMigration, /alter table survey_votes\s+add column if not exists is_demo boolean not null default false/);
    assert.match(demoFlagsMigration, /alter table previas\s+add column if not exists is_demo boolean not null default false/);
  });
});

describe("persistent achievements schema", () => {
  it("stores permanent resolutions and per-user unlocks idempotently", () => {
    assert.match(achievementsMigration, /create table if not exists achievement_resolutions/);
    assert.match(achievementsMigration, /achievement_key text primary key/);
    assert.match(achievementsMigration, /achievement_type text not null check \(achievement_type in \('unique', 'secret'\)\)/);
    assert.match(achievementsMigration, /create table if not exists achievement_unlocks/);
    assert.match(achievementsMigration, /primary key \(achievement_key, user_id\)/);
    assert.match(achievementsMigration, /revealed_at timestamptz/);
    assert.match(achievementsMigration, /is_duplicate boolean not null default false/);
    assert.match(achievementsMigration, /is_demo boolean not null default false/);
  });
});

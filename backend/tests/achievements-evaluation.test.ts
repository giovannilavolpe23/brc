import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { collectAchievementCandidatesForDate, evaluateAchievementsThroughDate } from "../src/achievements/evaluation";
import type { DailyEntryStatsRow, StatsData } from "../src/stats/types";

const gioId = "11111111-1111-4111-8111-111111111111";
const jereId = "22222222-2222-4222-8222-222222222222";
const nataId = "33333333-3333-4333-8333-333333333333";

function entry(userId: string, dateKey: string, overrides: Partial<DailyEntryStatsRow> = {}): DailyEntryStatsRow {
  return {
    userId,
    dateKey,
    sleepDidNotSleep: false,
    sleepBedtime: "04:00",
    sleepWake: "10:00",
    napStart: null,
    napEnd: null,
    fifthMeal: "no",
    bathroom: 0,
    bolicheDidNotGo: true,
    bolicheEntryTime: "01:00",
    bolicheExitTime: null,
    bolicheClosedClub: false,
    ...overrides,
  };
}

function data(overrides: Partial<StatsData> = {}): StatsData {
  return {
    users: [
      { id: gioId, legacyId: "gio", displayName: "Gio" },
      { id: jereId, legacyId: "jere", displayName: "Jere" },
      { id: nataId, legacyId: "nata", displayName: "Nata" },
    ],
    expenses: [],
    dailyEntries: [],
    surveyVotes: [],
    previaParticipants: [],
    ...overrides,
  };
}

function candidate(key: string, candidates = collectAchievementCandidatesForDate("2026-08-28", data())) {
  return candidates.find((item) => item.key === key);
}

function completeEntries(days: string[], overridesForUser: (userId: string, dateKey: string, dayIndex: number) => Partial<DailyEntryStatsRow> = () => {}) {
  return days.flatMap((dateKey, dayIndex) => [
    entry(gioId, dateKey, overridesForUser(gioId, dateKey, dayIndex)),
    entry(jereId, dateKey, overridesForUser(jereId, dateKey, dayIndex)),
    entry(nataId, dateKey, overridesForUser(nataId, dateKey, dayIndex)),
  ]);
}

describe("persistent achievement evaluation", () => {
  it("does not persist achievements before a day is complete", async () => {
    const queries: string[] = [];
    const client = {
      async query(sql: string) {
        queries.push(sql);
        if (sql.includes("with active_users")) return { rows: [] };
        if (sql.includes("select achievement_key from achievement_resolutions")) return { rows: [] };
        return { rows: [], rowCount: 0 };
      },
    };

    const inserted = await evaluateAchievementsThroughDate("2026-08-28", client);

    assert.deepEqual(inserted, []);
    assert.equal(queries.some((sql) => /insert into achievement_resolutions/.test(sql)), false);
  });

  it("keeps uniques globally closed but lets secrets unlock for new users on later closed days", async () => {
    const days = ["2026-08-28", "2026-08-29"];
    const users = data().users;
    const dailyEntries = [
      entry(gioId, "2026-08-28", { sleepBedtime: "04:00", sleepWake: "04:30" }),
      entry(jereId, "2026-08-28"),
      entry(nataId, "2026-08-28"),
      entry(gioId, "2026-08-29"),
      entry(jereId, "2026-08-29", { sleepBedtime: "04:00", sleepWake: "04:30" }),
      entry(nataId, "2026-08-29"),
    ];
    const expenses = days.flatMap((dateKey) =>
      [gioId, jereId, nataId].map((userId) => ({ userId, dateKey, category: "Comida", amount: 1 }))
    );
    const resolutions = new Map<string, { type: "unique" | "secret"; dateKey: string; isDuplicate: boolean }>();
    const unlocks = new Set<string>();

    const client = {
      async query(sql: string, params: unknown[] = []) {
        if (sql.includes("with active_users")) return { rows: days.map((date_key) => ({ date_key })) };
        if (sql.includes("select achievement_key from achievement_resolutions")) {
          return {
            rows: Array.from(resolutions, ([achievement_key, resolution]) => ({ achievement_key, achievement_type: resolution.type }))
              .filter((row) => row.achievement_type === "unique"),
          };
        }
        if (sql.includes("left join user_appearances")) {
          return {
            rows: users.map((user) => ({
              id: user.id,
              legacy_id: user.legacyId,
              display_name: user.displayName,
              preset: null,
              primary_color: null,
              secondary_color: null,
              gradient_direction: null,
              intensity: null,
              visual_style: null,
              avatar_border_style: null,
              king_phrase: null,
              premium_glow: null,
              premium_shadow: null,
              premium_border: null,
              premium_intensity: null,
              premium_motion: null,
              premium_border_animation: null,
              premium_shimmer: null,
            })),
          };
        }
        if (sql.includes("from money_movements")) {
          return {
            rows: expenses
              .filter((expense) => expense.dateKey < String(params[0]))
              .map((expense) => ({
                user_id: expense.userId,
                category: expense.category,
                amount_pesos: expense.amount,
                date_key: expense.dateKey,
              })),
          };
        }
        if (sql.includes("from daily_entries")) {
          return {
            rows: dailyEntries
              .filter((item) => item.dateKey < String(params[0]))
              .map((item) => ({
                user_id: item.userId,
                date_key: item.dateKey,
                sleep_did_not_sleep: item.sleepDidNotSleep,
                sleep_bedtime: item.sleepBedtime,
                sleep_wake: item.sleepWake,
                nap_start: item.napStart,
                nap_end: item.napEnd,
                fifth_meal: item.fifthMeal,
                bathroom_count: item.bathroom,
                boliche_did_not_go: item.bolicheDidNotGo,
                boliche_entry_time: item.bolicheEntryTime,
                boliche_exit_time: item.bolicheExitTime,
                boliche_closed_club: item.bolicheClosedClub,
              })),
          };
        }
        if (sql.includes("from survey_votes")) return { rows: [] };
        if (sql.includes("from previa_participants")) return { rows: [] };
        if (sql.includes("insert into achievement_resolutions")) {
          const [key, type, dateKey, isDuplicate] = params as [string, "unique" | "secret", string, boolean];
          if (resolutions.has(key)) return { rows: [], rowCount: 0 };
          resolutions.set(key, { type, dateKey, isDuplicate });
          return { rows: [{ achievement_key: key }], rowCount: 1 };
        }
        if (sql.includes("insert into achievement_unlocks")) {
          const [key, userId] = params as [string, string];
          const unlockKey = `${key}:${userId}`;
          if (unlocks.has(unlockKey)) return { rows: [], rowCount: 0 };
          unlocks.add(unlockKey);
          return { rows: [{ user_id: userId }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      },
    };

    const inserted = await evaluateAchievementsThroughDate("2026-08-29", client);
    const retried = await evaluateAchievementsThroughDate("2026-08-29", client);

    assert.equal(inserted.filter((item) => item.key === "first_bottom").length, 1);
    assert.deepEqual(inserted.find((item) => item.key === "first_bottom")?.userIds, [gioId]);
    assert.deepEqual(
      inserted.filter((item) => item.key === "secret_no_sleep_required").map((item) => item.userIds),
      [[gioId], [jereId]]
    );
    assert.equal(unlocks.has(`first_bottom:${jereId}`), false);
    assert.equal(unlocks.has(`secret_no_sleep_required:${gioId}`), true);
    assert.equal(unlocks.has(`secret_no_sleep_required:${jereId}`), true);
    assert.deepEqual(retried, []);
  });

  it("awards Primero en tocar fondo below 3 hours, including duplicates, but not at 3 hours", () => {
    const candidates = collectAchievementCandidatesForDate(
      "2026-08-28",
      data({
        dailyEntries: [
          entry(gioId, "2026-08-28", { sleepBedtime: "04:00", sleepWake: "06:59" }),
          entry(jereId, "2026-08-28", { sleepBedtime: "04:00", sleepWake: "07:00" }),
          entry(nataId, "2026-08-28", { sleepDidNotSleep: true, sleepBedtime: null, sleepWake: null }),
        ],
      })
    );

    assert.deepEqual(candidate("first_bottom", candidates)?.userIds, [gioId, nataId]);
  });

  it("awards Primero en dormir horas extra only above 8 hours", () => {
    const candidates = collectAchievementCandidatesForDate(
      "2026-08-28",
      data({
        dailyEntries: [
          entry(gioId, "2026-08-28", { sleepBedtime: "03:00", sleepWake: "11:00" }),
          entry(jereId, "2026-08-28", { sleepBedtime: "03:00", sleepWake: "11:01" }),
        ],
      })
    );

    assert.deepEqual(candidate("first_extra_sleep", candidates)?.userIds, [jereId]);
  });

  it("awards Primero en romper la billetera on accumulated expenses and ignores incomes", () => {
    const candidates = collectAchievementCandidatesForDate(
      "2026-08-29",
      data({
        dailyEntries: [
          entry(gioId, "2026-08-29"),
          entry(jereId, "2026-08-29"),
          entry(nataId, "2026-08-29"),
        ],
        expenses: [
          { userId: gioId, dateKey: "2026-08-27", category: "Alcohol", amount: 349999 },
          { userId: gioId, dateKey: "2026-08-29", category: "Comida", amount: 1 },
          { userId: jereId, dateKey: "2026-08-29", category: "Alcohol", amount: 350000 },
        ],
      })
    );

    assert.deepEqual(candidate("first_broke_wallet", candidates)?.userIds, [gioId, jereId]);
  });

  it("does not award Primero en cerrar 3 veces before three closed clubs", () => {
    const candidates = collectAchievementCandidatesForDate(
      "2026-08-25",
      data({
        dailyEntries: [
          entry(gioId, "2026-08-24", { bolicheDidNotGo: false, bolicheClosedClub: true }),
          entry(gioId, "2026-08-25", { bolicheDidNotGo: false, bolicheClosedClub: true }),
        ],
      })
    );

    assert.equal(candidate("first_three_closed_clubs", candidates), undefined);
  });

  it("awards Primero en cerrar 3 veces when players reach three closures on the same closed day", () => {
    const candidates = collectAchievementCandidatesForDate(
      "2026-08-26",
      data({
        dailyEntries: [
          entry(gioId, "2026-08-24", { bolicheDidNotGo: false, bolicheClosedClub: true }),
          entry(gioId, "2026-08-25", { bolicheDidNotGo: false, bolicheClosedClub: true }),
          entry(gioId, "2026-08-26", { bolicheDidNotGo: false, bolicheClosedClub: true }),
          entry(jereId, "2026-08-24", { bolicheDidNotGo: false, bolicheClosedClub: true }),
          entry(jereId, "2026-08-25", { bolicheDidNotGo: false, bolicheClosedClub: true }),
          entry(jereId, "2026-08-26", { bolicheDidNotGo: false, bolicheClosedClub: true }),
        ],
      })
    );

    assert.deepEqual(candidate("first_three_closed_clubs", candidates)?.userIds, [gioId, jereId]);
  });

  it("does not award Primero en cerrar 3 veces again after it was resolved", () => {
    const candidates = collectAchievementCandidatesForDate(
      "2026-08-28",
      data({
        dailyEntries: [
          entry(nataId, "2026-08-26", { bolicheDidNotGo: false, bolicheClosedClub: true }),
          entry(nataId, "2026-08-27", { bolicheDidNotGo: false, bolicheClosedClub: true }),
          entry(nataId, "2026-08-28", { bolicheDidNotGo: false, bolicheClosedClub: true }),
        ],
      }),
      new Set(["first_three_closed_clubs"])
    );

    assert.equal(candidate("first_three_closed_clubs", candidates), undefined);
  });

  it("does not award already resolved achievements again", () => {
    const candidates = collectAchievementCandidatesForDate(
      "2026-08-28",
      data({
        dailyEntries: [entry(gioId, "2026-08-28", { sleepBedtime: "04:00", sleepWake: "06:00" })],
      }),
      new Set(["first_bottom"])
    );

    assert.equal(candidate("first_bottom", candidates), undefined);
  });

  it("awards secret sleep only below 1 hour", () => {
    const candidates = collectAchievementCandidatesForDate(
      "2026-08-28",
      data({
        dailyEntries: [
          entry(gioId, "2026-08-28", { sleepBedtime: "04:00", sleepWake: "04:59" }),
          entry(jereId, "2026-08-28", { sleepBedtime: "04:00", sleepWake: "05:00" }),
          entry(nataId, "2026-08-28", { sleepDidNotSleep: true, sleepBedtime: null, sleepWake: null }),
        ],
      })
    );

    assert.deepEqual(candidate("secret_no_sleep_required", candidates)?.userIds, [gioId, nataId]);
  });

  it("awards Parte del personal bolichero at six closures, including same-day duplicates", () => {
    const dailyEntries = ["2026-08-24", "2026-08-25", "2026-08-26", "2026-08-27", "2026-08-28", "2026-08-29"].flatMap((dateKey) => [
      entry(gioId, dateKey, { bolicheDidNotGo: false, bolicheClosedClub: true }),
      entry(jereId, dateKey, { bolicheDidNotGo: false, bolicheClosedClub: true }),
    ]);

    const before = collectAchievementCandidatesForDate("2026-08-28", data({ dailyEntries }));
    const after = collectAchievementCandidatesForDate("2026-08-29", data({ dailyEntries }));

    assert.equal(candidate("secret_club_staff", before), undefined);
    assert.deepEqual(candidate("secret_club_staff", after)?.userIds, [gioId, jereId]);
  });

  it("does not award No era una competencia after winning only three distinct daily stats", () => {
    const candidates = collectAchievementCandidatesForDate(
      "2026-08-28",
      data({
        dailyEntries: [
          entry(gioId, "2026-08-28", {
            sleepBedtime: "02:00",
            sleepWake: "12:00",
            fifthMeal: "yes",
            bathroom: 4,
          }),
          entry(jereId, "2026-08-28", { sleepBedtime: "04:00", sleepWake: "09:00" }),
          entry(nataId, "2026-08-28", { sleepBedtime: "04:00", sleepWake: "09:00" }),
        ],
      })
    );

    assert.equal(candidate("secret_not_a_competition", candidates), undefined);
  });

  it("awards No era una competencia after winning four distinct daily stats", () => {
    const candidates = collectAchievementCandidatesForDate(
      "2026-08-28",
      data({
        dailyEntries: [
          entry(gioId, "2026-08-28", { sleepBedtime: "02:00", sleepWake: "12:00", fifthMeal: "yes", bathroom: 4 }),
          entry(jereId, "2026-08-28"),
        ],
        expenses: [{ userId: gioId, dateKey: "2026-08-28", category: "Comida", amount: 9000 }],
      })
    );

    assert.deepEqual(candidate("secret_not_a_competition", candidates)?.userIds, [gioId]);
  });

  it("awards No era una competencia after winning five or more distinct daily stats", () => {
    const candidates = collectAchievementCandidatesForDate(
      "2026-08-28",
      data({
        dailyEntries: [
          entry(gioId, "2026-08-28", { sleepBedtime: "02:00", sleepWake: "12:00", fifthMeal: "yes", bathroom: 4, bolicheDidNotGo: false, bolicheEntryTime: "01:00", bolicheExitTime: "01:50" }),
          entry(jereId, "2026-08-28"),
        ],
        expenses: [{ userId: gioId, dateKey: "2026-08-28", category: "Comida", amount: 9000 }],
      })
    );

    assert.deepEqual(candidate("secret_not_a_competition", candidates)?.userIds, [gioId]);
  });

  it("counts tied daily stats as wins for No era una competencia", () => {
    const candidates = collectAchievementCandidatesForDate(
      "2026-08-28",
      data({
        dailyEntries: [
          entry(gioId, "2026-08-28", { sleepBedtime: "02:00", sleepWake: "12:00", fifthMeal: "yes", bathroom: 4 }),
          entry(jereId, "2026-08-28", { sleepBedtime: "02:00", sleepWake: "12:00", fifthMeal: "yes", bathroom: 4 }),
          entry(nataId, "2026-08-28"),
        ],
        expenses: [
          { userId: gioId, dateKey: "2026-08-28", category: "Comida", amount: 9000 },
          { userId: jereId, dateKey: "2026-08-28", category: "Comida", amount: 9000 },
        ],
      })
    );

    assert.deepEqual(candidate("secret_not_a_competition", candidates)?.userIds, [gioId, jereId]);
  });

  it("counts No dormí as a zero-minute least sleep win for No era una competencia", () => {
    const candidates = collectAchievementCandidatesForDate(
      "2026-08-28",
      data({
        dailyEntries: [
          entry(gioId, "2026-08-28", {
            sleepBedtime: "03:00",
            sleepWake: "11:00",
            bathroom: 1,
            bolicheDidNotGo: false,
            bolicheEntryTime: "01:00",
            bolicheExitTime: "02:00",
          }),
          entry(jereId, "2026-08-28", { sleepBedtime: "04:00", sleepWake: "11:00", bathroom: 0 }),
          entry(nataId, "2026-08-28", {
            sleepDidNotSleep: true,
            sleepBedtime: null,
            sleepWake: null,
            bathroom: 5,
            bolicheDidNotGo: false,
            bolicheEntryTime: "01:00",
            bolicheExitTime: "05:00",
          }),
        ],
        surveyVotes: [{ surveyKey: "best_outfit", dateKey: "2026-08-28", votedUserId: nataId }],
      })
    );

    assert.deepEqual(candidate("secret_not_a_competition", candidates)?.userIds, [nataId]);
  });

  it("does not count the same statistic twice for No era una competencia", () => {
    const candidates = collectAchievementCandidatesForDate(
      "2026-08-28",
      data({
        dailyEntries: [
          entry(gioId, "2026-08-28", { sleepBedtime: "02:00", sleepWake: "12:00", bathroom: 4 }),
          entry(jereId, "2026-08-28"),
        ],
        surveyVotes: [
          { surveyKey: "destroyed_vote", dateKey: "2026-08-28", votedUserId: gioId },
          { surveyKey: "destroyed_vote", dateKey: "2026-08-28", votedUserId: gioId },
          { surveyKey: "destroyed_vote", dateKey: "2026-08-28", votedUserId: gioId },
        ],
      })
    );

    assert.equal(candidate("secret_not_a_competition", candidates), undefined);
  });

  it("awards Vino a quebrar only when destroyed vote and Alcohol spending are won on the same day", () => {
    const candidates = collectAchievementCandidatesForDate(
      "2026-08-28",
      data({
        dailyEntries: [entry(gioId, "2026-08-28"), entry(jereId, "2026-08-28"), entry(nataId, "2026-08-28")],
        surveyVotes: [
          { surveyKey: "destroyed_vote", dateKey: "2026-08-28", votedUserId: gioId },
          { surveyKey: "destroyed_vote", dateKey: "2026-08-28", votedUserId: gioId },
          { surveyKey: "destroyed_vote", dateKey: "2026-08-28", votedUserId: jereId },
        ],
        expenses: [
          { userId: gioId, dateKey: "2026-08-28", category: "Alcohol", amount: 5000 },
          { userId: jereId, dateKey: "2026-08-28", category: "Alcohol", amount: 5000 },
          { userId: nataId, dateKey: "2026-08-28", category: "Comida", amount: 9000 },
        ],
      })
    );

    assert.deepEqual(candidate("secret_came_to_break", candidates)?.userIds, [gioId]);
  });

  it("does not award ¿Quién te hizo tanto daño? after only three consecutive negative days", () => {
    const days = ["2026-08-25", "2026-08-26", "2026-08-27"];
    const candidates = collectAchievementCandidatesForDate(
      "2026-08-27",
      data({
        dailyEntries: completeEntries(days, (userId) => userId === gioId ? { sleepBedtime: "04:00", sleepWake: "08:00" } : { sleepBedtime: "02:00", sleepWake: "10:00" }),
      })
    );

    assert.equal(candidate("secret_who_hurt_you", candidates), undefined);
  });

  it("awards ¿Quién te hizo tanto daño? after four consecutive negative days", () => {
    const days = ["2026-08-25", "2026-08-26", "2026-08-27", "2026-08-28"];
    const candidates = collectAchievementCandidatesForDate(
      "2026-08-28",
      data({
        dailyEntries: completeEntries(days, (userId) => userId === gioId ? { sleepBedtime: "04:00", sleepWake: "08:00" } : { sleepBedtime: "02:00", sleepWake: "10:00" }),
      })
    );

    assert.deepEqual(candidate("secret_who_hurt_you", candidates)?.userIds, [gioId]);
  });

  it("counts different negative conditions for ¿Quién te hizo tanto daño?", () => {
    const days = ["2026-08-25", "2026-08-26", "2026-08-27", "2026-08-28"];
    const candidates = collectAchievementCandidatesForDate(
      "2026-08-28",
      data({
        dailyEntries: completeEntries(days, (userId, _dateKey, dayIndex) =>
          userId === gioId
            ? dayIndex === 0
              ? { sleepBedtime: "04:00", sleepWake: "08:00" }
              : { sleepBedtime: "01:00", sleepWake: "11:00" }
            : { sleepBedtime: "02:00", sleepWake: "10:00" }
        ),
        expenses: [
          { userId: gioId, dateKey: "2026-08-26", category: "Alcohol", amount: 1000 },
          { userId: jereId, dateKey: "2026-08-26", category: "Alcohol", amount: 1 },
          { userId: gioId, dateKey: "2026-08-28", category: "Comida", amount: 1000 },
          { userId: jereId, dateKey: "2026-08-28", category: "Comida", amount: 1 },
        ],
        surveyVotes: [
          { surveyKey: "destroyed_vote", dateKey: "2026-08-27", votedUserId: gioId },
          { surveyKey: "destroyed_vote", dateKey: "2026-08-27", votedUserId: gioId },
          { surveyKey: "destroyed_vote", dateKey: "2026-08-27", votedUserId: jereId },
        ],
      })
    );

    assert.deepEqual(candidate("secret_who_hurt_you", candidates)?.userIds, [gioId]);
  });

  it("counts several negative wins on one date as only one day and cuts interrupted streaks", () => {
    const days = ["2026-08-24", "2026-08-25", "2026-08-26", "2026-08-27", "2026-08-28"];
    const candidates = collectAchievementCandidatesForDate(
      "2026-08-28",
      data({
        dailyEntries: completeEntries(days, (userId, _dateKey, dayIndex) =>
          userId === gioId
            ? dayIndex === 2
              ? { sleepBedtime: "01:00", sleepWake: "11:00" }
              : { sleepBedtime: "04:00", sleepWake: "08:00" }
            : dayIndex === 2
              ? { sleepBedtime: "04:00", sleepWake: "08:00" }
              : { sleepBedtime: "02:00", sleepWake: "10:00" }
        ),
        expenses: [
          { userId: gioId, dateKey: "2026-08-24", category: "Alcohol", amount: 2000 },
          { userId: jereId, dateKey: "2026-08-24", category: "Alcohol", amount: 1 },
        ],
        surveyVotes: [
          { surveyKey: "destroyed_vote", dateKey: "2026-08-24", votedUserId: gioId },
          { surveyKey: "destroyed_vote", dateKey: "2026-08-24", votedUserId: gioId },
        ],
      })
    );

    assert.equal(candidate("secret_who_hurt_you", candidates), undefined);
  });

  it("counts tied negative daily wins for ¿Quién te hizo tanto daño?", () => {
    const days = ["2026-08-25", "2026-08-26", "2026-08-27", "2026-08-28"];
    const candidates = collectAchievementCandidatesForDate(
      "2026-08-28",
      data({
        dailyEntries: completeEntries(days, (userId) =>
          userId === nataId ? { sleepBedtime: "02:00", sleepWake: "10:00" } : { sleepBedtime: "04:00", sleepWake: "08:00" }
        ),
      })
    );

    assert.deepEqual(candidate("secret_who_hurt_you", candidates)?.userIds, [gioId, jereId]);
  });

  it("awards Economía precaria only for complete days with zero expenses", () => {
    const candidates = collectAchievementCandidatesForDate(
      "2026-08-28",
      data({
        dailyEntries: completeEntries(["2026-08-28"]),
        expenses: [
          { userId: jereId, dateKey: "2026-08-28", category: "Comida", amount: 1 },
          { userId: nataId, dateKey: "2026-08-28", category: "Comida", amount: 1 },
        ],
      })
    );

    assert.deepEqual(candidate("secret_broke_economy", candidates)?.userIds, [gioId]);
  });

  it("does not award Economía precaria with one peso spent or before the day is closed", () => {
    const onePeso = collectAchievementCandidatesForDate(
      "2026-08-28",
      data({
        dailyEntries: completeEntries(["2026-08-28"]),
        expenses: [
          { userId: gioId, dateKey: "2026-08-28", category: "Comida", amount: 1 },
          { userId: jereId, dateKey: "2026-08-28", category: "Comida", amount: 1 },
          { userId: nataId, dateKey: "2026-08-28", category: "Comida", amount: 1 },
        ],
      })
    );
    const openDay = collectAchievementCandidatesForDate("2026-08-28", data({ expenses: [] }));

    assert.equal(candidate("secret_broke_economy", onePeso), undefined);
    assert.equal(candidate("secret_broke_economy", openDay), undefined);
  });

  it("treats income-only days as zero-expense days for Economía precaria", () => {
    const candidates = collectAchievementCandidatesForDate(
      "2026-08-28",
      data({
        dailyEntries: completeEntries(["2026-08-28"]),
        expenses: [
          { userId: jereId, dateKey: "2026-08-28", category: "Comida", amount: 1 },
          { userId: nataId, dateKey: "2026-08-28", category: "Comida", amount: 1 },
        ],
      })
    );

    assert.deepEqual(candidate("secret_broke_economy", candidates)?.userIds, [gioId]);
  });

  it("awards Outfit con consecuencias only when outfit and most flirty are won on the same date", () => {
    const dailyEntries = completeEntries(["2026-08-28"]);
    const outfitOnly = collectAchievementCandidatesForDate(
      "2026-08-28",
      data({ dailyEntries, surveyVotes: [{ surveyKey: "best_outfit", dateKey: "2026-08-28", votedUserId: gioId }] })
    );
    const flirtyOnly = collectAchievementCandidatesForDate(
      "2026-08-28",
      data({ dailyEntries, surveyVotes: [{ surveyKey: "most_flirty", dateKey: "2026-08-28", votedUserId: gioId }] })
    );
    const both = collectAchievementCandidatesForDate(
      "2026-08-28",
      data({
        dailyEntries,
        surveyVotes: [
          { surveyKey: "best_outfit", dateKey: "2026-08-28", votedUserId: gioId },
          { surveyKey: "most_flirty", dateKey: "2026-08-28", votedUserId: gioId },
        ],
      })
    );
    const differentDates = collectAchievementCandidatesForDate(
      "2026-08-28",
      data({
        dailyEntries: completeEntries(["2026-08-27", "2026-08-28"]),
        surveyVotes: [
          { surveyKey: "best_outfit", dateKey: "2026-08-27", votedUserId: gioId },
          { surveyKey: "most_flirty", dateKey: "2026-08-28", votedUserId: gioId },
        ],
      })
    );

    assert.equal(candidate("secret_outfit_consequences", outfitOnly), undefined);
    assert.equal(candidate("secret_outfit_consequences", flirtyOnly), undefined);
    assert.deepEqual(candidate("secret_outfit_consequences", both)?.userIds, [gioId]);
    assert.equal(candidate("secret_outfit_consequences", differentDates), undefined);
  });

  it("counts tied outfit and most flirty winners for Outfit con consecuencias", () => {
    const candidates = collectAchievementCandidatesForDate(
      "2026-08-28",
      data({
        dailyEntries: completeEntries(["2026-08-28"]),
        surveyVotes: [
          { surveyKey: "best_outfit", dateKey: "2026-08-28", votedUserId: gioId },
          { surveyKey: "best_outfit", dateKey: "2026-08-28", votedUserId: jereId },
          { surveyKey: "most_flirty", dateKey: "2026-08-28", votedUserId: gioId },
          { surveyKey: "most_flirty", dateKey: "2026-08-28", votedUserId: jereId },
        ],
      })
    );

    assert.deepEqual(candidate("secret_outfit_consequences", candidates)?.userIds, [gioId, jereId]);
  });
});

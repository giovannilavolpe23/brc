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

  it("awards Primero en tocar fondo below 3 hours, including duplicates, but not at 3 hours", () => {
    const candidates = collectAchievementCandidatesForDate(
      "2026-08-28",
      data({
        dailyEntries: [
          entry(gioId, "2026-08-28", { sleepBedtime: "04:00", sleepWake: "06:59" }),
          entry(jereId, "2026-08-28", { sleepBedtime: "04:00", sleepWake: "07:00" }),
          entry(nataId, "2026-08-28", { sleepBedtime: "05:00", sleepWake: "07:59" }),
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
        ],
      })
    );

    assert.deepEqual(candidate("secret_no_sleep_required", candidates)?.userIds, [gioId]);
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
});

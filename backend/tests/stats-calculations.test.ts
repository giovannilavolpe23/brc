import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateStats } from "../src/stats/calculations";
import type { DailyEntryStatsRow, StatsData } from "../src/stats/types";

const gioId = "11111111-1111-4111-8111-111111111111";
const jereId = "22222222-2222-4222-8222-222222222222";
const laraId = "33333333-3333-4333-8333-333333333333";

function entry(userId: string, dateKey: string, overrides: Partial<DailyEntryStatsRow> = {}): DailyEntryStatsRow {
  return {
    userId,
    dateKey,
    sleepDidNotSleep: false,
    sleepBedtime: "02:00",
    sleepWake: "10:00",
    napStart: null,
    napEnd: null,
    fifthMeal: null,
    bathroom: null,
    bolicheDidNotGo: true,
    bolicheExitTime: null,
    ...overrides,
  };
}

function baseData(): StatsData {
  return {
    users: [
      { id: gioId, legacyId: "gio", displayName: "Gio" },
      { id: jereId, legacyId: "jere", displayName: "Jere" },
    ],
    expenses: [
      { userId: gioId, dateKey: "2026-08-27", category: "Comida", amount: 1000 },
      { userId: gioId, dateKey: "2026-08-28", category: "Comida", amount: 2000 },
      { userId: jereId, dateKey: "2026-08-28", category: "Alcohol", amount: 5000 },
    ],
    dailyEntries: [
      entry(gioId, "2026-08-27", {
        fifthMeal: "yes",
        bathroom: 1,
        bolicheDidNotGo: false,
        bolicheExitTime: "04:00",
      }),
      entry(gioId, "2026-08-28", {
        napStart: "16:00",
        napEnd: "17:00",
        fifthMeal: "yes",
        bathroom: 2,
      }),
      entry(jereId, "2026-08-28", {
        sleepBedtime: "03:00",
        sleepWake: "11:00",
        fifthMeal: "no",
        bathroom: 0,
        bolicheDidNotGo: false,
        bolicheExitTime: "06:00",
      }),
    ],
    surveyVotes: [
      { surveyKey: "destroyed_vote", dateKey: "2026-08-28", votedUserId: gioId },
      { surveyKey: "destroyed_vote", dateKey: "2026-08-28", votedUserId: gioId },
      { surveyKey: "destroyed_vote", dateKey: "2026-08-27", votedUserId: jereId },
    ],
    previaParticipants: [
      { previaId: "previa-1", userId: gioId, dateKey: "2026-08-28" },
      { previaId: "previa-1", userId: jereId, dateKey: "2026-08-28" },
    ],
  };
}

describe("stats calculations", () => {
  it("calculates total accumulated stats without exposing initial balances", () => {
    const stats = calculateStats("total", baseData());

    assert.equal(stats.money.totalSpentGlobal, 8000);
    assert.deepEqual(stats.users[0], { id: gioId, legacyId: "gio", displayName: "Gio" });
    assert.deepEqual(stats.money.totalSpentByUser, [
      { userId: jereId, value: 5000 },
      { userId: gioId, value: 3000 },
    ]);
    assert.deepEqual(stats.money.rankingByCategory, [
      { category: "Alcohol", value: 5000 },
      { category: "Comida", value: 3000 },
    ]);
    assert.equal(stats.money.topCategory?.category, "Alcohol");
    assert.deepEqual(stats.money.byCategoryAndUser.Comida, [{ userId: gioId, value: 3000 }]);
    assert.equal(JSON.stringify(stats).includes("initialBalance"), false);
  });

  it("filters day stats and omits categories without data", () => {
    const stats = calculateStats("day", baseData(), "2026-08-28");

    assert.equal(stats.money.totalSpentGlobal, 7000);
    assert.deepEqual(stats.money.rankingByCategory, [
      { category: "Alcohol", value: 5000 },
      { category: "Comida", value: 2000 },
    ]);
    assert.equal(stats.money.rankingByCategory.some((row) => row.category === "Chocolates"), false);
  });

  it("does not expose streaks in day stats", () => {
    const stats = calculateStats("day", baseData(), "2026-08-28");

    assert.deepEqual(stats.streaks, {
      boliche: [],
      fifthMeal: [],
      bathroom: [],
      chocolates: [],
      alcohol: [],
      zombie: [],
      alcoholSpender: [],
      destroyedVote: [],
      moneySpender: [],
    });
  });

  it("uses user ids in rankings and aggregates daily entries", () => {
    const stats = calculateStats("day", baseData(), "2026-08-28");

    assert.equal(stats.dailyEntries.sleepMinutes[0].userId, gioId);
    assert.equal(stats.dailyEntries.sleepMinutes[0].value, 480);
    assert.deepEqual(stats.dailyEntries.leastSleepMinutes, [
      { userId: jereId, value: 480 },
      { userId: gioId, value: 540 },
    ]);
    assert.deepEqual(stats.dailyEntries.siestas, [
      { userId: gioId, value: 1 },
      { userId: jereId, value: 0 },
    ]);
    assert.equal(stats.dailyEntries.bathroom.some((row) => row.userId === jereId && row.value === 0), true);
  });

  it("ranks least sleep ascending by total sleep and ignores entries without valid sleep data", () => {
    const stats = calculateStats("day", {
      users: [
        { id: gioId, legacyId: "gio", displayName: "Gio" },
        { id: jereId, legacyId: "jere", displayName: "Jere" },
        { id: laraId, legacyId: "lara", displayName: "Lara" },
      ],
      expenses: [],
      dailyEntries: [
        entry(gioId, "2026-08-28", { sleepBedtime: "02:00", sleepWake: "10:00", napStart: "16:00", napEnd: "17:00" }),
        entry(jereId, "2026-08-28", { sleepBedtime: "04:00", sleepWake: "09:00" }),
        entry(laraId, "2026-08-28", { sleepDidNotSleep: true, sleepBedtime: null, sleepWake: null }),
      ],
      surveyVotes: [],
      previaParticipants: [],
    }, "2026-08-28");

    assert.deepEqual(stats.dailyEntries.leastSleepMinutes, [
      { userId: jereId, value: 300 },
      { userId: gioId, value: 540 },
    ]);
    assert.deepEqual(stats.dailyEntries.sleepMinutes, [
      { userId: gioId, value: 480 },
      { userId: jereId, value: 300 },
    ]);
  });

  it("keeps least sleep ties together and sorts them deterministically", () => {
    const stats = calculateStats("day", {
      users: [
        { id: gioId, legacyId: "gio", displayName: "Gio" },
        { id: jereId, legacyId: "jere", displayName: "Jere" },
        { id: laraId, legacyId: "lara", displayName: "Lara" },
      ],
      expenses: [],
      dailyEntries: [
        entry(gioId, "2026-08-28", { sleepBedtime: "04:00", sleepWake: "09:00" }),
        entry(jereId, "2026-08-28", { sleepBedtime: "04:00", sleepWake: "09:00" }),
        entry(laraId, "2026-08-28", { sleepBedtime: "02:00", sleepWake: "10:00" }),
      ],
      surveyVotes: [],
      previaParticipants: [],
    }, "2026-08-28");

    assert.deepEqual(stats.dailyEntries.leastSleepMinutes, [
      { userId: gioId, value: 300 },
      { userId: jereId, value: 300 },
      { userId: laraId, value: 480 },
    ]);
  });

  it("accumulates least sleep totals across closed days", () => {
    const stats = calculateStats("total", baseData());

    assert.deepEqual(stats.dailyEntries.leastSleepMinutes, [
      { userId: jereId, value: 480 },
      { userId: gioId, value: 1020 },
    ]);
  });

  it("aggregates destroyed_vote surveys", () => {
    const stats = calculateStats("total", baseData());

    assert.deepEqual(stats.surveys.destroyed_vote, [
      { userId: gioId, value: 2 },
      { userId: jereId, value: 1 },
    ]);
  });

  it("calculates previa stats from participants", () => {
    const stats = calculateStats("day", baseData(), "2026-08-28");

    assert.equal(stats.previas.totalCount, 1);
    assert.deepEqual(stats.previas.byParticipant, [
      { userId: gioId, value: 1 },
      { userId: jereId, value: 1 },
    ]);
  });

  it("includes previas in closed days and day stats without requiring a daily entry", () => {
    const stats = calculateStats("day", {
      users: baseData().users,
      expenses: [],
      dailyEntries: [],
      surveyVotes: [],
      previaParticipants: [{ previaId: "previa-only", userId: gioId, dateKey: "2026-08-28" }],
    }, "2026-08-28");

    assert.deepEqual(stats.closedDays, ["2026-08-28"]);
    assert.equal(stats.previas.totalCount, 1);
    assert.deepEqual(stats.previas.byParticipant, [{ userId: gioId, value: 1 }]);
  });

  it("changes when a new movement is added", () => {
    const data = baseData();
    const before = calculateStats("total", data);
    data.expenses.push({ userId: jereId, dateKey: "2026-08-28", category: "Alcohol", amount: 1000 });
    const after = calculateStats("total", data);

    assert.equal(before.money.totalSpentGlobal, 8000);
    assert.equal(after.money.totalSpentGlobal, 9000);
    assert.equal(after.money.totalSpentByUser[0].value, 6000);
  });

  it("calculates streaks from historical records at runtime", () => {
    const stats = calculateStats("total", baseData());

    assert.deepEqual(stats.streaks.fifthMeal, [{ userId: gioId, value: 2 }]);
    assert.deepEqual(stats.streaks.bathroom, [{ userId: gioId, value: 2 }]);
    assert.deepEqual(stats.streaks.alcohol, [{ userId: jereId, value: 1 }]);
  });

  it("calculates all negative streak titles from daily winners", () => {
    const stats = calculateStats("total", {
      users: [
        { id: gioId, legacyId: "gio", displayName: "Gio" },
        { id: jereId, legacyId: "jere", displayName: "Jere" },
        { id: laraId, legacyId: "lara", displayName: "Lara" },
      ],
      expenses: [
        { userId: gioId, dateKey: "2026-08-24", category: "Alcohol", amount: 100 },
        { userId: jereId, dateKey: "2026-08-24", category: "Comida", amount: 300 },
        { userId: gioId, dateKey: "2026-08-25", category: "Alcohol", amount: 120 },
        { userId: jereId, dateKey: "2026-08-25", category: "Comida", amount: 320 },
        { userId: gioId, dateKey: "2026-08-26", category: "Alcohol", amount: 140 },
        { userId: jereId, dateKey: "2026-08-26", category: "Comida", amount: 340 },
      ],
      dailyEntries: [
        entry(gioId, "2026-08-24", { sleepBedtime: "04:00", sleepWake: "08:00" }),
        entry(jereId, "2026-08-24", { sleepBedtime: "02:00", sleepWake: "10:00" }),
        entry(gioId, "2026-08-25", { sleepBedtime: "04:00", sleepWake: "08:00" }),
        entry(jereId, "2026-08-25", { sleepBedtime: "02:00", sleepWake: "10:00" }),
        entry(gioId, "2026-08-26", { sleepBedtime: "04:00", sleepWake: "08:00" }),
        entry(jereId, "2026-08-26", { sleepBedtime: "02:00", sleepWake: "10:00" }),
      ],
      surveyVotes: [
        { surveyKey: "destroyed_vote", dateKey: "2026-08-24", votedUserId: laraId },
        { surveyKey: "destroyed_vote", dateKey: "2026-08-25", votedUserId: laraId },
        { surveyKey: "destroyed_vote", dateKey: "2026-08-26", votedUserId: laraId },
      ],
      previaParticipants: [],
    });

    assert.deepEqual(stats.streaks.zombie, [{ userId: gioId, value: 3 }]);
    assert.deepEqual(stats.streaks.alcoholSpender, [{ userId: gioId, value: 3 }]);
    assert.deepEqual(stats.streaks.destroyedVote, [{ userId: laraId, value: 3 }]);
    assert.deepEqual(stats.streaks.moneySpender, [{ userId: jereId, value: 3 }]);
  });

  it("keeps historical negative streak maximum after the streak ends", () => {
    const stats = calculateStats("total", {
      users: baseData().users,
      expenses: [],
      dailyEntries: [
        entry(gioId, "2026-08-24", { sleepBedtime: "04:00", sleepWake: "08:00" }),
        entry(jereId, "2026-08-24", { sleepBedtime: "02:00", sleepWake: "10:00" }),
        entry(gioId, "2026-08-25", { sleepBedtime: "04:00", sleepWake: "08:00" }),
        entry(jereId, "2026-08-25", { sleepBedtime: "02:00", sleepWake: "10:00" }),
        entry(gioId, "2026-08-26", { sleepBedtime: "04:00", sleepWake: "08:00" }),
        entry(jereId, "2026-08-26", { sleepBedtime: "02:00", sleepWake: "10:00" }),
        entry(gioId, "2026-08-27", { sleepBedtime: "02:00", sleepWake: "10:00" }),
        entry(jereId, "2026-08-27", { sleepBedtime: "05:00", sleepWake: "08:00" }),
      ],
      surveyVotes: [],
      previaParticipants: [],
    });

    assert.deepEqual(stats.streaks.zombie, [
      { userId: gioId, value: 3 },
      { userId: jereId, value: 1 },
    ]);
  });

  it("lets another player surpass an ended negative streak", () => {
    const stats = calculateStats("total", {
      users: baseData().users,
      expenses: [],
      dailyEntries: [
        entry(gioId, "2026-08-24", { sleepBedtime: "04:00", sleepWake: "08:00" }),
        entry(jereId, "2026-08-24", { sleepBedtime: "02:00", sleepWake: "10:00" }),
        entry(gioId, "2026-08-25", { sleepBedtime: "04:00", sleepWake: "08:00" }),
        entry(jereId, "2026-08-25", { sleepBedtime: "02:00", sleepWake: "10:00" }),
        entry(gioId, "2026-08-26", { sleepBedtime: "04:00", sleepWake: "08:00" }),
        entry(jereId, "2026-08-26", { sleepBedtime: "02:00", sleepWake: "10:00" }),
        entry(gioId, "2026-08-27", { sleepBedtime: "02:00", sleepWake: "10:00" }),
        entry(jereId, "2026-08-27", { sleepBedtime: "05:00", sleepWake: "08:00" }),
        entry(gioId, "2026-08-28", { sleepBedtime: "02:00", sleepWake: "10:00" }),
        entry(jereId, "2026-08-28", { sleepBedtime: "05:00", sleepWake: "08:00" }),
        entry(gioId, "2026-08-29", { sleepBedtime: "02:00", sleepWake: "10:00" }),
        entry(jereId, "2026-08-29", { sleepBedtime: "05:00", sleepWake: "08:00" }),
        entry(gioId, "2026-08-30", { sleepBedtime: "02:00", sleepWake: "10:00" }),
        entry(jereId, "2026-08-30", { sleepBedtime: "05:00", sleepWake: "08:00" }),
      ],
      surveyVotes: [],
      previaParticipants: [],
    });

    assert.deepEqual(stats.streaks.zombie, [
      { userId: jereId, value: 4 },
      { userId: gioId, value: 3 },
    ]);
  });

  it("counts daily ties for all tied winners and returns tied historical maxima", () => {
    const stats = calculateStats("total", {
      users: baseData().users,
      expenses: [],
      dailyEntries: [
        entry(gioId, "2026-08-24", { sleepBedtime: "04:00", sleepWake: "08:00" }),
        entry(jereId, "2026-08-24", { sleepBedtime: "04:00", sleepWake: "08:00" }),
        entry(gioId, "2026-08-25", { sleepBedtime: "04:00", sleepWake: "08:00" }),
        entry(jereId, "2026-08-25", { sleepBedtime: "04:00", sleepWake: "08:00" }),
      ],
      surveyVotes: [],
      previaParticipants: [],
    });

    assert.deepEqual(stats.streaks.zombie, [
      { userId: gioId, value: 2 },
      { userId: jereId, value: 2 },
    ]);
  });

  it("cuts negative streaks when a calendar day is skipped or lost", () => {
    const stats = calculateStats("total", {
      users: baseData().users,
      expenses: [],
      dailyEntries: [
        entry(gioId, "2026-08-24", { sleepBedtime: "04:00", sleepWake: "08:00" }),
        entry(jereId, "2026-08-24", { sleepBedtime: "02:00", sleepWake: "10:00" }),
        entry(gioId, "2026-08-25", { sleepBedtime: "02:00", sleepWake: "10:00" }),
        entry(jereId, "2026-08-25", { sleepBedtime: "05:00", sleepWake: "08:00" }),
        entry(gioId, "2026-08-27", { sleepBedtime: "04:00", sleepWake: "08:00" }),
        entry(jereId, "2026-08-27", { sleepBedtime: "02:00", sleepWake: "10:00" }),
      ],
      surveyVotes: [],
      previaParticipants: [],
    });

    assert.deepEqual(stats.streaks.zombie, [
      { userId: gioId, value: 1 },
      { userId: jereId, value: 1 },
    ]);
  });

  it("returns empty statistics after reset data while preserving users", () => {
    const stats = calculateStats("total", {
      users: baseData().users,
      expenses: [],
      dailyEntries: [],
      surveyVotes: [],
      previaParticipants: [],
    });

    assert.equal(stats.users.length, 2);
    assert.equal(stats.money.totalSpentGlobal, 0);
    assert.deepEqual(stats.money.totalSpentByUser, []);
    assert.deepEqual(stats.dailyEntries.sleepMinutes, []);
    assert.deepEqual(stats.surveys.destroyed_vote, []);
    assert.deepEqual(stats.previas.byParticipant, []);
  });
});

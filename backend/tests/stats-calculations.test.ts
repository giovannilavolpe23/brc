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
    bolicheEntryTime: "01:00",
    bolicheExitTime: null,
    bolicheClosedClub: false,
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
      { surveyKey: "most_flirty", dateKey: "2026-08-28", votedUserId: jereId },
      { surveyKey: "most_flirty", dateKey: "2026-08-28", votedUserId: jereId },
      { surveyKey: "best_outfit", dateKey: "2026-08-28", votedUserId: gioId },
      { surveyKey: "best_outfit", dateKey: "2026-08-28", votedUserId: jereId },
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
      closedClub: [],
      fifthMeal: [],
      bathroom: [],
      chocolates: [],
      alcohol: [],
      zombie: [],
      alcoholSpender: [],
      destroyedVote: [],
      mostFlirtyVote: [],
      bestOutfitVote: [],
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

  it("ranks no sleep as zero and ignores entries without valid sleep data", () => {
    const stats = calculateStats("day", {
      users: [
        { id: gioId, legacyId: "gio", displayName: "Gio" },
        { id: jereId, legacyId: "jere", displayName: "Jere" },
        { id: laraId, legacyId: "lara", displayName: "Lara" },
        { id: "44444444-4444-4444-8444-444444444444", legacyId: "sebas", displayName: "Sebas" },
      ],
      expenses: [],
      dailyEntries: [
        entry(gioId, "2026-08-28", { sleepBedtime: "02:00", sleepWake: "10:00", napStart: "16:00", napEnd: "17:00" }),
        entry(jereId, "2026-08-28", { sleepBedtime: "04:00", sleepWake: "09:00" }),
        entry(laraId, "2026-08-28", { sleepDidNotSleep: true, sleepBedtime: null, sleepWake: null }),
        entry("44444444-4444-4444-8444-444444444444", "2026-08-28", { sleepBedtime: null, sleepWake: null }),
      ],
      surveyVotes: [],
      previaParticipants: [],
    }, "2026-08-28");

    assert.deepEqual(stats.dailyEntries.leastSleepMinutes, [
      { userId: laraId, value: 0 },
      { userId: jereId, value: 300 },
      { userId: gioId, value: 540 },
    ]);
    assert.deepEqual(stats.dailyEntries.sleepMinutes, [
      { userId: gioId, value: 480 },
      { userId: jereId, value: 300 },
      { userId: laraId, value: 0 },
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

  it("aggregates all daily surveys", () => {
    const stats = calculateStats("total", baseData());

    assert.deepEqual(stats.surveys.destroyed_vote, [
      { userId: gioId, value: 2 },
      { userId: jereId, value: 1 },
    ]);
    assert.deepEqual(stats.surveys.most_flirty, [{ userId: jereId, value: 2 }]);
    assert.deepEqual(stats.surveys.best_outfit, [
      { userId: gioId, value: 1 },
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

  it("uses closed club as 06:45 for boliche duration and counts total closures", () => {
    const stats = calculateStats("total", {
      users: baseData().users,
      expenses: [],
      dailyEntries: [
        entry(gioId, "2026-08-27", { bolicheDidNotGo: false, bolicheEntryTime: "02:00", bolicheExitTime: null, bolicheClosedClub: true }),
        entry(gioId, "2026-08-28", { bolicheDidNotGo: false, bolicheEntryTime: "02:00", bolicheExitTime: null, bolicheClosedClub: true }),
        entry(jereId, "2026-08-28", { bolicheDidNotGo: false, bolicheEntryTime: "03:00", bolicheExitTime: "05:00" }),
      ],
      surveyVotes: [],
      previaParticipants: [],
    });

    assert.deepEqual(stats.dailyEntries.bolicheMinutes, [
      { userId: gioId, value: 570 },
      { userId: jereId, value: 120 },
    ]);
    assert.deepEqual(stats.dailyEntries.closedClubs, [{ userId: gioId, value: 2 }]);
    assert.deepEqual(stats.streaks.closedClub, [{ userId: gioId, value: 2 }]);
  });

  it("keeps the best historical closed club streak and shares tied maxima", () => {
    const stats = calculateStats("total", {
      users: baseData().users,
      expenses: [],
      dailyEntries: [
        entry(gioId, "2026-08-24", { bolicheDidNotGo: false, bolicheClosedClub: true }),
        entry(gioId, "2026-08-25", { bolicheDidNotGo: false, bolicheClosedClub: true }),
        entry(gioId, "2026-08-26", { bolicheDidNotGo: false, bolicheClosedClub: true }),
        entry(gioId, "2026-08-28", { bolicheDidNotGo: false, bolicheClosedClub: true }),
        entry(gioId, "2026-08-29", { bolicheDidNotGo: false, bolicheClosedClub: true }),
        entry(jereId, "2026-08-24", { bolicheDidNotGo: false, bolicheClosedClub: true }),
        entry(jereId, "2026-08-25", { bolicheDidNotGo: false, bolicheClosedClub: true }),
        entry(jereId, "2026-08-26", { bolicheDidNotGo: false, bolicheClosedClub: true }),
      ],
      surveyVotes: [],
      previaParticipants: [],
    });

    assert.deepEqual(stats.streaks.closedClub, [
      { userId: gioId, value: 3 },
      { userId: jereId, value: 3 },
    ]);
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
    assert.deepEqual(stats.streaks.mostFlirtyVote, []);
    assert.deepEqual(stats.streaks.bestOutfitVote, []);
    assert.deepEqual(stats.streaks.moneySpender, [{ userId: jereId, value: 3 }]);
  });

  it("calculates best historical streaks for most flirty survey winners", () => {
    const stats = calculateStats("total", {
      users: [
        { id: gioId, legacyId: "gio", displayName: "Gio" },
        { id: jereId, legacyId: "jere", displayName: "Jere" },
        { id: laraId, legacyId: "lara", displayName: "Lara" },
      ],
      expenses: [],
      dailyEntries: [],
      surveyVotes: [
        { surveyKey: "most_flirty", dateKey: "2026-08-24", votedUserId: gioId },
        { surveyKey: "most_flirty", dateKey: "2026-08-25", votedUserId: gioId },
        { surveyKey: "most_flirty", dateKey: "2026-08-26", votedUserId: gioId },
        { surveyKey: "most_flirty", dateKey: "2026-08-27", votedUserId: jereId },
        { surveyKey: "most_flirty", dateKey: "2026-08-28", votedUserId: gioId },
        { surveyKey: "most_flirty", dateKey: "2026-08-29", votedUserId: gioId },
        { surveyKey: "most_flirty", dateKey: "2026-08-30", votedUserId: gioId },
        { surveyKey: "most_flirty", dateKey: "2026-08-31", votedUserId: gioId },
      ],
      previaParticipants: [],
    });

    assert.deepEqual(stats.streaks.mostFlirtyVote, [
      { userId: gioId, value: 4 },
      { userId: jereId, value: 1 },
    ]);
  });

  it("counts one-day outfit survey streaks", () => {
    const stats = calculateStats("total", {
      users: [
        { id: gioId, legacyId: "gio", displayName: "Gio" },
        { id: jereId, legacyId: "jere", displayName: "Jere" },
      ],
      expenses: [],
      dailyEntries: [],
      surveyVotes: [{ surveyKey: "best_outfit", dateKey: "2026-08-24", votedUserId: jereId }],
      previaParticipants: [],
    });

    assert.deepEqual(stats.streaks.bestOutfitVote, [{ userId: jereId, value: 1 }]);
  });

  it("keeps and surpasses historical best outfit survey streaks", () => {
    const stats = calculateStats("total", {
      users: [
        { id: gioId, legacyId: "gio", displayName: "Gio" },
        { id: jereId, legacyId: "jere", displayName: "Jere" },
        { id: laraId, legacyId: "lara", displayName: "Lara" },
      ],
      expenses: [],
      dailyEntries: [],
      surveyVotes: [
        { surveyKey: "best_outfit", dateKey: "2026-08-24", votedUserId: laraId },
        { surveyKey: "best_outfit", dateKey: "2026-08-25", votedUserId: laraId },
        { surveyKey: "best_outfit", dateKey: "2026-08-26", votedUserId: laraId },
        { surveyKey: "best_outfit", dateKey: "2026-08-27", votedUserId: gioId },
        { surveyKey: "best_outfit", dateKey: "2026-08-28", votedUserId: laraId },
        { surveyKey: "best_outfit", dateKey: "2026-08-29", votedUserId: laraId },
        { surveyKey: "best_outfit", dateKey: "2026-08-30", votedUserId: laraId },
        { surveyKey: "best_outfit", dateKey: "2026-08-31", votedUserId: laraId },
      ],
      previaParticipants: [],
    });

    assert.deepEqual(stats.streaks.bestOutfitVote, [
      { userId: laraId, value: 4 },
      { userId: gioId, value: 1 },
    ]);
  });

  it("counts multiple winning votes in the same day as one streak day", () => {
    const stats = calculateStats("total", {
      users: [
        { id: gioId, legacyId: "gio", displayName: "Gio" },
        { id: jereId, legacyId: "jere", displayName: "Jere" },
      ],
      expenses: [],
      dailyEntries: [],
      surveyVotes: [
        { surveyKey: "most_flirty", dateKey: "2026-08-24", votedUserId: gioId },
        { surveyKey: "most_flirty", dateKey: "2026-08-24", votedUserId: gioId },
        { surveyKey: "best_outfit", dateKey: "2026-08-24", votedUserId: jereId },
        { surveyKey: "best_outfit", dateKey: "2026-08-24", votedUserId: jereId },
      ],
      previaParticipants: [],
    });

    assert.deepEqual(stats.streaks.mostFlirtyVote, [{ userId: gioId, value: 1 }]);
    assert.deepEqual(stats.streaks.bestOutfitVote, [{ userId: jereId, value: 1 }]);
  });

  it("counts daily ties for both new survey streaks and returns tied maxima", () => {
    const stats = calculateStats("total", {
      users: [
        { id: gioId, legacyId: "gio", displayName: "Gio" },
        { id: jereId, legacyId: "jere", displayName: "Jere" },
        { id: laraId, legacyId: "lara", displayName: "Lara" },
      ],
      expenses: [],
      dailyEntries: [],
      surveyVotes: [
        { surveyKey: "best_outfit", dateKey: "2026-08-24", votedUserId: gioId },
        { surveyKey: "best_outfit", dateKey: "2026-08-24", votedUserId: jereId },
        { surveyKey: "best_outfit", dateKey: "2026-08-25", votedUserId: gioId },
        { surveyKey: "best_outfit", dateKey: "2026-08-25", votedUserId: jereId },
        { surveyKey: "most_flirty", dateKey: "2026-08-24", votedUserId: gioId },
        { surveyKey: "most_flirty", dateKey: "2026-08-24", votedUserId: jereId },
        { surveyKey: "most_flirty", dateKey: "2026-08-25", votedUserId: gioId },
        { surveyKey: "most_flirty", dateKey: "2026-08-25", votedUserId: jereId },
      ],
      previaParticipants: [],
    });

    assert.deepEqual(stats.streaks.bestOutfitVote, [
      { userId: gioId, value: 2 },
      { userId: jereId, value: 2 },
    ]);
    assert.deepEqual(stats.streaks.mostFlirtyVote, [
      { userId: gioId, value: 2 },
      { userId: jereId, value: 2 },
    ]);
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
    assert.deepEqual(stats.dailyEntries.closedClubs, []);
    assert.deepEqual(stats.surveys.destroyed_vote, []);
    assert.deepEqual(stats.surveys.most_flirty, []);
    assert.deepEqual(stats.surveys.best_outfit, []);
    assert.deepEqual(stats.previas.byParticipant, []);
  });

  it("ignores source data that belongs only to inactive users omitted from the active user list", () => {
    const stats = calculateStats("total", {
      users: baseData().users,
      expenses: [{ userId: laraId, dateKey: "2026-08-28", category: "Alcohol", amount: 999999 }],
      dailyEntries: [entry(laraId, "2026-08-28", { bathroom: 9, fifthMeal: "yes" })],
      surveyVotes: [{ surveyKey: "destroyed_vote", dateKey: "2026-08-28", votedUserId: laraId }],
      previaParticipants: [{ previaId: "previa-inactive", userId: laraId, dateKey: "2026-08-28" }],
    });

    assert.deepEqual(stats.closedDays, []);
    assert.deepEqual(stats.money.totalSpentByUser, []);
    assert.deepEqual(stats.dailyEntries.bathroom, []);
    assert.deepEqual(stats.surveys.destroyed_vote, []);
    assert.deepEqual(stats.previas.byParticipant, []);
  });
});

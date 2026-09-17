import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clubDurationMinutes,
  isClubEntryTime,
  isRegularClubExitTime,
  nightRange,
  validateClubTimeConfig,
} from "../src/time/night-club";

describe("night club time helpers", () => {
  it("handles same-day after-midnight ranges", () => {
    const config = { openTime: "00:30", closeTime: "05:00" };
    assert.deepEqual(nightRange(config), { open: 1470, close: 1740 });
    assert.equal(isClubEntryTime("00:30", config), true);
    assert.equal(isClubEntryTime("05:00", config), false);
    assert.equal(isRegularClubExitTime("01:00", "04:50", config), true);
    assert.equal(isRegularClubExitTime("01:00", "05:00", config), false);
  });

  it("normalizes ranges that cross midnight", () => {
    const config = { openTime: "23:30", closeTime: "05:15" };
    assert.deepEqual(nightRange(config), { open: 1410, close: 1755 });
    assert.equal(isClubEntryTime("00:30", config), true);
    assert.equal(isRegularClubExitTime("00:30", "04:00", config), true);
    assert.equal(clubDurationMinutes("00:30", "05:15", config), 285);
    assert.equal(clubDurationMinutes("00:30", "04:00", config), 210);
  });

  it("keeps the legacy default range valid", () => {
    const config = { openTime: "01:00", closeTime: "06:45" };
    assert.deepEqual(nightRange(config), { open: 1500, close: 1845 });
    assert.equal(clubDurationMinutes("01:00", "06:45", config), 345);
  });

  it("supports short ranges ending after midnight", () => {
    const config = { openTime: "23:00", closeTime: "00:30" };
    assert.equal(clubDurationMinutes("23:10", "00:20", config), 70);
    assert.equal(isRegularClubExitTime("23:10", "00:30", config), false);
  });

  it("rejects invalid configuration ranges", () => {
    assert.throws(() => validateClubTimeConfig({ openTime: "01:00", closeTime: "01:00" }), /invalid_club_time_range/);
    assert.throws(() => validateClubTimeConfig({ openTime: "bad", closeTime: "05:00" }), /invalid_club_open_time/);
    assert.throws(() => validateClubTimeConfig({ openTime: "05:10", closeTime: "05:00" }), /invalid_club_time_range/);
  });
});

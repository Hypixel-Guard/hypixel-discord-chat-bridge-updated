const {
  backfillGuildMemberHistory,
  canUseReportControls,
  calculateMemberActivity,
  getDateWindow,
  getModerationRows,
  normalizeExpHistory,
  paginateLines,
  resolveKickThreshold
} = require("../src/contracts/gexpActivity.js");

describe("GEXP activity calculations", () => {
  const endDate = new Date("2026-10-30T12:00:00.000Z");

  it("uses an inclusive seven-day UTC reporting window", () => {
    expect(getDateWindow(7, endDate)).toEqual(["2026-10-24", "2026-10-25", "2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30"]);
  });

  it("calculates complete weekly activity", () => {
    const days = Object.fromEntries(getDateWindow(7, endDate).map((date, index) => [date, index * 100]));
    const activity = calculateMemberActivity(days, 7, endDate);

    expect(activity.total).toBe(2100);
    expect(activity.activeDays).toBe(6);
    expect(activity.inactiveDays).toBe(1);
    expect(activity.recordedDays).toBe(7);
    expect(activity.missingDays).toBe(0);
    expect(activity.averageDaily).toBe(300);
  });

  it("does not treat missing bi-weekly and monthly records as zero", () => {
    const days = { "2026-10-29": 500, "2026-10-30": 0 };
    const biweekly = calculateMemberActivity(days, 14, endDate);
    const monthly = calculateMemberActivity(days, 30, endDate);

    expect(biweekly).toMatchObject({ total: 500, activeDays: 1, inactiveDays: 1, recordedDays: 2, missingDays: 12, averageDaily: 250 });
    expect(monthly).toMatchObject({ total: 500, activeDays: 1, inactiveDays: 1, recordedDays: 2, missingDays: 28, averageDaily: 250 });
  });

  it("backfill normalization ignores malformed dates and negative GEXP", () => {
    expect(normalizeExpHistory({ "2026-10-30": 123, invalid: 999, "2026-10-29": -1 })).toEqual({ "2026-10-30": 123 });
  });

  it("backfills recent API history without deleting members who have left", () => {
    const members = {
      departed: { username: "FormerMember", days: { "2026-10-01": 99 }, lastSeenAt: "2026-10-01T00:00:00.000Z" }
    };

    backfillGuildMemberHistory(members, [{ uuid: "current", expHistory: { "2026-10-30": 250 } }], "2026-10-30T12:00:00.000Z");

    expect(members.departed.days).toEqual({ "2026-10-01": 99 });
    expect(members.current).toEqual({ username: null, days: { "2026-10-30": 250 }, lastSeenAt: "2026-10-30T12:00:00.000Z" });
  });

  it("uses configured thresholds unless a moderator provides an override", () => {
    const defaults = { daily: 7000, weekly: 50000, biweekly: 100000, monthly: 200000 };
    expect(resolveKickThreshold("daily", null, defaults)).toBe(7000);
    expect(resolveKickThreshold("weekly", null, defaults)).toBe(50000);
    expect(resolveKickThreshold("weekly", 45000, defaults)).toBe(45000);
    expect(() => resolveKickThreshold("weekly", -1, defaults)).toThrow(RangeError);
  });

  it("filters only complete-history members below the threshold and sorts lowest first", () => {
    const activity = (total, recordedDays = 7) => ({ total, recordedDays });
    const rows = [
      { uuid: "above", username: "Above", activity: activity(60000) },
      { uuid: "exact", username: "Exact", activity: activity(50000) },
      { uuid: "low", username: "Low", activity: activity(30000) },
      { uuid: "lower", username: "Lower", activity: activity(10000) },
      { uuid: "incomplete", username: "Incomplete", activity: activity(0, 3) }
    ];
    const moderation = getModerationRows(rows, 50000, 7);

    expect(moderation.belowRows.map((row) => row.uuid)).toEqual(["lower", "low"]);
    expect(moderation.meetingRows.map((row) => row.uuid)).toEqual(["above", "exact"]);
    expect(moderation.incompleteRows.map((row) => row.uuid)).toEqual(["incomplete"]);
  });

  it("paginates both ranking and moderation lines without exceeding the requested size", () => {
    const pages = paginateLines(["a".repeat(8), "b".repeat(8), "c".repeat(8)], 16);
    expect(pages).toEqual(["a".repeat(16), "c".repeat(8)]);
  });

  it("allows report controls only for the command invoker or an authorized moderator", () => {
    expect(canUseReportControls("owner", "owner", false)).toBe(true);
    expect(canUseReportControls("owner", "staff", true)).toBe(true);
    expect(canUseReportControls("owner", "other", false)).toBe(false);
  });
});

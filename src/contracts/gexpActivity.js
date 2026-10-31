const TIMEFRAMES = {
  daily: { days: 1, label: "Daily" },
  weekly: { days: 7, label: "Weekly" },
  biweekly: { days: 14, label: "Bi-weekly" },
  monthly: { days: 30, label: "Monthly" }
};

function toUtcDateKey(date) {
  return date.toISOString().slice(0, 10);
}

function getDateWindow(days, endDate = new Date()) {
  const end = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()));
  const dates = [];

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(end);
    date.setUTCDate(end.getUTCDate() - offset);
    dates.push(toUtcDateKey(date));
  }

  return dates;
}

function normalizeExpHistory(expHistory) {
  if (!expHistory || typeof expHistory !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(expHistory)
      .filter(([date, value]) => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Number(value)) && Number(value) >= 0)
      .map(([date, value]) => [date, Number(value)])
  );
}

function backfillGuildMemberHistory(members, guildMembers, seenAt) {
  for (const member of guildMembers) {
    if (!member.uuid) {
      continue;
    }

    const entry = members[member.uuid] ?? { username: null, days: {}, lastSeenAt: null };
    entry.days ??= {};
    Object.assign(entry.days, normalizeExpHistory(member.expHistory));
    entry.lastSeenAt = seenAt;
    members[member.uuid] = entry;
  }

  return members;
}

function calculateMemberActivity(days, timeframeDays, endDate = new Date()) {
  const dates = getDateWindow(timeframeDays, endDate);
  const history = days ?? {};
  const recordedValues = dates.filter((date) => Object.hasOwn(history, date)).map((date) => Number(history[date]));
  const total = recordedValues.reduce((sum, value) => sum + value, 0);
  const activeDays = recordedValues.filter((value) => value > 0).length;
  const inactiveDays = recordedValues.filter((value) => value === 0).length;

  return {
    total,
    activeDays,
    inactiveDays,
    recordedDays: recordedValues.length,
    missingDays: timeframeDays - recordedValues.length,
    averageDaily: recordedValues.length === 0 ? null : total / recordedValues.length,
    startDate: dates[0],
    endDate: dates.at(-1)
  };
}

function getEarliestRecordedDate(members) {
  const dates = Object.values(members)
    .flatMap((member) => Object.keys(member.days ?? {}))
    .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))
    .sort();

  return dates[0] ?? null;
}

function resolveKickThreshold(timeframe, override, kickThresholds) {
  const threshold = override ?? kickThresholds?.[timeframe];
  const value = Number(threshold);
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError("The GEXP threshold must be a non-negative number.");
  }

  return value;
}

function getModerationRows(rows, threshold, timeframeDays) {
  const completeRows = rows.filter((row) => row.activity.recordedDays === timeframeDays);
  const incompleteRows = rows.filter((row) => row.activity.recordedDays !== timeframeDays);
  const belowRows = completeRows
    .filter((row) => row.activity.total < threshold)
    .sort((left, right) => left.activity.total - right.activity.total || (left.username ?? left.uuid).localeCompare(right.username ?? right.uuid));
  const meetingRows = completeRows.filter((row) => row.activity.total >= threshold);

  return { belowRows, completeRows, incompleteRows, meetingRows };
}

function paginateLines(lines, maximumLength = 3500) {
  const pages = [];
  let page = "";

  for (const line of lines) {
    if (page.length + line.length > maximumLength && page.length > 0) {
      pages.push(page);
      page = "";
    }
    page += line;
  }

  if (page.length > 0) {
    pages.push(page);
  }

  return pages;
}

function canUseReportControls(ownerId, userId, isModerator) {
  return ownerId === userId || isModerator === true;
}

module.exports = {
  TIMEFRAMES,
  backfillGuildMemberHistory,
  canUseReportControls,
  calculateMemberActivity,
  getDateWindow,
  getEarliestRecordedDate,
  getModerationRows,
  normalizeExpHistory,
  paginateLines,
  resolveKickThreshold,
  toUtcDateKey
};

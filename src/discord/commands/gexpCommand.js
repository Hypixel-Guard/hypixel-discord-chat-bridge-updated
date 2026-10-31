const HypixelDiscordChatBridgeError = require("../../contracts/errorHandler.js");
const { Embed } = require("../../contracts/embedHandler.js");
const {
  TIMEFRAMES,
  canUseReportControls,
  calculateMemberActivity,
  getEarliestRecordedDate,
  getModerationRows,
  paginateLines,
  resolveKickThreshold
} = require("../../contracts/gexpActivity.js");
const { populateUsernames, refreshGexpHistory } = require("../../minecraft/other/gexpTracker.js");
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const config = require("../../../config.json");
const { randomUUID } = require("crypto");

const SESSION_DURATION_MS = 15 * 60 * 1000;
const sessions = new Map();

function formatNumber(number) {
  return Math.round(number).toLocaleString("en-US");
}

function safeUsername(username, uuid) {
  return (username ?? uuid.slice(0, 8)).replace(/[\\`*_~|]/g, "\\$&");
}

function activityIndicator(activity, thresholds) {
  if (activity.recordedDays === 0) return "⚪";
  if (activity.averageDaily >= thresholds.high) return "🟢";
  if (activity.averageDaily >= thresholds.moderate) return "🟡";
  if (activity.averageDaily > 0) return "🟠";
  return "🔴";
}

function buildAllLines(rows, timeframeDays) {
  return rows.map(
    (row) =>
      `${row.rank}. ${row.indicator} **${safeUsername(row.username, row.uuid)}** — ${formatNumber(row.activity.total)} | ${
        row.activity.averageDaily === null ? "—" : `${formatNumber(row.activity.averageDaily)}/day`
      } | ${row.activity.activeDays} active, ${row.activity.inactiveDays} inactive | ${row.activity.recordedDays}/${timeframeDays} recorded\n`
  );
}

function buildBelowLines(rows, threshold, timeframeDays) {
  return rows.map(
    (row, index) =>
      `${index + 1}. **${safeUsername(row.username, row.uuid)}** — ${formatNumber(row.activity.total)}/${formatNumber(threshold)} | ${formatNumber(
        threshold - row.activity.total
      )} below | ${row.activity.activeDays} active days | ${row.activity.recordedDays}/${timeframeDays} recorded\n`
  );
}

function createSession(data) {
  const id = randomUUID();
  const session = { ...data, id, view: "all", page: 0, expiresAt: Date.now() + SESSION_DURATION_MS };
  sessions.set(id, session);
  const expiration = setTimeout(() => sessions.delete(id), SESSION_DURATION_MS);
  expiration.unref();
  return session;
}

function buildSummary(session) {
  const { belowRows, completeRows, incompleteRows, meetingRows } = getModerationRows(session.rows, session.threshold, session.timeframe.days);
  const totalGexp = session.rows.reduce((total, row) => total + row.activity.total, 0);
  const recordedMemberDays = session.rows.reduce((total, row) => total + row.activity.recordedDays, 0);
  const expectedMemberDays = session.rows.length * session.timeframe.days;
  const percentageMeeting = completeRows.length === 0 ? 0 : (meetingRows.length / completeRows.length) * 100;

  return new Embed()
    .setTitle(`${session.guildName} ${session.timeframe.label} GEXP Activity`)
    .setDescription(
      `**Period (UTC):** ${session.startDate} to ${session.endDate}\n` +
        `**Required GEXP:** ${formatNumber(session.threshold)}\n` +
        `**Guild GEXP (recorded):** ${formatNumber(totalGexp)}\n` +
        `**Members included:** ${session.rows.length}\n` +
        `**Average per member:** ${formatNumber(session.rows.length === 0 ? 0 : totalGexp / session.rows.length)}\n` +
        `**Data coverage:** ${recordedMemberDays}/${expectedMemberDays} member-days\n` +
        `**Tracking since:** ${session.earliestDate ?? "No historical data recorded"}\n\n` +
        `**Meeting requirement:** ${meetingRows.length}/${completeRows.length} complete-history members (${percentageMeeting.toFixed(1)}%)\n` +
        `**Below requirement:** ${belowRows.length}\n` +
        `**Insufficient history:** ${incompleteRows.length}\n\n` +
        `🟢 High · 🟡 Moderate · 🟠 Low · 🔴 No recorded GEXP · ⚪ No data\n` +
        (recordedMemberDays < expectedMemberDays
          ? "Incomplete records are excluded from below-threshold moderation results."
          : "All member-days in this reporting period have recorded data.")
    );
}

function getView(session) {
  const moderation = getModerationRows(session.rows, session.threshold, session.timeframe.days);
  if (session.view === "below") {
    return {
      title: `Below Threshold (${moderation.belowRows.length} members)`,
      pages: paginateLines(buildBelowLines(moderation.belowRows, session.threshold, session.timeframe.days)),
      empty: "No members with complete historical coverage are below the selected GEXP requirement."
    };
  }

  return {
    title: "All Member Rankings",
    pages: paginateLines(buildAllLines(session.rows, session.timeframe.days)),
    empty: "No guild members were returned by Hypixel."
  };
}

function buildComponents(session, pageCount) {
  const isFirstPage = session.page === 0;
  const isLastPage = session.page >= pageCount - 1;
  const prefix = `gexp:${session.id}`;
  const toggle = session.view === "below" ? "all" : "below";

  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`${prefix}:previous`).setLabel("Previous").setStyle(ButtonStyle.Secondary).setDisabled(isFirstPage),
      new ButtonBuilder().setCustomId(`${prefix}:next`).setLabel("Next").setStyle(ButtonStyle.Secondary).setDisabled(isLastPage),
      new ButtonBuilder()
        .setCustomId(`${prefix}:${toggle}`)
        .setLabel(session.view === "below" ? "Show All Members" : "Below Threshold")
        .setStyle(session.view === "below" ? ButtonStyle.Primary : ButtonStyle.Danger)
    )
  ];
}

function renderSession(session) {
  const view = getView(session);
  const pageCount = Math.max(view.pages.length, 1);
  session.page = Math.min(Math.max(session.page, 0), pageCount - 1);
  const description = view.pages[session.page] ?? view.empty;
  const rankingEmbed = new Embed().setTitle(`${view.title} (${session.page + 1}/${pageCount})`).setDescription(description);

  return { embeds: [buildSummary(session), rankingEmbed], components: buildComponents(session, pageCount) };
}

function isGexpButton(customId) {
  return customId.startsWith("gexp:");
}

module.exports = {
  name: "gexp",
  description: "Report guild member GEXP activity.",
  moderatorOnly: true,
  requiresBot: true,
  options: [
    {
      type: 3,
      name: "timeframe",
      description: "Reporting period",
      required: true,
      choices: [
        { name: "Daily (1 day)", value: "daily" },
        { name: "Weekly (7 days)", value: "weekly" },
        { name: "Bi-weekly (14 days)", value: "biweekly" },
        { name: "Monthly (30 days)", value: "monthly" }
      ]
    },
    {
      type: 4,
      name: "threshold",
      description: "Override the configured required GEXP",
      min_value: 0,
      required: false
    }
  ],

  execute: async (interaction) => {
    const timeframeKey = interaction.options.getString("timeframe");
    const timeframe = TIMEFRAMES[timeframeKey];
    if (!timeframe) {
      throw new HypixelDiscordChatBridgeError("Please choose daily, weekly, bi-weekly, or monthly.");
    }

    let threshold;
    try {
      threshold = resolveKickThreshold(timeframeKey, interaction.options.getInteger("threshold"), config.minecraft.gexpTracking?.kickThresholds);
    } catch {
      throw new HypixelDiscordChatBridgeError("The selected GEXP threshold must be a non-negative number.");
    }

    let guild;
    let history;
    try {
      ({ guild, history } = await refreshGexpHistory());
      await populateUsernames(guild.members, history);
    } catch (error) {
      if (error instanceof HypixelDiscordChatBridgeError) {
        throw error;
      }
      console.error(error);
      throw new HypixelDiscordChatBridgeError("Unable to prepare the GEXP activity report. Please try again later.");
    }

    const activityThresholds = config.minecraft.gexpTracking?.activityThresholds ?? { high: 10000, moderate: 3000 };
    const rows = guild.members
      .map((member) => {
        const activity = calculateMemberActivity(history.members[member.uuid]?.days, timeframe.days);
        return { uuid: member.uuid, username: history.members[member.uuid]?.username, activity, indicator: activityIndicator(activity, activityThresholds) };
      })
      .sort((left, right) => right.activity.total - left.activity.total || (left.username ?? left.uuid).localeCompare(right.username ?? right.uuid))
      .map((row, index) => ({ ...row, rank: index + 1 }));

    const reportActivity = rows[0]?.activity ?? calculateMemberActivity({}, timeframe.days);
    const session = createSession({
      ownerId: interaction.user.id,
      guildName: guild.name,
      timeframe,
      threshold,
      rows,
      startDate: reportActivity.startDate,
      endDate: reportActivity.endDate,
      earliestDate: getEarliestRecordedDate(history.members)
    });

    await interaction.editReply(renderSession(session));
  },

  async handleButton(interaction, isModerator) {
    const [, sessionId, action] = interaction.customId.split(":");
    const session = sessions.get(sessionId);
    if (!session || session.expiresAt < Date.now()) {
      sessions.delete(sessionId);
      await interaction.reply({ content: "This GEXP report has expired. Run /gexp again to create a new report.", ephemeral: true });
      return;
    }

    if (!canUseReportControls(session.ownerId, interaction.user.id, isModerator)) {
      await interaction.reply({ content: "Only the report creator or authorized guild staff can use these controls.", ephemeral: true });
      return;
    }

    if (action === "previous") session.page -= 1;
    if (action === "next") session.page += 1;
    if (action === "below" || action === "all") {
      session.view = action;
      session.page = 0;
    }

    await interaction.update(renderSession(session));
  },

  activityIndicator,
  buildAllLines,
  buildBelowLines,
  isGexpButton,
  renderSession
};

const fs = require("fs");
const path = require("path");
const minecraftCommand = require("../../contracts/minecraftCommand.js");
const config = require("../../../config.json");

const DATA_DIR = path.resolve("./data");
const LEADERBOARD_FILE = path.join(DATA_DIR, "mathtest.json");
const DEFAULT_QUESTIONS = 10;
const MAX_QUESTIONS = 25;
const LEADERBOARD_SIZE = 10;
const DIFFICULTIES = ["normal", "hard"];
const LEADERBOARD_VERSION = 2;

// I don't have much experience with discord stuff, so note that handleDiscordMessage() and related were developed by AI though I examined and tripled checked.

class MathTestCommand extends minecraftCommand {
  /** @param {import("minecraft-protocol").Client} minecraft */
  constructor(minecraft) {
    super(minecraft);
    this.name = "mathtest";
    this.aliases = ["mt"];
    this.description = "Start the mental maths challenge.";
    this.options = [
      {
        name: "action",
        description: "normal, hard, leaderboard or cancel",
        required: true
      },
      {
        name: "questions",
        description: "Number of questions (1-25)",
        required: false
      }
    ];

    this.games = new Map();
    this.leaderboards = this.loadLeaderboards();
    this.discordClient = null;
    this.discordMessageListener = (message) =>
      this.handleDiscordMessage(message);
  }

  async onCommand(player, message) {
    const officer = Boolean(this.officer);
    this.attachDiscordListener();

    const args = this.getArgs(message).filter(Boolean);
    const action = (args[0] || "").toLowerCase();

    if (action === "leaderboard" || action === "lb") {
      if (args.length > 2) {
        return this.sendResponse(this.getUsage(), officer);
      }

      const difficulty = args[1] ? args[1].toLowerCase() : undefined;

      if (
        difficulty !== undefined &&
        !DIFFICULTIES.includes(difficulty)
      ) {
        return this.sendResponse(this.getUsage(), officer);
      }

      return this.showLeaderboard(difficulty, officer);
    }

    if (action === "cancel") {
      if (args.length !== 1) {
        return this.sendResponse(this.getUsage(), officer);
      }

      const channelId = this.getChannelId(officer);
      const game = channelId ? this.games.get(channelId) : null;

      if (!game) {
        return this.sendResponse(
          "There isn't a math test running in this channel.",
          officer
        );
      }

      if (game.hostKey !== this.normalizeName(player)) {
        return this.sendResponse(
          "Only the person who started this game can cancel it.",
          officer
        );
      }

      game.finished = true;
      game.acceptingAnswers = false;
      this.games.delete(game.channelId);

      return this.sendResponse(
        `The ${this.titleCase(game.difficulty)} math test was cancelled. No final results were recorded.`,
        officer
      );
    }

    if (!DIFFICULTIES.includes(action) || args.length > 2) {
      return this.sendResponse(this.getUsage(), officer);
    }

    const questionCount =
      args[1] === undefined ? DEFAULT_QUESTIONS : Number(args[1]);

    if (
      !Number.isInteger(questionCount) ||
      questionCount < 1 ||
      questionCount > MAX_QUESTIONS ||
      (args[1] !== undefined && !/^\d+$/.test(args[1]))
    ) {
      return this.sendResponse(this.getUsage(), officer);
    }

    if (!this.discordClient) {
      return this.sendResponse(
        "Discord isn't connected, so a the game can't start.",
        officer
      );
    }

    return this.startGame(player, action, questionCount, officer);
  }

  getUsage() {
    const prefix = config.minecraft?.bot?.prefix || "!";

    return [
      `Usage: ${prefix}mathtest <normal|hard|leaderboard|cancel> [n]`,
      "Normal: 1-digit addition/subtraction. Hard: 2-digit addition/subtraction.",
      `n = 1-${MAX_QUESTIONS} questions (default ${DEFAULT_QUESTIONS}).`,
      "Leaderboard: [normal|hard]. The first correct answer earns a point."
    ].join(" ");
  }

  attachDiscordListener() {
    const currentClient = global.client;

    if (!currentClient || typeof currentClient.on !== "function") {
      return false;
    }

    if (this.discordClient === currentClient) {
      return true;
    }

    if (
      this.discordClient &&
      typeof this.discordClient.removeListener === "function"
    ) {
      this.discordClient.removeListener(
        "messageCreate",
        this.discordMessageListener
      );
    }

    this.discordClient = currentClient;
    currentClient.on("messageCreate", this.discordMessageListener);

    return true;
  }

  getChannelId(officer) {
    const channels = config.discord?.channels || {};
    const channelId = officer
      ? channels.officerChannel
      : channels.guildChatChannel;

    return channelId ? String(channelId) : null;
  }

  async getDiscordChannel(channelId) {
    const client = this.discordClient || global.client;

    if (!client?.channels) {
      return null;
    }

    let channel = client.channels.cache?.get(String(channelId));

    if (!channel && typeof client.channels.fetch === "function") {
      try {
        channel = await client.channels.fetch(String(channelId));
      } catch (error) {
        console.error("Couldn't fetch the math test channel:", error);
      }
    }

    return channel && typeof channel.send === "function"
      ? channel
      : null;
  }

  async sendToDiscord(channelId, content) {
    const channel = await this.getDiscordChannel(channelId);

    if (!channel) {
      return false;
    }

    try {
      await channel.send({
        content,
        allowedMentions: { parse: [] }
      });

      return true;
    } catch (error) {
      console.error("Couldn't send a math test message:", error);
      return false;
    }
  }

  async sendResponse(message, officer) {
    const channelId = this.getChannelId(officer);

    if (
      channelId &&
      await this.sendToDiscord(channelId, message)
    ) {
      return;
    }

    return this.sendInMinecraftChat(message, officer);
  }

  async sendInMinecraftChat(message, officer) {
    const sender = Object.create(this);
    sender.officer = Boolean(officer);

    return sender.send(message);
  }

  async startGame(player, difficulty, questionCount, officer) {
    const channelId = this.getChannelId(officer);

    if (!channelId) {
      return this.sendInMinecraftChat(
        "The Discord channel for this chat isn't configured.",
        officer
      );
    }

    if (this.games.has(channelId)) {
      return this.sendResponse(
        "A math test is already running in this channel. Please wait or instead use `!mathtest cancel`.",
        officer
      );
    }

    const game = {
      channelId,
      hostKey: this.normalizeName(player),
      difficulty,
      questionCount,
      questionIndex: 0,
      question: this.createQuestion(difficulty),
      scores: new Map(),
      acceptingAnswers: false,
      finished: false,
      officer: Boolean(officer)
    };

    this.games.set(channelId, game);

    const channel = await this.getDiscordChannel(channelId);

    if (this.games.get(channelId) !== game || game.finished) {
      return;
    }

    if (!channel) {
      this.games.delete(channelId);

      return this.sendInMinecraftChat(
        "Couldn't access the configured Discord channel. Check the channel ID and bot permissions.",
        officer
      );
    }

    const started = await this.sendToDiscord(
      channelId,
      [
        `**Mental Maths: ${this.titleCase(difficulty)}**`,
        "First correct answer earns **1 point**.",
        `**Question 1/${questionCount}:** \`${game.question.expression} = ?\``
      ].join("\n")
    );

    if (this.games.get(channelId) !== game || game.finished) {
      return;
    }

    if (!started) {
      this.games.delete(channelId);

      return this.sendInMinecraftChat(
        "Couldn't post the first math question to Discord. Check the bot's channel permissions.",
        officer
      );
    }

    game.acceptingAnswers = true;
  }

  handleDiscordMessage(message) {
    if (
      !message ||
      !message.guild ||
      !message.channel?.id ||
      !message.author?.id ||
      message.author.bot ||
      message.webhookId
    ) {
      return;
    }

    const game = this.games.get(String(message.channel.id));

    if (!game || game.finished || !game.acceptingAnswers) {
      return;
    }

    const answerText =
      typeof message.content === "string"
        ? message.content.trim()
        : "";

    if (!/^-?\d+$/.test(answerText)) {
      return;
    }

    const answer = Number(answerText);

    if (
      !Number.isSafeInteger(answer) ||
      answer !== game.question.answer
    ) {
      return;
    }

    const userId = String(message.author.id);
    const username = this.getDiscordUsername(message);
    const previousScore = game.scores.get(userId);

    game.acceptingAnswers = false;

    game.scores.set(userId, {
      userId,
      username,
      points: (previousScore?.points || 0) + 1
    });

    this.recordPoint(game.difficulty, userId, username);

    this.advanceGame(game, userId).catch((error) => {
      console.error("Math test round failed:", error);

      game.finished = true;
      game.acceptingAnswers = false;

      if (this.games.get(game.channelId) === game) {
        this.games.delete(game.channelId);
      }
    });
  }

  async advanceGame(game, winnerId) {
    if (
      this.games.get(game.channelId) !== game ||
      game.finished
    ) {
      return;
    }

    const completedQuestion = game.questionIndex + 1;
    const currentScore =
      game.scores.get(winnerId)?.points || 0;

    if (completedQuestion >= game.questionCount) {
      game.questionIndex = completedQuestion;

      return this.finishGame(
        game,
        winnerId,
        currentScore
      );
    }

    game.questionIndex = completedQuestion;
    game.question = this.createQuestion(game.difficulty);

    const message = [
      `✅ <@${winnerId}> got it! **+1 point** (game score: ${currentScore}).`,
      `**Question ${game.questionIndex + 1}/${game.questionCount}:** \`${game.question.expression} = ?\``
    ].join("\n");

    const sent = await this.sendToDiscord(
      game.channelId,
      message
    );

    if (!sent) {
      game.finished = true;

      if (this.games.get(game.channelId) === game) {
        this.games.delete(game.channelId);
      }

      return;
    }

    if (
      this.games.get(game.channelId) === game &&
      !game.finished
    ) {
      game.acceptingAnswers = true;
    }
  }

  async finishGame(game, lastWinnerId, lastWinnerScore) {
    game.finished = true;
    game.acceptingAnswers = false;

    if (this.games.get(game.channelId) === game) {
      this.games.delete(game.channelId);
    }

    const results = [...game.scores.values()].sort(
      (a, b) =>
        b.points - a.points ||
        a.username.localeCompare(b.username)
    );

    const highestScore = results[0]?.points || 0;

    const winners = results.filter(
      (entry) =>
        entry.points === highestScore &&
        highestScore > 0
    );

    for (const entry of results) {
      const saved = this.getScoreEntry(
        game.difficulty,
        entry.userId,
        entry.username
      );

      saved.gamesPlayed += 1;

      if (
        winners.some(
          (winner) => winner.userId === entry.userId
        )
      ) {
        saved.gamesWon += 1;
      }

      saved.lastPlayed = new Date().toISOString();
    }

    this.saveLeaderboardsSafely();

    const lines = results
      .slice(0, LEADERBOARD_SIZE)
      .map(
        (entry, index) =>
          `${index + 1}. <@${entry.userId}> — ${entry.points} point${entry.points === 1 ? "" : "s"}`
      );

    const resultMessage = [
      `<@${lastWinnerId}> got the final answer and earned **+1 point** (game score: ${lastWinnerScore}).`,
      `**${this.titleCase(game.difficulty)} Math Test: Final Results**`,
      `Questions: ${game.questionCount}`,
      lines.length ? lines.join("\n") : "No points were scored.",
      results.length > LEADERBOARD_SIZE
        ? `_Showing the top ${LEADERBOARD_SIZE} players._`
        : "",
      `Use \`${config.minecraft?.bot?.prefix || "!"}mathtest leaderboard${game.difficulty ? ` ${game.difficulty}` : ""}\` for the lifetime leaderboard.`
    ]
      .filter(Boolean)
      .join("\n");

    const sent = await this.sendToDiscord(
      game.channelId,
      resultMessage
    );

    if (!sent) {
      console.error(
        `Couldn't send final math test results to Discord channel ${game.channelId}.`
      );
    }
  }

  createQuestion(difficulty) {
    const min = difficulty === "normal" ? 1 : 10;
    const max = difficulty === "normal" ? 9 : 99;

    const left = this.randomInt(min, max);
    const right = this.randomInt(min, max);
    const operator =
      Math.random() < 0.5 ? "+" : "-";

    return {
      expression: `${left} ${operator} ${right}`,
      answer:
        operator === "+"
          ? left + right
          : left - right
    };
  }

  randomInt(min, max) {
    return (
      Math.floor(Math.random() * (max - min + 1)) +
      min
    );
  }

  titleCase(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  getDiscordUsername(message) {
    const username =
      message.member?.displayName ||
      message.author.globalName ||
      message.author.username ||
      "Player";

    return String(username)
      .replace(/[\r\n]/g, "")
      .slice(0, 64);
  }

  normalizeName(value) {
    return String(value || "")
      .replace(/\s+/g, "")
      .toLowerCase();
  }

  loadLeaderboards() {
    const empty = {
      version: LEADERBOARD_VERSION,
      normal: {},
      hard: {}
    };

    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });

      if (!fs.existsSync(LEADERBOARD_FILE)) {
        return empty;
      }

      const saved = JSON.parse(
        fs.readFileSync(LEADERBOARD_FILE, "utf8")
      );

      if (
        saved &&
        saved.version === LEADERBOARD_VERSION
      ) {
        return {
          version: LEADERBOARD_VERSION,
          normal: this.cleanScoreEntries(saved.normal),
          hard: this.cleanScoreEntries(saved.hard),
          ...(saved.legacyTimes
            ? { legacyTimes: saved.legacyTimes }
            : {})
        };
      }

      if (
        saved &&
        typeof saved === "object" &&
        (saved.normal || saved.hard)
      ) {
        return {
          ...empty,
          legacyTimes: {
            normal: saved.normal || {},
            hard: saved.hard || {}
          }
        };
      }
    } catch (error) {
      console.error(
        "Failed to load math test leaderboard:",
        error
      );
    }

    return empty;
  }

  cleanScoreEntries(entries) {
    if (
      !entries ||
      typeof entries !== "object" ||
      Array.isArray(entries)
    ) {
      return {};
    }

    const cleaned = {};

    for (const [userId, entry] of Object.entries(entries)) {
      if (
        !entry ||
        typeof entry !== "object" ||
        typeof entry.username !== "string" ||
        !Number.isFinite(entry.points) ||
        entry.points < 0
      ) {
        continue;
      }

      cleaned[userId] = {
        userId,
        username: entry.username,
        points: Math.floor(entry.points),
        gamesPlayed:
          Number.isFinite(entry.gamesPlayed) &&
          entry.gamesPlayed >= 0
            ? Math.floor(entry.gamesPlayed)
            : 0,
        gamesWon:
          Number.isFinite(entry.gamesWon) &&
          entry.gamesWon >= 0
            ? Math.floor(entry.gamesWon)
            : 0,
        ...(typeof entry.lastPlayed === "string"
          ? { lastPlayed: entry.lastPlayed }
          : {})
      };
    }

    return cleaned;
  }

  saveLeaderboards() {
    fs.mkdirSync(DATA_DIR, { recursive: true });

    const temporaryFile =
      `${LEADERBOARD_FILE}.${process.pid}.tmp`;

    fs.writeFileSync(
      temporaryFile,
      JSON.stringify(this.leaderboards, null, 2),
      "utf8"
    );

    fs.renameSync(temporaryFile, LEADERBOARD_FILE);
  }

  saveLeaderboardsSafely() {
    try {
      this.saveLeaderboards();
      return true;
    } catch (error) {
      console.error(
        "Failed to save math test leaderboard:",
        error
      );

      return false;
    }
  }

  getScoreEntry(difficulty, userId, username) {
    const board = this.leaderboards[difficulty];

    if (!board[userId]) {
      board[userId] = {
        userId,
        username,
        points: 0,
        gamesPlayed: 0,
        gamesWon: 0
      };
    }

    board[userId].username = username;

    return board[userId];
  }

  recordPoint(difficulty, userId, username) {
    const entry = this.getScoreEntry(
      difficulty,
      userId,
      username
    );

    entry.points += 1;
    entry.lastPlayed = new Date().toISOString();

    this.saveLeaderboardsSafely();
  }

  async showLeaderboard(difficulty, officer) {
    const channelId = this.getChannelId(officer);

    if (!channelId) {
      return this.sendInMinecraftChat(
        "The Discord channel for this chat isn't configured.",
        officer
      );
    }

    const modes = difficulty
      ? [difficulty]
      : DIFFICULTIES;

    for (const mode of modes) {
      const entries = Object.values(
        this.leaderboards[mode] || {}
      )
        .filter(
          (entry) =>
            entry &&
            typeof entry.userId === "string" &&
            Number.isFinite(entry.points)
        )
        .sort(
          (a, b) =>
            b.points - a.points ||
            b.gamesWon - a.gamesWon ||
            a.username.localeCompare(b.username)
        )
        .slice(0, LEADERBOARD_SIZE);

      const lines = entries.map((entry, index) => {
        const wins = entry.gamesWon || 0;

        return `${index + 1}. <@${entry.userId}> — ${entry.points} pts (${wins} win${wins === 1 ? "" : "s"})`;
      });

      const output = lines.length
        ? `🏆 **${this.titleCase(mode)} Lifetime Leaderboard**\n${lines.join("\n")}`
        : `🏆 **${this.titleCase(mode)} Lifetime Leaderboard**\nNo scores yet. Start a game with \`${config.minecraft?.bot?.prefix || "!"}mathtest ${mode}\`.`;

      const sent = await this.sendToDiscord(
        channelId,
        output
      );

      if (!sent) {
        await this.sendInMinecraftChat(
          `Couldn't display the ${mode} leaderboard in Discord. Check the bot's channel permissions.`,
          officer
        );

        return;
      }
    }
  }
}

module.exports = MathTestCommand;

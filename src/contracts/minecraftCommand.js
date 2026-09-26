const { splitMessage, delay, generateID } = require("./helperFunctions.js");
const { registerRelayOverride } = require("./relayOverrides.js");
const { cleanText } = require("./filter.js");
const { suppressRepeatNotice } = require("./repeatNotice.js");
const config = require("../../config.json");

/**
 * Splits a message into chunks of at most `maxLength` characters, only ever breaking on
 * `separator` so no entry gets cut in half. Falls back to breaking on spaces when a single
 * entry is longer than `maxLength` on its own.
 * @param {string} message
 * @param {number} maxLength
 * @param {string} separator
 * @returns {string[]}
 */
function splitOnSeparator(message, maxLength, separator) {
  const chunks = [];
  let current = "";

  const push = (piece, joiner) => {
    if (current.length === 0) {
      current = piece;
    } else if (current.length + joiner.length + piece.length <= maxLength) {
      current = `${current}${joiner}${piece}`;
    } else {
      chunks.push(current);
      current = piece;
    }
  };

  for (const entry of message.split(separator)) {
    if (entry.length <= maxLength) {
      push(entry, separator);
      continue;
    }

    entry.split(" ").forEach((word, index) => push(word, index === 0 ? separator : " "));
  }

  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks;
}

class minecraftCommand {
  /** @param {import("minecraft-protocol").Client} minecraft */
  constructor(minecraft) {
    this.minecraft = minecraft;
    this.officer = false;
  }

  /**
   * Returns the arguments of a message.
   * @param {string} message
   * @returns {string[]}
   * */
  getArgs(message) {
    const args = message.split(" ");

    args.shift();

    return args;
  }

  /**
   * Sends a message in the Minecraft chat.
   * @param {string} message
   * @param {number} maxRetries - Maximum number of retries (default: 5)
   * @param {boolean} isErrorMessage - Flag to prevent recursive error messages
   * @param {string | null} [relayAs] - What Discord should receive instead of this message (null = nothing). Omit for the normal relay.
   */
  async send(message, maxRetries = 5, isErrorMessage = false, relayAs = undefined) {
    if (!bot?._client?.chat) {
      return;
    }

    message = cleanText(message);
    if (typeof relayAs === "string") {
      relayAs = cleanText(relayAs);
    }

    const startTime = Date.now();
    const maxExecutionTime = 10000;

    if (message.length > 256) {
      const messages = splitMessage(message, 256);
      for (const [index, msg] of messages.entries()) {
        await delay(1000);
        await this.send(msg, maxRetries, isErrorMessage, relayAs === undefined || index === 0 ? relayAs : null);

        if (Date.now() - startTime > maxExecutionTime) {
          console.error("Message sending timed out after 10 seconds");
          return;
        }
      }
      return;
    }

    try {
      const sendMessage = async () => {
        return /** @type {Promise<void>} */ (
          new Promise((resolve, reject) => {
            const listener = async (/** @type {{ toString: () => any; }} */ msg) => {
              const msgStr = msg.toString();

              if (msgStr.includes("You are sending commands too fast!") && !msgStr.includes(":")) {
                bot.removeListener("message", listener);
                reject(new Error("rate-limited"));
              }

              if (msgStr.includes("You cannot say the same message twice!") && !msgStr.includes(":")) {
                bot.removeListener("message", listener);
                reject(new Error("duplicate-message"));
              }
            };

            bot.on("message", listener);
            suppressRepeatNotice(600);

            if (relayAs !== undefined) {
              registerRelayOverride(message, relayAs);
            }

            bot.chat(`/${this.officer ? "oc" : "gc"} ${message}`);

            setTimeout(() => {
              bot.removeListener("message", listener);
              resolve();
            }, 500);
          })
        );
      };

      const baseMessage = message;
      for (let i = 0; i < maxRetries; i++) {
        try {
          await sendMessage();
          return;
        } catch (error) {
          if (Date.now() - startTime > maxExecutionTime) {
            console.error("Message sending timed out after 10 seconds");
            return;
          }

          // @ts-ignore
          if (error.message === "rate-limited") {
            if (i === maxRetries - 1) {
              this.send(`Command failed to send message after ${maxRetries} attempts. Please try again later.`, 1);
              if (!isErrorMessage) {
                console.error(`Command failed to send message after ${maxRetries} attempts due to rate limiting.`);
              }
              return;
            }
            await delay(2000);
            continue;
          }

          // @ts-ignore
          if (error.message === "duplicate-message") {
            await delay(100);
            const randomId = generateID(config.minecraft.bot.messageRepeatBypassLength);
            const maxLength = 256 - randomId.length - 3; // -3 for space
            message = `${baseMessage.substring(0, maxLength)} - ${randomId}`;
            continue;
          }
          throw error;
        }
      }
    } catch (error) {
      console.error("Error sending message:", error);
    }
  }

  /**
   * Sends a long reply. Discord receives the whole message in one piece; Minecraft chat receives it
   * split into chunks of at most `maxLength` characters, only breaking on `separator`.
   * @param {string} message
   * @param {{ maxLength?: number, separator?: string }} [options]
   */
  async sendLong(message, { maxLength = 240, separator = " | " } = {}) {
    const chunks = splitOnSeparator(message, maxLength, separator);

    for (const [index, chunk] of chunks.entries()) {
      if (index > 0) {
        await delay(1000);
      }

      await this.send(chunk, 5, false, index === 0 ? message : null);
    }
  }

  /**
   * Executes the command.
   * @param {string} player
   * @param {string} message
   */
  onCommand(player, message) {
    throw new Error("Command onCommand method is not implemented yet!");
  }
}

module.exports = minecraftCommand;

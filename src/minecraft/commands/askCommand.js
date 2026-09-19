const minecraftCommand = require("../../contracts/minecraftCommand.js");

class AskCommand extends minecraftCommand {
  /** @param {import("minecraft-protocol").Client} minecraft */
  constructor(minecraft) {
    super(minecraft);

    this.name = "ask";
    this.aliases = ["ai", "askai"];
    this.description = "Ask the AI a question.";
    this.options = [
      {
        name: "question",
        description: "The question you want to ask.",
        required: true
      }
    ];
  }

  /**
   * @param {string} player
   * @param {string} message
   */
  async onCommand(player, message) {
    const args = this.getArgs(message);

    if (args.length === 0) {
      this.send("[ERROR] Please provide a question.");
      return;
    }

    const answer = Math.random() < 0.5 ? "✦ Couldn't get an answer right now. Try again." : "✦ AI isn't configured correctly right now.";

    this.send(answer);
  }
}

module.exports = AskCommand;
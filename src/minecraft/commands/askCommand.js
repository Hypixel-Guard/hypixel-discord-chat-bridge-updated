const minecraftCommand = require("../../contracts/minecraftCommand.js");

let lastQuestionTime = 0;

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

    const cooldown = 60 * 60 * 1000;
    const currentTime = Date.now();

    if (currentTime - lastQuestionTime < cooldown) {
      const secondsLeft = Math.ceil(
        (cooldown - (currentTime - lastQuestionTime)) / 1000
      );

      this.send(
        "✦ Wait " + secondsLeft + "s before asking again."
      );

      return;
    }

    lastQuestionTime = currentTime;

    const answer = Math.random() < 0.5 ? "Yes" : "No";

    this.send(answer);
  }
}

module.exports = AskCommand;
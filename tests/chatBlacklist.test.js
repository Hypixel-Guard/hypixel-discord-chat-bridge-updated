const { describe, it, expect, beforeEach, afterEach } = require("@jest/globals");
const fs = require("fs");

const FILE = "data/chatBlacklist.json";
const { getChatBlacklist, isChatBlacklisted, addToChatBlacklist, removeFromChatBlacklist } = require("../src/contracts/chatBlacklist.js");

describe("chatBlacklist", () => {
  let backup;
  beforeEach(() => {
    backup = fs.existsSync(FILE) ? fs.readFileSync(FILE) : null;
    if (backup !== null) fs.rmSync(FILE);
  });
  afterEach(() => {
    if (backup !== null) fs.writeFileSync(FILE, backup);
    else if (fs.existsSync(FILE)) fs.rmSync(FILE);
  });

  it("starts empty", () => {
    expect(getChatBlacklist()).toEqual([]);
    expect(isChatBlacklisted("123")).toBe(false);
  });

  it("adds, detects and removes ids", () => {
    expect(addToChatBlacklist(123n)).toBe(true);
    expect(addToChatBlacklist("123")).toBe(false);
    expect(isChatBlacklisted("123")).toBe(true);
    expect(removeFromChatBlacklist("123")).toBe(true);
    expect(removeFromChatBlacklist("123")).toBe(false);
    expect(isChatBlacklisted("123")).toBe(false);
  });
});

const { describe, it, expect } = require("@jest/globals");
const { findMentions, resolveMentions, isBlockedSender } = require("../src/contracts/mentions.js");

describe("findMentions", () => {
  it("finds distinct @names", () => {
    expect(findMentions("hey @Steve and @alex, also @STEVE")).toEqual(["Steve", "alex"]);
  });

  it.each(["mail me at a@b.com", "@@double", "no mentions here", "@ alone", "@waytoolongusername12345"])("ignores %s", (text) => {
    expect(findMentions(text)).toEqual([]);
  });

  it("caps the number of pings", () => {
    expect(findMentions("@a @b @c @d @e @f @g")).toHaveLength(5);
  });
});

describe("isBlockedSender", () => {
  it("blocks only the listed Discord ids", () => {
    expect(isBlockedSender("1413588318804774975")).toBe(true);
    expect(isBlockedSender(1413588318804774975n)).toBe(true);
    expect(isBlockedSender("111")).toBe(false);
    expect(isBlockedSender(undefined)).toBe(false);
  });
});

describe("resolveMentions", () => {
  const deps = {
    getMemberUuids: async () => ["aaaa-aaaa", "bbbb"],
    getUuid: async (name) => ({ steve: "aaaaaaaa", alex: "bbbb", herobrine: "cccc" })[name.toLowerCase()] ?? Promise.reject(new Error("no such player")),
    linked: { aaaaaaaa: "111", cccc: "333" }
  };

  it("returns linked guild members only", async () => {
    expect(await resolveMentions(["Steve", "Alex", "Herobrine", "Nobody"], deps)).toEqual(["111"]);
  });

  it("falls back to findDiscordId for members that aren't linked", async () => {
    const findDiscordId = async (uuid) => (uuid === "bbbb" ? "222" : undefined);
    expect(await resolveMentions(["Alex"], { ...deps, findDiscordId })).toEqual(["222"]);
    expect(await resolveMentions(["Alex"], { ...deps, findDiscordId: () => Promise.reject(new Error("api down")) })).toEqual([]);
  });

  it("doesn't ping people who aren't in the Discord server", async () => {
    const isInServer = async (id) => id !== "111";
    expect(await resolveMentions(["Steve"], { ...deps, isInServer })).toEqual([]);
    expect(await resolveMentions(["Alex"], { ...deps, findDiscordId: async () => "222", isInServer })).toEqual(["222"]);
  });

  it("skips the guild lookup when nobody is mentioned", async () => {
    expect(await resolveMentions([], { ...deps, getMemberUuids: () => Promise.reject(new Error("called")) })).toEqual([]);
  });
});

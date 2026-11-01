const { describe, it, expect } = require("@jest/globals");
const { findMentions, resolveMentions } = require("../src/contracts/mentions.js");

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

describe("resolveMentions", () => {
  const deps = {
    getMemberUuids: async () => ["aaaa-aaaa", "bbbb"],
    getUuid: async (name) => ({ steve: "aaaaaaaa", alex: "bbbb", herobrine: "cccc" })[name.toLowerCase()] ?? Promise.reject(new Error("no such player")),
    linked: { aaaaaaaa: "111", cccc: "333" }
  };

  it("returns linked guild members only", async () => {
    expect(await resolveMentions(["Steve", "Alex", "Herobrine", "Nobody"], deps)).toEqual(["111"]);
  });

  it("skips the guild lookup when nobody is mentioned", async () => {
    expect(await resolveMentions([], { ...deps, getMemberUuids: () => Promise.reject(new Error("called")) })).toEqual([]);
  });
});

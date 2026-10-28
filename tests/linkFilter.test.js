const { describe, it, expect } = require("@jest/globals");
const { blockLinks } = require("../src/contracts/linkFilter.js");

describe("blockLinks", () => {
  it.each([
    ["https://example.com/a", "[link]"],
    ["http://example.com/a?x=1.", "[link]."],
    ["(https://example.com/page)", "([link])"],
    ["www.evil.com", "[link]"],
    ["evil.com/x?y=1", "[link]"],
    ["evil.com:8080/x", "[link]"],
    ["go to evil.gg now", "go to [link] now"],
    ["https://www.youtube.com/watch?v=abc", "[link]"],
    ["youtu.be/abc, ok", "[link], ok"],
    ["HTTPS://EVIL.COM", "[link]"]
  ])("blocks %s", (input, expected) => {
    expect(blockLinks(input)).toBe(expected);
  });

  it.each([
    "https://hypixel.net/threads/1",
    "store.hypixel.net",
    "https://forums.hypixel.net/x"
  ])("keeps %s", (link) => {
    expect(blockLinks(`look ${link}`)).toBe(`look ${link}`);
  });

  it.each([
    "https://hypixel.net@evil.com/",
    "https://evil.com/?u=hypixel.net",
    "hypixel.net.evil.io",
    "https://nothypixel.net"
  ])("blocks the lookalike %s", (link) => {
    expect(blockLinks(link)).toBe("[link]");
  });

  it("leaves ordinary text and ImgPrev tokens alone", () => {
    const text = "a.png config.json e.g. v1.2.3 3.14 <~Gabc123XYZ2~> hello";
    expect(blockLinks(text)).toBe(text);
  });
});

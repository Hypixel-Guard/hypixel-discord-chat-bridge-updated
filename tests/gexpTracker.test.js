const fs = require("fs");
const os = require("os");
const path = require("path");
const { readHistory, saveHistory } = require("../src/minecraft/other/gexpTracker.js");

describe("GEXP history persistence", () => {
  let directory;
  let historyFile;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), "gexp-history-"));
    historyFile = path.join(directory, "gexpHistory.json");
  });

  afterEach(() => {
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it("writes atomically and retains the previous valid version as a backup", () => {
    saveHistory({ version: 1, updatedAt: null, members: { first: {} } }, historyFile);
    saveHistory({ version: 1, updatedAt: null, members: { second: {} } }, historyFile);

    expect(readHistory(historyFile).members).toEqual({ second: {} });
    expect(JSON.parse(fs.readFileSync(`${historyFile}.bak`, "utf8")).members).toEqual({ first: {} });
  });

  it("refuses to replace a corrupted history file with an empty database", () => {
    fs.writeFileSync(historyFile, "not json");

    expect(() => readHistory(historyFile)).toThrow("GEXP history file is corrupted");
    expect(fs.readFileSync(historyFile, "utf8")).toBe("not json");
  });
});

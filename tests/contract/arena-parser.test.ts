import { readFileSync } from "node:fs";
import path from "node:path";
import { parseArenaLeaderboardHtml } from "@/lib/arena/parse-leaderboard-html";

const fixturePath = path.resolve(
  process.cwd(),
  "tests/fixtures/lmarena-overall.html",
);

describe("parseArenaLeaderboardHtml", () => {
  it("parses the real overall leaderboard HTML fixture", () => {
    const html = readFileSync(fixturePath, "utf8");
    const leaderboard = parseArenaLeaderboardHtml(
      html,
      "overall-no-style-control",
      "https://lmarena.ai/leaderboard/text/overall-no-style-control",
    );

    expect(leaderboard.entries.length).toBeGreaterThan(200);
    expect(leaderboard.entries[0]).toMatchObject({
      rank: 1,
      modelDisplayName: "claude-opus-4-6",
      modelOrganization: "Anthropic",
    });
    expect(leaderboard.entries[1]).toMatchObject({
      rank: 2,
      modelDisplayName: "claude-opus-4-6-thinking",
    });
  });
});

import { readFileSync } from "node:fs";
import path from "node:path";
import { buildDashboardSnapshot } from "@/lib/snapshot/build-snapshot";

const readFixture = (relativePath: string) =>
  readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

const fixtureMap = new Map<string, { body: string; contentType: string }>([
  [
    "https://lmarena.ai/leaderboard/text/overall-no-style-control",
    {
      body: readFixture("tests/fixtures/lmarena-overall.html"),
      contentType: "text/html",
    },
  ],
  [
    "https://openrouter.ai/api/v1/models",
    {
      body: readFixture("tests/fixtures/openrouter-models.sample.json"),
      contentType: "application/json",
    },
  ],
  [
    "https://openrouter.ai/api/frontend/stats/endpoint?permaslug=anthropic%2Fclaude-4.6-opus-20260205",
    {
      body: readFixture("tests/fixtures/openrouter-stats.claude-opus-4.6.json"),
      contentType: "application/json",
    },
  ],
  [
    "https://openrouter.ai/api/frontend/stats/endpoint?permaslug=google%2Fgemini-3.1-pro-preview-20260219",
    {
      body: readFixture(
        "tests/fixtures/openrouter-stats.gemini-3.1-pro-preview.json",
      ),
      contentType: "application/json",
    },
  ],
  [
    "https://openrouter.ai/api/frontend/stats/endpoint?permaslug=z-ai%2Fglm-5-turbo-20260315",
    {
      body: readFixture("tests/fixtures/openrouter-stats.glm-5-turbo.json"),
      contentType: "application/json",
    },
  ],
]);

describe("buildDashboardSnapshot", () => {
  it("builds a snapshot from fixture-backed upstream responses", async () => {
    const fetchStub = vi.fn(async (input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input.toString();
      const fixture = fixtureMap.get(url);

      if (!fixture) {
        return new Response("not-found", { status: 404 });
      }

      return new Response(fixture.body, {
        status: 200,
        headers: {
          "content-type": fixture.contentType,
        },
      });
    }) as typeof fetch;

    const snapshot = await buildDashboardSnapshot(
      fetchStub,
      "overall-no-style-control",
    );

    expect(snapshot.meta.totalModels).toBeGreaterThan(200);
    expect(snapshot.meta.matchedCount).toBeGreaterThanOrEqual(3);
    expect(snapshot.meta.statsCoverageCount).toBeGreaterThanOrEqual(3);
    expect(snapshot.models[0]).toMatchObject({
      displayName: "claude-opus-4-6",
      match: {
        status: "matched",
      },
    });
  });
});

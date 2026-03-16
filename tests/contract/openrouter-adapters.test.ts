import { readFileSync } from "node:fs";
import path from "node:path";
import { fetchOpenRouterModelCatalog } from "@/lib/openrouter/fetch-model-catalog";
import { fetchOpenRouterModelStats } from "@/lib/openrouter/fetch-model-stats";

const readJsonFixture = (relativePath: string) =>
  JSON.parse(
    readFileSync(path.resolve(process.cwd(), relativePath), "utf8"),
  ) as Record<string, unknown>;

const createFetchStub = (payload: unknown) =>
  vi.fn(
    async () => new Response(JSON.stringify(payload), { status: 200 }),
  ) as typeof fetch;

describe("OpenRouter adapters", () => {
  it("maps prompt/completion prices to per-million units", async () => {
    const payload = readJsonFixture(
      "tests/fixtures/openrouter-models.sample.json",
    );
    const result = await fetchOpenRouterModelCatalog(createFetchStub(payload));

    expect(result.models).toHaveLength(3);
    expect(
      result.models.find((model) => model.id === "anthropic/claude-opus-4.6"),
    ).toMatchObject({
      promptPricePerMillion: 5,
      completionPricePerMillion: 25,
    });
  });

  it("picks endpoint stats from a real stats payload", async () => {
    const payload = readJsonFixture(
      "tests/fixtures/openrouter-stats.claude-opus-4.6.json",
    );
    const result = await fetchOpenRouterModelStats(
      createFetchStub(payload),
      "anthropic/claude-4.6-opus-20260205",
    );

    expect(result).not.toBeNull();
    expect(result).toMatchObject({
      permaslug: "anthropic/claude-4.6-opus-20260205",
    });
    expect(result?.p50LatencyMs).toBeGreaterThan(0);
    expect(result?.p50Tps).toBeGreaterThan(0);
  });
});

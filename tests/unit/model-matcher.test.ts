import { matchArenaEntryToCatalog } from "@/lib/matching/model-matcher";
import type { ArenaEntry, OpenRouterCatalogEntry } from "@/lib/types";

const catalog: OpenRouterCatalogEntry[] = [
  {
    id: "anthropic/claude-opus-4.6",
    canonicalSlug: "anthropic/claude-4.6-opus-20260205",
    huggingFaceId: null,
    name: "Anthropic: Claude Opus 4.6",
    provider: "anthropic",
    promptPricePerMillion: 5,
    completionPricePerMillion: 25,
  },
  {
    id: "google/gemini-3.1-pro-preview",
    canonicalSlug: "google/gemini-3.1-pro-preview-20260219",
    huggingFaceId: null,
    name: "Google: Gemini 3.1 Pro Preview",
    provider: "google",
    promptPricePerMillion: 2,
    completionPricePerMillion: 12,
  },
  {
    id: "z-ai/glm-5-turbo",
    canonicalSlug: "z-ai/glm-5-turbo-20260315",
    huggingFaceId: "zai-org/GLM-5-Turbo",
    name: "Z.ai: GLM 5 Turbo",
    provider: "z-ai",
    promptPricePerMillion: 0.96,
    completionPricePerMillion: 3.2,
  },
  {
    id: "openai/gpt-5.4",
    canonicalSlug: "openai/gpt-5.4-20260305",
    huggingFaceId: null,
    name: "OpenAI: GPT-5.4",
    provider: "openai",
    promptPricePerMillion: 2.5,
    completionPricePerMillion: 15,
  },
  {
    id: "openai/gpt-5.4-pro",
    canonicalSlug: "openai/gpt-5.4-pro-20260305",
    huggingFaceId: null,
    name: "OpenAI: GPT-5.4 Pro",
    provider: "openai",
    promptPricePerMillion: 30,
    completionPricePerMillion: 180,
  },
];

const createArenaEntry = (overrides: Partial<ArenaEntry>): ArenaEntry => ({
  rank: 1,
  rating: 1500,
  modelDisplayName: "placeholder",
  modelOrganization: "Unknown",
  ...overrides,
});

describe("matchArenaEntryToCatalog", () => {
  it("uses alias matches first", () => {
    const result = matchArenaEntryToCatalog(
      createArenaEntry({
        modelDisplayName: "claude-opus-4-6",
        modelOrganization: "Anthropic",
      }),
      catalog,
      {
        "claude-opus-4-6": ["anthropic/claude-opus-4.6"],
      },
    );

    expect(result.match.matchType).toBe("alias");
    expect(result.catalogEntry?.id).toBe("anthropic/claude-opus-4.6");
  });

  it("matches exact ids without aliases", () => {
    const result = matchArenaEntryToCatalog(
      createArenaEntry({
        modelDisplayName: "z-ai/glm-5-turbo",
        modelOrganization: "Z.ai",
      }),
      catalog,
      {},
    );

    expect(result.match.matchType).toBe("exact-id");
    expect(result.catalogEntry?.id).toBe("z-ai/glm-5-turbo");
  });

  it("falls back to provider-name similarity for thinking variants", () => {
    const result = matchArenaEntryToCatalog(
      createArenaEntry({
        modelDisplayName: "claude-opus-4-6-thinking",
        modelOrganization: "Anthropic",
      }),
      catalog,
      {},
    );

    expect(result.match.status).toBe("matched");
    expect(result.catalogEntry?.id).toBe("anthropic/claude-opus-4.6");
  });

  it("keeps unmatched entries explicit", () => {
    const result = matchArenaEntryToCatalog(
      createArenaEntry({
        modelDisplayName: "totally-unknown-model",
      }),
      catalog,
      {},
    );

    expect(result.catalogEntry).toBeNull();
    expect(result.match.status).toBe("unmatched");
  });

  it("pins ambiguous OpenAI GPT variants through aliases", () => {
    const aliasMap = {
      "gpt-5.4": ["openai/gpt-5.4"],
    };

    const plainResult = matchArenaEntryToCatalog(
      createArenaEntry({
        modelDisplayName: "gpt-5.4",
        modelOrganization: "OpenAI",
      }),
      catalog,
      aliasMap,
    );

    expect(plainResult.match.matchType).toBe("alias");
    expect(plainResult.catalogEntry?.id).toBe("openai/gpt-5.4");
  });

  it("keeps OpenAI reasoning-effort variants unmatched without exact ids", () => {
    const result = matchArenaEntryToCatalog(
      createArenaEntry({
        modelDisplayName: "gpt-5.4-high",
        modelOrganization: "OpenAI",
      }),
      catalog,
      {},
    );

    expect(result.catalogEntry).toBeNull();
    expect(result.match.status).toBe("unmatched");
    expect(result.match.warnings).toEqual([
      "OpenAI reasoning-effort variants are not auto-mapped unless an exact model id exists.",
    ]);
  });
});

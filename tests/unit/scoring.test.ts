import {
  DEFAULT_WEIGHTS,
  getMetricAxisConfig,
  isMetricChartValueValid,
  getParetoFrontier,
  scoreModels,
} from "@/lib/scoring";
import type { SnapshotModel } from "@/lib/types";

const baseArena = {
  rank: 1,
  rating: 1000,
  ratingUpper: null,
  ratingLower: null,
  votes: 100,
  contextLength: 128_000,
};

const createModel = (overrides: Partial<SnapshotModel>): SnapshotModel => ({
  id: crypto.randomUUID(),
  displayName: "model",
  provider: "provider",
  modelUrl: null,
  license: null,
  arena: baseArena,
  pricing: {
    inputPerMillion: 1,
    outputPerMillion: 4,
    blendedPerMillion: 2,
    source: "openrouter",
  },
  perf: {
    p50LatencyMs: 2000,
    p50Tps: 50,
    requestCount: 1000,
    windowMinutes: 30,
  },
  match: {
    status: "matched",
    matchType: "alias",
    confidence: 0.99,
    openrouterId: "provider/model",
    canonicalSlug: "provider/model-20260316",
    warnings: [],
  },
  derived: {
    capabilityScore: null,
    priceScore: null,
    latencyScore: null,
    throughputScore: null,
    compositeScore: null,
    comparable: false,
  },
  ...overrides,
});

describe("scoreModels", () => {
  it("rewards cheaper and faster models while respecting rating", () => {
    const scored = scoreModels(
      [
        createModel({
          id: "best-value",
          arena: { ...baseArena, rating: 1450 },
          pricing: {
            inputPerMillion: 0.5,
            outputPerMillion: 2,
            blendedPerMillion: 1,
            source: "openrouter",
          },
          perf: {
            p50LatencyMs: 900,
            p50Tps: 90,
            requestCount: 1000,
            windowMinutes: 30,
          },
        }),
        createModel({
          id: "expensive-slow",
          arena: { ...baseArena, rating: 1480 },
          pricing: {
            inputPerMillion: 8,
            outputPerMillion: 32,
            blendedPerMillion: 16,
            source: "openrouter",
          },
          perf: {
            p50LatencyMs: 5000,
            p50Tps: 20,
            requestCount: 1000,
            windowMinutes: 30,
          },
        }),
      ],
      DEFAULT_WEIGHTS,
    );

    expect(scored[0].derived.priceScore).toBeGreaterThan(
      scored[1].derived.priceScore ?? 0,
    );
    expect(scored[0].derived.latencyScore).toBeGreaterThan(
      scored[1].derived.latencyScore ?? 0,
    );
    expect(scored[0].derived.compositeScore).toBeGreaterThan(
      scored[1].derived.compositeScore ?? 0,
    );
  });

  it("marks models with missing metrics as not comparable", () => {
    const scored = scoreModels([
      createModel({
        id: "missing-perf",
        perf: {
          p50LatencyMs: null,
          p50Tps: null,
          requestCount: null,
          windowMinutes: null,
        },
      }),
      createModel({
        id: "complete",
      }),
    ]);

    expect(scored[0].derived.comparable).toBe(false);
    expect(scored[0].derived.compositeScore).toBeNull();
    expect(scored[1].derived.comparable).toBe(true);
  });

  it("computes a pareto frontier for price versus rating", () => {
    const models = scoreModels([
      createModel({
        id: "frontier-a",
        arena: { ...baseArena, rating: 1450 },
        pricing: {
          inputPerMillion: 1,
          outputPerMillion: 1,
          blendedPerMillion: 1,
          source: "openrouter",
        },
      }),
      createModel({
        id: "dominated",
        arena: { ...baseArena, rating: 1400 },
        pricing: {
          inputPerMillion: 3,
          outputPerMillion: 3,
          blendedPerMillion: 3,
          source: "openrouter",
        },
      }),
      createModel({
        id: "frontier-b",
        arena: { ...baseArena, rating: 1490 },
        pricing: {
          inputPerMillion: 5,
          outputPerMillion: 5,
          blendedPerMillion: 5,
          source: "openrouter",
        },
      }),
    ]);

    const frontier = getParetoFrontier(
      models,
      "blendedPricePerMillion",
      "rating",
    );

    expect(frontier.map((model) => model.id)).toEqual(
      expect.arrayContaining(["frontier-a", "frontier-b"]),
    );
    expect(frontier.map((model) => model.id)).not.toContain("dominated");
  });

  it("rounds rating axis bounds and ticks to 100 for visible models", () => {
    const models = scoreModels([
      createModel({
        id: "a",
        arena: { ...baseArena, rating: 1501 },
      }),
      createModel({
        id: "b",
        arena: { ...baseArena, rating: 1567 },
      }),
      createModel({
        id: "c",
        arena: { ...baseArena, rating: 1599 },
      }),
    ]);

    expect(getMetricAxisConfig(models, "rating")).toEqual({
      domain: [1500, 1600],
      ticks: [1500, 1600],
      scale: undefined,
    });
  });

  it("uses log axis config for all price metrics", () => {
    const models = scoreModels([
      createModel({
        id: "free-model",
        pricing: {
          inputPerMillion: 0,
          outputPerMillion: 0,
          blendedPerMillion: null,
          source: "openrouter",
        },
      }),
      createModel({
        id: "cheap-model",
        pricing: {
          inputPerMillion: 0.2,
          outputPerMillion: 0.8,
          blendedPerMillion: 0.4,
          source: "openrouter",
        },
      }),
      createModel({
        id: "expensive-model",
        pricing: {
          inputPerMillion: 20,
          outputPerMillion: 80,
          blendedPerMillion: 40,
          source: "openrouter",
        },
      }),
    ]);

    expect(getMetricAxisConfig(models, "inputPricePerMillion")).toEqual({
      domain: [0.1, 100],
      ticks: [0.1, 1, 10, 100],
      scale: "log",
    });
    expect(getMetricAxisConfig(models, "blendedPricePerMillion")).toEqual({
      domain: [0.1, 100],
      ticks: [0.1, 1, 10, 100],
      scale: "log",
    });
    expect(isMetricChartValueValid("inputPricePerMillion", 0)).toBe(false);
    expect(isMetricChartValueValid("inputPricePerMillion", 0.2)).toBe(true);
    expect(isMetricChartValueValid("blendedPricePerMillion", 0)).toBe(false);
    expect(isMetricChartValueValid("blendedPricePerMillion", 0.4)).toBe(true);
  });
});

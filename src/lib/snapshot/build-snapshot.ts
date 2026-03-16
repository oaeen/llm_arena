import { readFile } from "node:fs/promises";
import { MATCH_ALIAS_FILE } from "@/lib/config";
import { fetchArenaLeaderboard } from "@/lib/arena/fetch-leaderboard";
import { type FetchLike } from "@/lib/http";
import {
  matchArenaEntryToCatalog,
  type AliasMap,
} from "@/lib/matching/model-matcher";
import { fetchOpenRouterModelCatalog } from "@/lib/openrouter/fetch-model-catalog";
import { fetchOpenRouterModelStats } from "@/lib/openrouter/fetch-model-stats";
import { DEFAULT_WEIGHTS, scoreModels } from "@/lib/scoring";
import type {
  DashboardSnapshot,
  OpenRouterEndpointStats,
  SnapshotModel,
} from "@/lib/types";
import { blendPricePerMillion } from "@/lib/utils";

const loadAliases = async (): Promise<AliasMap> => {
  try {
    const raw = await readFile(MATCH_ALIAS_FILE, "utf8");
    return JSON.parse(raw) as AliasMap;
  } catch {
    return {};
  }
};

const withConcurrency = async <T, R>(
  items: T[],
  concurrency: number,
  task: (item: T) => Promise<R>,
) => {
  const results: R[] = [];
  let nextIndex = 0;

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        results[currentIndex] = await task(items[currentIndex]);
      }
    },
  );

  await Promise.all(workers);
  return results;
};

export const buildDashboardSnapshot = async (
  fetchImpl: FetchLike,
  leaderboardSlug: string,
): Promise<DashboardSnapshot> => {
  const errors: string[] = [];
  const aliases = await loadAliases();
  const [leaderboard, catalog] = await Promise.all([
    fetchArenaLeaderboard(fetchImpl, leaderboardSlug),
    fetchOpenRouterModelCatalog(fetchImpl),
  ]);

  const matches = leaderboard.entries.map((entry) =>
    matchArenaEntryToCatalog(entry, catalog.models, aliases),
  );
  const uniqueSlugs = Array.from(
    new Set(
      matches
        .map((match) => match.match.canonicalSlug)
        .filter((value): value is string => Boolean(value)),
    ),
  );

  const statsResults = await withConcurrency(
    uniqueSlugs,
    6,
    async (permaslug) => {
      try {
        return await fetchOpenRouterModelStats(fetchImpl, permaslug);
      } catch (error) {
        errors.push(
          `Stats fetch failed for ${permaslug}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        return null;
      }
    },
  );

  const statsByPermaslug = new Map<string, OpenRouterEndpointStats>();
  for (const stats of statsResults) {
    if (stats) {
      statsByPermaslug.set(stats.permaslug, stats);
    }
  }

  const baseModels: SnapshotModel[] = leaderboard.entries.map(
    (entry, index) => {
      const matched = matches[index];
      const stats = matched.match.canonicalSlug
        ? statsByPermaslug.get(matched.match.canonicalSlug)
        : null;
      const matchedCatalog = matched.catalogEntry;
      const inputPerMillion =
        matchedCatalog?.promptPricePerMillion ??
        entry.inputPricePerMillion ??
        null;
      const outputPerMillion =
        matchedCatalog?.completionPricePerMillion ??
        entry.outputPricePerMillion ??
        null;
      const pricingSource = matchedCatalog
        ? "openrouter"
        : entry.inputPricePerMillion || entry.outputPricePerMillion
          ? "arena"
          : "missing";

      return {
        id: `${entry.rank}-${entry.modelDisplayName}`,
        displayName: entry.modelDisplayName,
        provider: entry.modelOrganization,
        modelUrl: entry.modelUrl ?? null,
        license: entry.license ?? null,
        arena: {
          rank: entry.rank,
          rating: entry.rating,
          ratingUpper: entry.ratingUpper ?? null,
          ratingLower: entry.ratingLower ?? null,
          votes: entry.votes ?? null,
          contextLength: entry.contextLength ?? null,
        },
        pricing: {
          inputPerMillion,
          outputPerMillion,
          blendedPerMillion: blendPricePerMillion(
            inputPerMillion,
            outputPerMillion,
          ),
          source: pricingSource,
        },
        perf: {
          p50LatencyMs: stats?.p50LatencyMs ?? null,
          p50Tps: stats?.p50Tps ?? null,
          requestCount: stats?.requestCount ?? null,
          windowMinutes: stats?.windowMinutes ?? null,
        },
        match: matched.match,
        derived: {
          capabilityScore: null,
          priceScore: null,
          latencyScore: null,
          throughputScore: null,
          compositeScore: null,
          comparable: false,
        },
      };
    },
  );

  const models = scoreModels(baseModels, DEFAULT_WEIGHTS);

  return {
    meta: {
      refreshedAt: new Date().toISOString(),
      leaderboardSlug,
      sourceFreshness: {
        arenaFetchedAt: leaderboard.fetchedAt,
        openRouterCatalogFetchedAt: catalog.fetchedAt,
        openRouterStatsFetchedAt:
          statsResults.find((stats) => stats !== null)?.fetchedAt ?? null,
      },
      totalModels: models.length,
      matchedCount: models.filter((model) => model.match.status === "matched")
        .length,
      unmatchedCount: models.filter(
        (model) => model.match.status === "unmatched",
      ).length,
      statsCoverageCount: models.filter(
        (model) =>
          model.perf.p50LatencyMs !== null && model.perf.p50Tps !== null,
      ).length,
      errors,
    },
    models,
  };
};

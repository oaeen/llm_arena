import { z } from "zod";
import { OPENROUTER_STATS_URL } from "@/lib/config";
import { fetchJson, type FetchLike } from "@/lib/http";
import type { OpenRouterEndpointStats } from "@/lib/types";
import { toNullableNumber } from "@/lib/utils";

const EndpointStatsSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      variant: z.string().optional().nullable(),
      stats: z
        .object({
          p50_latency: z.number().optional().nullable(),
          p50_throughput: z.number().optional().nullable(),
          request_count: z.number().optional().nullable(),
          window_minutes: z.number().optional().nullable(),
        })
        .optional()
        .nullable(),
    }),
  ),
});

export const fetchOpenRouterModelStats = async (
  fetchImpl: FetchLike,
  permaslug: string,
): Promise<OpenRouterEndpointStats | null> => {
  const payload = EndpointStatsSchema.parse(
    await fetchJson(fetchImpl, OPENROUTER_STATS_URL(permaslug)),
  );

  const bestEndpoint = payload.data
    .filter((entry) => entry.stats)
    .sort(
      (left, right) =>
        (right.stats?.request_count ?? 0) - (left.stats?.request_count ?? 0),
    )[0];

  if (!bestEndpoint?.stats) {
    return null;
  }

  return {
    endpointId: bestEndpoint.id,
    permaslug,
    variant: bestEndpoint.variant ?? null,
    p50LatencyMs: toNullableNumber(bestEndpoint.stats.p50_latency),
    p50Tps: toNullableNumber(bestEndpoint.stats.p50_throughput),
    requestCount: toNullableNumber(bestEndpoint.stats.request_count),
    windowMinutes: toNullableNumber(bestEndpoint.stats.window_minutes),
    fetchedAt: new Date().toISOString(),
  };
};

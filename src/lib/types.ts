export interface ArenaEntry {
  rank: number;
  rankUpper?: number | null;
  rankLower?: number | null;
  rating: number;
  ratingUpper?: number | null;
  ratingLower?: number | null;
  votes?: number | null;
  modelDisplayName: string;
  modelOrganization: string;
  modelUrl?: string | null;
  license?: string | null;
  inputPricePerMillion?: number | null;
  outputPricePerMillion?: number | null;
  contextLength?: number | null;
}

export interface ArenaLeaderboard {
  id?: string | null;
  leaderboardSlug: string;
  voteCutoffISOString?: string | null;
  totalVotes?: number | null;
  totalModels?: number | null;
  fetchedAt: string;
  sourceUrl: string;
  entries: ArenaEntry[];
}

export interface OpenRouterCatalogEntry {
  id: string;
  canonicalSlug: string | null;
  huggingFaceId: string | null;
  name: string;
  provider: string;
  promptPricePerMillion: number | null;
  completionPricePerMillion: number | null;
}

export interface OpenRouterEndpointStats {
  endpointId: string;
  permaslug: string;
  variant: string | null;
  p50LatencyMs: number | null;
  p50Tps: number | null;
  requestCount: number | null;
  windowMinutes: number | null;
  fetchedAt: string;
}

export type MatchStatus = "matched" | "unmatched";

export type MatchType =
  | "alias"
  | "exact-id"
  | "exact-canonical-slug"
  | "exact-name"
  | "hf-id"
  | "normalized-name"
  | "provider-name"
  | "unmatched";

export interface ModelMatch {
  status: MatchStatus;
  matchType: MatchType;
  confidence: number;
  openrouterId: string | null;
  canonicalSlug: string | null;
  warnings: string[];
}

export type PricingSource = "openrouter" | "arena" | "missing";

export interface SnapshotModel {
  id: string;
  displayName: string;
  provider: string;
  modelUrl: string | null;
  license: string | null;
  arena: {
    rank: number;
    rating: number;
    ratingUpper: number | null;
    ratingLower: number | null;
    votes: number | null;
    contextLength: number | null;
  };
  pricing: {
    inputPerMillion: number | null;
    outputPerMillion: number | null;
    blendedPerMillion: number | null;
    source: PricingSource;
  };
  perf: {
    p50LatencyMs: number | null;
    p50Tps: number | null;
    requestCount: number | null;
    windowMinutes: number | null;
  };
  match: ModelMatch;
  derived: {
    capabilityScore: number | null;
    priceScore: number | null;
    latencyScore: number | null;
    throughputScore: number | null;
    compositeScore: number | null;
    comparable: boolean;
  };
}

export interface DashboardSnapshotMeta {
  refreshedAt: string;
  leaderboardSlug: string;
  sourceFreshness: {
    arenaFetchedAt: string;
    openRouterCatalogFetchedAt: string;
    openRouterStatsFetchedAt: string | null;
  };
  totalModels: number;
  matchedCount: number;
  unmatchedCount: number;
  statsCoverageCount: number;
  errors: string[];
}

export interface DashboardSnapshot {
  meta: DashboardSnapshotMeta;
  models: SnapshotModel[];
}

export interface DashboardSummary {
  totalModels: number;
  comparableModels: number;
  unmatchedModels: number;
  bestArenaRating: number | null;
  medianBlendedPrice: number | null;
  medianLatencyMs: number | null;
  medianTps: number | null;
}

export interface DashboardApiResponse {
  meta: DashboardSnapshotMeta;
  summary: DashboardSummary;
  appliedLimit: number;
  models: SnapshotModel[];
}

export interface WeightConfig {
  capability: number;
  price: number;
  latency: number;
  throughput: number;
}

export type AxisMetric =
  | "rating"
  | "inputPricePerMillion"
  | "outputPricePerMillion"
  | "blendedPricePerMillion"
  | "p50LatencyMs"
  | "p50Tps"
  | "contextLength"
  | "compositeScore";

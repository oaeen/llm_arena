import type {
  ArenaEntry,
  MatchType,
  ModelMatch,
  OpenRouterCatalogEntry,
} from "@/lib/types";
import { normalizeCompact, normalizeTokens } from "@/lib/utils";

export type AliasMap = Record<string, string[]>;

const PROVIDER_ALIASES: Record<string, string> = {
  anthropic: "anthropic",
  google: "google",
  gemini: "google",
  openai: "openai",
  deepseek: "deepseek",
  qwen: "qwen",
  alibaba: "qwen",
  z: "z-ai",
  zai: "z-ai",
  "z-ai": "z-ai",
  "z.ai": "z-ai",
  meta: "meta",
  llama: "meta",
  xai: "x-ai",
  "x.ai": "x-ai",
};

const normalizeProvider = (value: string) => {
  const compact = normalizeCompact(value);
  return PROVIDER_ALIASES[compact] ?? compact;
};

const OPENAI_REASONING_EFFORT_VARIANT_PATTERN =
  /^gpt-5(?:\.\d+)?(?:-(?:mini|nano))?-(?:minimal|none|low|medium|high|xhigh)$/i;

const buildUnmatchedResult = (warning?: string) => ({
  catalogEntry: null,
  match: {
    status: "unmatched" as const,
    matchType: "unmatched" as const,
    confidence: 0,
    openrouterId: null,
    canonicalSlug: null,
    warnings: warning ? [warning] : [],
  },
});

const isOpenAIReasoningEffortVariant = (entry: ArenaEntry) =>
  normalizeProvider(entry.modelOrganization) === "openai" &&
  OPENAI_REASONING_EFFORT_VARIANT_PATTERN.test(entry.modelDisplayName);

const pickBestCandidate = (
  entry: ArenaEntry,
  candidates: OpenRouterCatalogEntry[],
  matchType: MatchType,
  confidence: number,
): {
  catalogEntry: OpenRouterCatalogEntry;
  match: ModelMatch;
} | null => {
  if (candidates.length === 0) {
    return null;
  }

  const normalizedProvider = normalizeProvider(entry.modelOrganization);
  const preferred =
    candidates.find(
      (candidate) =>
        normalizeProvider(candidate.provider) === normalizedProvider,
    ) ?? candidates[0];

  const warnings =
    candidates.length > 1
      ? [`Matched ${candidates.length} candidates, selected ${preferred.id}.`]
      : [];

  return {
    catalogEntry: preferred,
    match: {
      status: "matched",
      matchType,
      confidence,
      openrouterId: preferred.id,
      canonicalSlug: preferred.canonicalSlug,
      warnings,
    },
  };
};

const exactMatch = (
  entry: ArenaEntry,
  catalog: OpenRouterCatalogEntry[],
): {
  catalogEntry: OpenRouterCatalogEntry;
  match: ModelMatch;
} | null => {
  const displayCompact = normalizeCompact(entry.modelDisplayName);
  const nameCandidates = catalog.filter((candidate) => {
    const candidateId = normalizeCompact(candidate.id);
    const candidateCanonical = normalizeCompact(candidate.canonicalSlug ?? "");
    const candidateName = normalizeCompact(candidate.name);
    const candidateHfId = normalizeCompact(candidate.huggingFaceId ?? "");

    return (
      candidateId === displayCompact ||
      candidateCanonical === displayCompact ||
      candidateName === displayCompact ||
      candidateHfId === displayCompact
    );
  });

  if (nameCandidates.length === 0) {
    return null;
  }

  const matchType: MatchType = nameCandidates.some(
    (candidate) => normalizeCompact(candidate.id) === displayCompact,
  )
    ? "exact-id"
    : nameCandidates.some(
          (candidate) =>
            normalizeCompact(candidate.canonicalSlug ?? "") === displayCompact,
        )
      ? "exact-canonical-slug"
      : nameCandidates.some(
            (candidate) =>
              normalizeCompact(candidate.huggingFaceId ?? "") ===
              displayCompact,
          )
        ? "hf-id"
        : "exact-name";

  return pickBestCandidate(entry, nameCandidates, matchType, 0.94);
};

const normalizedNameMatch = (
  entry: ArenaEntry,
  catalog: OpenRouterCatalogEntry[],
): {
  catalogEntry: OpenRouterCatalogEntry;
  match: ModelMatch;
} | null => {
  const compactName = normalizeCompact(entry.modelDisplayName).replace(
    /20\d{6,}$/g,
    "",
  );

  const candidates = catalog.filter((candidate) => {
    const candidateKeys = [
      candidate.id,
      candidate.canonicalSlug ?? "",
      candidate.name,
      candidate.huggingFaceId ?? "",
    ]
      .map((value) => normalizeCompact(value).replace(/20\d{6,}$/g, ""))
      .filter(Boolean);

    return candidateKeys.some(
      (candidateKey) =>
        candidateKey === compactName ||
        candidateKey.includes(compactName) ||
        compactName.includes(candidateKey),
    );
  });

  return pickBestCandidate(entry, candidates, "normalized-name", 0.84);
};

const providerNameMatch = (
  entry: ArenaEntry,
  catalog: OpenRouterCatalogEntry[],
): {
  catalogEntry: OpenRouterCatalogEntry;
  match: ModelMatch;
} | null => {
  const entryTokens = normalizeTokens(entry.modelDisplayName);
  const normalizedProvider = normalizeProvider(entry.modelOrganization);
  let bestCandidate: OpenRouterCatalogEntry | null = null;
  let bestScore = 0;
  let nextBestScore = 0;

  for (const candidate of catalog) {
    const candidateTokens = normalizeTokens(
      `${candidate.id} ${candidate.canonicalSlug ?? ""} ${candidate.name}`,
    );
    const intersection = entryTokens.filter((token) =>
      candidateTokens.includes(token),
    ).length;
    const union = new Set([...entryTokens, ...candidateTokens]).size || 1;
    let score = intersection / union;

    if (normalizeProvider(candidate.provider) === normalizedProvider) {
      score += 0.18;
    }

    if (score > bestScore) {
      nextBestScore = bestScore;
      bestScore = score;
      bestCandidate = candidate;
    } else if (score > nextBestScore) {
      nextBestScore = score;
    }
  }

  if (!bestCandidate || bestScore < 0.5 || bestScore - nextBestScore < 0.04) {
    return null;
  }

  return {
    catalogEntry: bestCandidate,
    match: {
      status: "matched",
      matchType: "provider-name",
      confidence: Number(bestScore.toFixed(2)),
      openrouterId: bestCandidate.id,
      canonicalSlug: bestCandidate.canonicalSlug,
      warnings: [],
    },
  };
};

export const matchArenaEntryToCatalog = (
  entry: ArenaEntry,
  catalog: OpenRouterCatalogEntry[],
  aliasMap: AliasMap,
) => {
  const aliasCandidates = (aliasMap[entry.modelDisplayName] ?? [])
    .map((alias) =>
      catalog.find(
        (candidate) =>
          candidate.id === alias || candidate.canonicalSlug === alias,
      ),
    )
    .filter((candidate): candidate is OpenRouterCatalogEntry =>
      Boolean(candidate),
    );

  const aliasMatch = pickBestCandidate(entry, aliasCandidates, "alias", 0.99);
  if (aliasMatch) {
    return aliasMatch;
  }

  const exact = exactMatch(entry, catalog);
  if (exact) {
    return exact;
  }

  if (isOpenAIReasoningEffortVariant(entry)) {
    return buildUnmatchedResult(
      "OpenAI reasoning-effort variants are not auto-mapped unless an exact model id exists.",
    );
  }

  const normalized = normalizedNameMatch(entry, catalog);
  if (normalized) {
    return normalized;
  }

  const providerName = providerNameMatch(entry, catalog);
  if (providerName) {
    return providerName;
  }

  return buildUnmatchedResult();
};

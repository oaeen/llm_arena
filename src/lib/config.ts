import path from "node:path";

const parseInteger = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const DEFAULT_LIMIT = parseInteger(process.env.DEFAULT_LIMIT, 50);
export const LEADERBOARD_SLUG =
  process.env.LEADERBOARD_SLUG ?? "overall-no-style-control";
export const REFRESH_TOKEN = process.env.REFRESH_TOKEN ?? "";
export const MATCH_ALIAS_FILE = path.resolve(
  process.cwd(),
  process.env.MATCH_ALIAS_FILE ?? "config/model-aliases.json",
);
export const SNAPSHOT_DIR = path.resolve(
  process.cwd(),
  "data/runtime/snapshots",
);
export const ARENA_URL = (leaderboardSlug = LEADERBOARD_SLUG) =>
  `https://lmarena.ai/leaderboard/text/${leaderboardSlug}`;
export const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";
export const OPENROUTER_STATS_URL = (permaslug: string) =>
  `https://openrouter.ai/api/frontend/stats/endpoint?permaslug=${encodeURIComponent(
    permaslug,
  )}`;

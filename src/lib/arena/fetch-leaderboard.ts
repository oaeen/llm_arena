import { ARENA_URL } from "@/lib/config";
import { fetchText, type FetchLike } from "@/lib/http";
import { parseArenaLeaderboardHtml } from "@/lib/arena/parse-leaderboard-html";

export const fetchArenaLeaderboard = async (
  fetchImpl: FetchLike,
  leaderboardSlug: string,
) => {
  const sourceUrl = ARENA_URL(leaderboardSlug);
  const html = await fetchText(fetchImpl, sourceUrl, {
    headers: {
      accept: "text/html,application/xhtml+xml",
    },
  });

  return parseArenaLeaderboardHtml(html, leaderboardSlug, sourceUrl);
};

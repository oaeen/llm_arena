import { LEADERBOARD_SLUG } from "@/lib/config";
import { refreshSnapshot } from "@/lib/snapshot/refresh-snapshot";

const main = async () => {
  const result = await refreshSnapshot(fetch, LEADERBOARD_SLUG);

  console.log(
    JSON.stringify(
      {
        refreshedAt: result.snapshot.meta.refreshedAt,
        totalModels: result.snapshot.meta.totalModels,
        matchedCount: result.snapshot.meta.matchedCount,
        statsCoverageCount: result.snapshot.meta.statsCoverageCount,
        persisted: result.persisted,
        preservedPreviousSnapshot: result.preservedPreviousSnapshot,
        warning: result.warning,
      },
      null,
      2,
    ),
  );
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

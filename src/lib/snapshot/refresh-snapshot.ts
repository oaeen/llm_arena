import { buildDashboardSnapshot } from "@/lib/snapshot/build-snapshot";
import { readLatestSnapshot, writeSnapshot } from "@/lib/snapshot/store";
import type { DashboardSnapshot } from "@/lib/types";

export const refreshSnapshot = async (
  fetchImpl: typeof fetch,
  leaderboardSlug: string,
): Promise<{
  snapshot: DashboardSnapshot;
  persisted: boolean;
  preservedPreviousSnapshot: boolean;
  warning: string | null;
}> => {
  const previousSnapshot = await readLatestSnapshot();

  try {
    const snapshot = await buildDashboardSnapshot(fetchImpl, leaderboardSlug);
    await writeSnapshot(snapshot);

    return {
      snapshot,
      persisted: true,
      preservedPreviousSnapshot: false,
      warning: null,
    };
  } catch (error) {
    if (previousSnapshot) {
      return {
        snapshot: previousSnapshot,
        persisted: false,
        preservedPreviousSnapshot: true,
        warning:
          error instanceof Error ? error.message : "Snapshot refresh failed.",
      };
    }

    throw error;
  }
};

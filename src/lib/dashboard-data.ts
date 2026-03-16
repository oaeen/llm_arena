import { DEFAULT_LIMIT } from "@/lib/config";
import { buildDashboardSummary } from "@/lib/scoring";
import { readLatestSnapshot } from "@/lib/snapshot/store";
import type { DashboardApiResponse, DashboardSnapshot } from "@/lib/types";

export const sliceSnapshot = (
  snapshot: DashboardSnapshot,
  limit = DEFAULT_LIMIT,
): DashboardApiResponse => {
  const models = snapshot.models.slice(0, limit);

  return {
    meta: snapshot.meta,
    summary: buildDashboardSummary(snapshot.models),
    appliedLimit: limit,
    models,
  };
};

export const readDashboardData = async (limit = DEFAULT_LIMIT) => {
  const snapshot = await readLatestSnapshot();

  if (!snapshot) {
    return null;
  }

  return sliceSnapshot(snapshot, limit);
};

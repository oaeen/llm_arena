import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { SNAPSHOT_DIR } from "@/lib/config";
import type { DashboardSnapshot } from "@/lib/types";

const latestSnapshotPath = path.join(SNAPSHOT_DIR, "latest.json");

export const ensureSnapshotDir = async () => {
  await mkdir(SNAPSHOT_DIR, { recursive: true });
};

export const readLatestSnapshot =
  async (): Promise<DashboardSnapshot | null> => {
    try {
      const file = await readFile(latestSnapshotPath, "utf8");
      return JSON.parse(file) as DashboardSnapshot;
    } catch {
      return null;
    }
  };

export const writeSnapshot = async (snapshot: DashboardSnapshot) => {
  await ensureSnapshotDir();

  const timestamp = snapshot.meta.refreshedAt.replaceAll(":", "-");
  const historicalSnapshotPath = path.join(SNAPSHOT_DIR, `${timestamp}.json`);
  const serialized = JSON.stringify(snapshot, null, 2);

  await writeFile(historicalSnapshotPath, serialized, "utf8");
  await writeFile(latestSnapshotPath, serialized, "utf8");

  return {
    latestSnapshotPath,
    historicalSnapshotPath,
  };
};

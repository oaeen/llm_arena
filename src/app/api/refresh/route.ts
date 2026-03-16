import { NextResponse } from "next/server";
import { LEADERBOARD_SLUG, REFRESH_TOKEN } from "@/lib/config";
import { sliceSnapshot } from "@/lib/dashboard-data";
import { refreshSnapshot } from "@/lib/snapshot/refresh-snapshot";

export const dynamic = "force-dynamic";

const getSubmittedToken = (request: Request) => {
  const bearer = request.headers.get("authorization");

  if (bearer?.startsWith("Bearer ")) {
    return bearer.replace("Bearer ", "").trim();
  }

  return request.headers.get("x-refresh-token")?.trim() ?? "";
};

export async function POST(request: Request) {
  if (!REFRESH_TOKEN) {
    return NextResponse.json(
      { error: "REFRESH_TOKEN is not configured." },
      { status: 503 },
    );
  }

  if (getSubmittedToken(request) !== REFRESH_TOKEN) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const result = await refreshSnapshot(fetch, LEADERBOARD_SLUG);

  return NextResponse.json({
    ...sliceSnapshot(result.snapshot),
    persisted: result.persisted,
    preservedPreviousSnapshot: result.preservedPreviousSnapshot,
    warning: result.warning,
  });
}

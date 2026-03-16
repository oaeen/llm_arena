import { NextResponse } from "next/server";
import { DEFAULT_LIMIT } from "@/lib/config";
import { readDashboardData } from "@/lib/dashboard-data";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = Number.parseInt(url.searchParams.get("limit") ?? "", 10);
  const data = await readDashboardData(
    Number.isFinite(limit) ? limit : DEFAULT_LIMIT,
  );

  if (!data) {
    return NextResponse.json(
      { error: "Snapshot not found. Run refresh first." },
      { status: 404 },
    );
  }

  return NextResponse.json(data);
}

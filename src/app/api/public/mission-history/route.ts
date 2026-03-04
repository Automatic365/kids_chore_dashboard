import { NextRequest, NextResponse } from "next/server";

import { getRepository } from "@/lib/server/repository";

export async function GET(request: NextRequest) {
  const profileId = request.nextUrl.searchParams.get("profileId");
  const daysRaw = Number(request.nextUrl.searchParams.get("days") ?? "7");
  const days = Number.isFinite(daysRaw) ? Math.max(1, Math.min(30, Math.floor(daysRaw))) : 7;

  if (!profileId) {
    return NextResponse.json({ error: "profileId is required" }, { status: 400 });
  }

  const repo = getRepository();
  const history = await repo.getMissionHistory(profileId, days);
  return NextResponse.json({ history });
}

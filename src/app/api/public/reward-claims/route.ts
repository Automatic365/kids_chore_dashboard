import { NextRequest, NextResponse } from "next/server";

import { getRepository } from "@/lib/server/repository";

export async function GET(request: NextRequest) {
  const profileId = request.nextUrl.searchParams.get("profileId");
  if (!profileId) {
    return NextResponse.json({ error: "profileId is required" }, { status: 400 });
  }

  try {
    const repo = getRepository();
    const claims = await repo.getRewardClaims(profileId);
    return NextResponse.json({ claims });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load reward claims";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

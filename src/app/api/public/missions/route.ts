import { NextRequest, NextResponse } from "next/server";

import { getRepository } from "@/lib/server/repository";

export async function GET(request: NextRequest) {
  const profileId = request.nextUrl.searchParams.get("profileId") ?? undefined;
  const repo = getRepository();
  const missions = await repo.getMissions(profileId);
  return NextResponse.json({ missions });
}

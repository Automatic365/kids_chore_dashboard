import { NextResponse } from "next/server";

import { getRepository } from "@/lib/server/repository";

export async function GET() {
  const repo = getRepository();
  const squad = await repo.getSquadState();
  return NextResponse.json({ squad });
}

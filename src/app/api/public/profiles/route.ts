import { NextResponse } from "next/server";

import { getRepository } from "@/lib/server/repository";

export async function GET() {
  const repo = getRepository();
  const profiles = await repo.getProfiles();
  return NextResponse.json({ profiles });
}

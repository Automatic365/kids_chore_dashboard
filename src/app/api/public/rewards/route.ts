import { NextResponse } from "next/server";

import { getRepository } from "@/lib/server/repository";

export async function GET() {
  const repo = getRepository();
  const rewards = await repo.getRewards();
  return NextResponse.json({
    rewards: rewards.filter((reward) => reward.isActive),
  });
}

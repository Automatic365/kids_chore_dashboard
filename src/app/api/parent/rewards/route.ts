import { NextResponse } from "next/server";

import { isParentAuthenticated } from "@/lib/server/auth";
import { getRepository } from "@/lib/server/repository";
import { createRewardSchema } from "@/lib/server/schemas";

export async function GET() {
  if (!(await isParentAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const repo = getRepository();
    const rewards = await repo.getRewards();
    return NextResponse.json({ rewards });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load rewards";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  if (!(await isParentAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createRewardSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid reward payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const repo = getRepository();
    const reward = await repo.createReward(parsed.data);
    return NextResponse.json({ reward }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create reward";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

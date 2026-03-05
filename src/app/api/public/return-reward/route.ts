import { NextResponse } from "next/server";

import { getRepository } from "@/lib/server/repository";
import { returnRewardSchema } from "@/lib/server/schemas";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = returnRewardSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const repo = getRepository();
    const result = await repo.returnReward(parsed.data);
    return NextResponse.json({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Return reward failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

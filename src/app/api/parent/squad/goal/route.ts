import { NextResponse } from "next/server";

import { isParentAuthenticated } from "@/lib/server/auth";
import { getRepository } from "@/lib/server/repository";
import { setSquadGoalSchema } from "@/lib/server/schemas";

export async function POST(request: Request) {
  if (!(await isParentAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = setSquadGoalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid goal payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const repo = getRepository();
    const squad = await repo.setSquadGoal(parsed.data.goal);
    return NextResponse.json({ squad });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to set goal";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

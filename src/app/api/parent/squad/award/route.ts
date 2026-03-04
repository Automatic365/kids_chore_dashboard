import { NextResponse } from "next/server";

import { isParentAuthenticated } from "@/lib/server/auth";
import { getRepository } from "@/lib/server/repository";
import { awardSquadPowerSchema } from "@/lib/server/schemas";

export async function POST(request: Request) {
  if (!(await isParentAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = awardSquadPowerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const repo = getRepository();
  const squad = await repo.awardSquadPower(parsed.data);
  return NextResponse.json({ squad });
}

import { NextResponse } from "next/server";

import { generateMissionsFromTasks } from "@/lib/server/ai-missions";
import { isParentAuthenticated } from "@/lib/server/auth";
import { getRepository } from "@/lib/server/repository";
import { aiMissionGenerateSchema } from "@/lib/server/schemas";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = aiMissionGenerateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const cookieAuthorized = await isParentAuthenticated();
  if (!cookieAuthorized) {
    const pin = parsed.data.parentPin;
    if (!pin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const repo = getRepository();
    const pinOk = await repo.verifyParentPin(pin);
    if (!pinOk) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const missions = await generateMissionsFromTasks({
    tasks: parsed.data.tasks,
    profileName: parsed.data.profileName,
    uiMode: parsed.data.uiMode,
    provider: parsed.data.provider,
  });

  return NextResponse.json({ missions });
}

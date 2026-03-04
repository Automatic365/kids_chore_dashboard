import { NextResponse } from "next/server";

import { isParentAuthenticated } from "@/lib/server/auth";
import { getRepository } from "@/lib/server/repository";
import { createMissionSchema } from "@/lib/server/schemas";

export async function POST(request: Request) {
  if (!(await isParentAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createMissionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid mission payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const repo = getRepository();
  const mission = await repo.createMission(parsed.data);
  return NextResponse.json({ mission }, { status: 201 });
}

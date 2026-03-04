import { NextResponse } from "next/server";

import { isParentAuthenticated } from "@/lib/server/auth";
import { getRepository } from "@/lib/server/repository";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!(await isParentAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const repo = getRepository();
    const mission = await repo.restoreMission(id);
    return NextResponse.json({ mission });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Restore failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

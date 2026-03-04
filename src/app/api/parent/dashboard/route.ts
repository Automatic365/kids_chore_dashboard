import { NextResponse } from "next/server";

import { isParentAuthenticated } from "@/lib/server/auth";
import { getRepository } from "@/lib/server/repository";

export async function GET() {
  if (!(await isParentAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const repo = getRepository();
  const data = await repo.getParentDashboard();
  return NextResponse.json(data);
}

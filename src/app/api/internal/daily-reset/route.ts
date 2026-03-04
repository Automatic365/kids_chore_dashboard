import { NextResponse } from "next/server";

import { toLocalDateString } from "@/lib/date";
import { env } from "@/lib/env";
import { getRepository } from "@/lib/server/repository";

export async function POST(request: Request) {
  const secret = request.headers.get("x-internal-secret");
  if (secret !== env.internalCronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const repo = getRepository();
  const cycleDate = toLocalDateString(new Date(), env.appTimeZone);
  const squad = await repo.resetDaily(cycleDate);

  return NextResponse.json({ ok: true, squad });
}

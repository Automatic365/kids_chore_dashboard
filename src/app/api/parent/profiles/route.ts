import { NextResponse } from "next/server";

import { isParentAuthenticated } from "@/lib/server/auth";
import { getRepository } from "@/lib/server/repository";
import { createProfileSchema } from "@/lib/server/schemas";

export async function POST(request: Request) {
  if (!(await isParentAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createProfileSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid profile payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const repo = getRepository();
  const profile = await repo.createProfile(parsed.data);
  return NextResponse.json({ profile }, { status: 201 });
}

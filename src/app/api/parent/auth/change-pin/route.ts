import { NextResponse } from "next/server";

import { isParentAuthenticated } from "@/lib/server/auth";
import { getRepository } from "@/lib/server/repository";
import { changePinSchema } from "@/lib/server/schemas";

export async function POST(request: Request) {
  if (!(await isParentAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = changePinSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid PIN", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const repo = getRepository();
    await repo.changeParentPin(parsed.data.newPin);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "PIN change failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

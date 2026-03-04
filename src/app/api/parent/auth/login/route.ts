import { NextResponse } from "next/server";

import { getRepository } from "@/lib/server/repository";
import { parentAuthSchema } from "@/lib/server/schemas";
import {
  PARENT_SESSION_COOKIE,
  issueParentSession,
  parentSessionCookieOptions,
} from "@/lib/server/session";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = parentAuthSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid PIN format" }, { status: 400 });
  }

  const repo = getRepository();
  const isValid = await repo.verifyParentPin(parsed.data.pin);

  if (!isValid) {
    return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
  }

  const token = issueParentSession();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(PARENT_SESSION_COOKIE, token, parentSessionCookieOptions);
  return response;
}

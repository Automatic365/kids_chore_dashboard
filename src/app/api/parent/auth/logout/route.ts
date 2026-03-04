import { NextResponse } from "next/server";

import { PARENT_SESSION_COOKIE } from "@/lib/server/session";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(PARENT_SESSION_COOKIE, "", {
    path: "/",
    httpOnly: true,
    maxAge: 0,
  });
  return response;
}

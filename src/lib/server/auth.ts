import { cookies } from "next/headers";

import {
  PARENT_SESSION_COOKIE,
  verifyParentSession,
} from "@/lib/server/session";

export async function isParentAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(PARENT_SESSION_COOKIE)?.value;
  return verifyParentSession(token) !== null;
}

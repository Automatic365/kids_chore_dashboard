import { isParentAuthenticated } from "@/lib/server/auth";
import { err, getRequestId, mapRouteErrorStatus, ok } from "@/lib/server/api";
import { reportError } from "@/lib/monitoring";
import { getRepository } from "@/lib/server/repository";
import { missionUncompletionSchema } from "@/lib/server/schemas";

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  const body = await request.json().catch(() => null);
  const parsed = missionUncompletionSchema.safeParse(body);

  if (!parsed.success) {
    return err(400, "INVALID_REQUEST", "Invalid request", requestId, parsed.error.flatten());
  }

  if (parsed.data.force && !(await isParentAuthenticated())) {
    return err(401, "UNAUTHORIZED", "Unauthorized parent override", requestId);
  }

  try {
    const repo = getRepository();
    const result = await repo.uncompleteMission(parsed.data);
    return ok({ result }, requestId);
  } catch (error) {
    reportError(error, { route: "public_uncomplete_mission" });
    const message = error instanceof Error ? error.message : "Unknown error";
    return err(mapRouteErrorStatus(message), "UNDO_MISSION_FAILED", message, requestId);
  }
}

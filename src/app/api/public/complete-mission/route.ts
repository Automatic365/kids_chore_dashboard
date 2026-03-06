import { err, getRequestId, mapRouteErrorStatus, ok } from "@/lib/server/api";
import { reportError } from "@/lib/monitoring";
import { getRepository } from "@/lib/server/repository";
import { missionCompletionSchema } from "@/lib/server/schemas";

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  const body = await request.json().catch(() => null);
  const parsed = missionCompletionSchema.safeParse(body);

  if (!parsed.success) {
    return err(400, "INVALID_REQUEST", "Invalid request", requestId, parsed.error.flatten());
  }

  try {
    const repo = getRepository();
    const result = await repo.completeMission(parsed.data);
    return ok({ result }, requestId);
  } catch (error) {
    reportError(error, { route: "public_complete_mission" });
    const message = error instanceof Error ? error.message : "Unknown error";
    return err(mapRouteErrorStatus(message), "COMPLETE_MISSION_FAILED", message, requestId);
  }
}

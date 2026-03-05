import { isParentAuthenticated } from "@/lib/server/auth";
import { err, getRequestId, mapRouteErrorStatus, ok } from "@/lib/server/api";
import { getRepository } from "@/lib/server/repository";
import { setSquadGoalSchema } from "@/lib/server/schemas";

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  if (!(await isParentAuthenticated())) {
    return err(401, "UNAUTHORIZED", "Unauthorized", requestId);
  }

  const body = await request.json().catch(() => null);
  const parsed = setSquadGoalSchema.safeParse(body);
  if (!parsed.success) {
    return err(
      400,
      "INVALID_REQUEST",
      "Invalid goal payload",
      requestId,
      parsed.error.flatten(),
    );
  }

  try {
    const repo = getRepository();
    const squad = await repo.setSquadGoal(parsed.data.goal);
    return ok({ squad }, requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to set goal";
    return err(
      mapRouteErrorStatus(message),
      "SET_SQUAD_GOAL_FAILED",
      message,
      requestId,
    );
  }
}

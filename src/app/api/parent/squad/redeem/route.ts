import { isParentAuthenticated } from "@/lib/server/auth";
import { err, getRequestId, mapRouteErrorStatus, ok } from "@/lib/server/api";
import { getRepository } from "@/lib/server/repository";

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  if (!(await isParentAuthenticated())) {
    return err(401, "UNAUTHORIZED", "Unauthorized", requestId);
  }

  try {
    const repo = getRepository();
    const squad = await repo.redeemSquadGoal();
    return ok({ squad }, requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to redeem squad goal";
    return err(
      mapRouteErrorStatus(message),
      "REDEEM_SQUAD_GOAL_FAILED",
      message,
      requestId,
    );
  }
}

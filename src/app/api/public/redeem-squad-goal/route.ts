import { err, getRequestId, mapRouteErrorStatus, ok } from "@/lib/server/api";
import { reportError } from "@/lib/monitoring";
import { getRepository } from "@/lib/server/repository";

export async function POST(request: Request) {
  const requestId = getRequestId(request);

  try {
    const repo = getRepository();
    const current = await repo.getSquadState();
    if (!current.squadGoal) {
      return err(409, "NO_SQUAD_GOAL", "No squad goal is set", requestId);
    }
    if (current.squadPowerCurrent < current.squadGoal.targetPower) {
      return err(409, "GOAL_NOT_REACHED", "Squad goal not reached yet", requestId);
    }

    const squad = await repo.redeemSquadGoal();
    return ok({ squad }, requestId);
  } catch (error) {
    reportError(error, { route: "public_redeem_squad_goal" });
    const message = error instanceof Error ? error.message : "Failed to claim squad goal";
    return err(mapRouteErrorStatus(message), "REDEEM_SQUAD_GOAL_FAILED", message, requestId);
  }
}

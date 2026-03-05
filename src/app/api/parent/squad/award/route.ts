import { isParentAuthenticated } from "@/lib/server/auth";
import { err, getRequestId, mapRouteErrorStatus, ok } from "@/lib/server/api";
import { getRepository } from "@/lib/server/repository";
import { awardSquadPowerSchema } from "@/lib/server/schemas";

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  if (!(await isParentAuthenticated())) {
    return err(401, "UNAUTHORIZED", "Unauthorized", requestId);
  }

  const body = await request.json().catch(() => null);
  const parsed = awardSquadPowerSchema.safeParse(body);

  if (!parsed.success) {
    return err(
      400,
      "INVALID_REQUEST",
      "Invalid payload",
      requestId,
      parsed.error.flatten(),
    );
  }

  try {
    const repo = getRepository();
    const squad = await repo.awardSquadPower(parsed.data);
    return ok({ squad }, requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to award squad power";
    return err(
      mapRouteErrorStatus(message),
      "AWARD_SQUAD_POWER_FAILED",
      message,
      requestId,
    );
  }
}

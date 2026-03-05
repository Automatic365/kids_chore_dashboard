import { isParentAuthenticated } from "@/lib/server/auth";
import { err, getRequestId, mapRouteErrorStatus, ok } from "@/lib/server/api";
import { getRepository } from "@/lib/server/repository";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const requestId = getRequestId(request);
  if (!(await isParentAuthenticated())) {
    return err(401, "UNAUTHORIZED", "Unauthorized", requestId);
  }

  const { id } = await context.params;

  try {
    const repo = getRepository();
    const mission = await repo.restoreMission(id);
    return ok({ mission }, requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Restore failed";
    return err(
      mapRouteErrorStatus(message),
      "RESTORE_MISSION_FAILED",
      message,
      requestId,
    );
  }
}

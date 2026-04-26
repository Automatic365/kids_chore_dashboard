import { isParentAuthenticated } from "@/lib/server/auth";
import { err, getRequestId, mapRouteErrorStatus, ok } from "@/lib/server/api";
import { getRepository } from "@/lib/server/repository";

export async function DELETE(
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
    const result = await repo.deleteMissionBackfill(id);
    return ok({ result }, requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to remove backfill";
    return err(
      mapRouteErrorStatus(message),
      "DELETE_MISSION_BACKFILL_FAILED",
      message,
      requestId,
    );
  }
}

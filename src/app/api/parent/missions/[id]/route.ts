import { isParentAuthenticated } from "@/lib/server/auth";
import { err, getRequestId, mapRouteErrorStatus, ok } from "@/lib/server/api";
import { getRepository } from "@/lib/server/repository";
import { updateMissionSchema } from "@/lib/server/schemas";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const requestId = getRequestId(request);
  if (!(await isParentAuthenticated())) {
    return err(401, "UNAUTHORIZED", "Unauthorized", requestId);
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = updateMissionSchema.safeParse(body);

  if (!parsed.success) {
    return err(
      400,
      "INVALID_REQUEST",
      "Invalid update payload",
      requestId,
      parsed.error.flatten(),
    );
  }

  try {
    const repo = getRepository();
    const mission = await repo.updateMission(id, parsed.data);
    return ok({ mission }, requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Update failed";
    return err(
      mapRouteErrorStatus(message),
      "UPDATE_MISSION_FAILED",
      message,
      requestId,
    );
  }
}

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
    await repo.deleteMission(id);
    return ok({}, requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Delete failed";
    return err(
      mapRouteErrorStatus(message),
      "DELETE_MISSION_FAILED",
      message,
      requestId,
    );
  }
}

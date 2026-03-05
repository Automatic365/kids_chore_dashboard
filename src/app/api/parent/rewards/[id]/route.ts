import { isParentAuthenticated } from "@/lib/server/auth";
import { err, getRequestId, mapRouteErrorStatus, ok } from "@/lib/server/api";
import { getRepository } from "@/lib/server/repository";
import { updateRewardSchema } from "@/lib/server/schemas";

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
  const parsed = updateRewardSchema.safeParse(body);
  if (!parsed.success) {
    return err(
      400,
      "INVALID_REQUEST",
      "Invalid reward payload",
      requestId,
      parsed.error.flatten(),
    );
  }

  try {
    const repo = getRepository();
    const reward = await repo.updateReward(id, parsed.data);
    return ok({ reward }, requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update reward";
    return err(
      mapRouteErrorStatus(message),
      "UPDATE_REWARD_FAILED",
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
    await repo.deleteReward(id);
    return ok({}, requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete reward";
    return err(
      mapRouteErrorStatus(message),
      "DELETE_REWARD_FAILED",
      message,
      requestId,
    );
  }
}

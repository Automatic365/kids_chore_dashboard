import { isParentAuthenticated } from "@/lib/server/auth";
import { err, getRequestId, mapRouteErrorStatus, ok } from "@/lib/server/api";
import { getRepository } from "@/lib/server/repository";
import { createRewardSchema } from "@/lib/server/schemas";

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  if (!(await isParentAuthenticated())) {
    return err(401, "UNAUTHORIZED", "Unauthorized", requestId);
  }

  try {
    const repo = getRepository();
    const rewards = await repo.getRewards();
    return ok({ rewards }, requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load rewards";
    return err(
      mapRouteErrorStatus(message),
      "GET_REWARDS_FAILED",
      message,
      requestId,
    );
  }
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  if (!(await isParentAuthenticated())) {
    return err(401, "UNAUTHORIZED", "Unauthorized", requestId);
  }

  const body = await request.json().catch(() => null);
  const parsed = createRewardSchema.safeParse(body);
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
    const reward = await repo.createReward(parsed.data);
    return ok({ reward }, requestId, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create reward";
    return err(
      mapRouteErrorStatus(message),
      "CREATE_REWARD_FAILED",
      message,
      requestId,
    );
  }
}

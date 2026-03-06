import { err, getRequestId, mapRouteErrorStatus, ok } from "@/lib/server/api";
import { reportError } from "@/lib/monitoring";
import { getRepository } from "@/lib/server/repository";
import { returnRewardSchema } from "@/lib/server/schemas";

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  const body = await request.json().catch(() => null);
  const parsed = returnRewardSchema.safeParse(body);
  if (!parsed.success) {
    return err(400, "INVALID_REQUEST", "Invalid request", requestId, parsed.error.flatten());
  }

  try {
    const repo = getRepository();
    const result = await repo.returnReward(parsed.data);
    return ok({ result }, requestId);
  } catch (error) {
    reportError(error, { route: "public_return_reward" });
    const message = error instanceof Error ? error.message : "Return reward failed";
    return err(mapRouteErrorStatus(message), "RETURN_REWARD_FAILED", message, requestId);
  }
}

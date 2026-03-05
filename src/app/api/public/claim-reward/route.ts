import { err, getRequestId, mapRouteErrorStatus, ok } from "@/lib/server/api";
import { getRepository } from "@/lib/server/repository";
import { claimRewardSchema } from "@/lib/server/schemas";

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  const body = await request.json().catch(() => null);
  const parsed = claimRewardSchema.safeParse(body);
  if (!parsed.success) {
    return err(400, "INVALID_REQUEST", "Invalid request", requestId, parsed.error.flatten());
  }

  try {
    const repo = getRepository();
    const result = await repo.claimReward(parsed.data);
    return ok({ result }, requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Claim failed";
    return err(mapRouteErrorStatus(message), "CLAIM_REWARD_FAILED", message, requestId);
  }
}

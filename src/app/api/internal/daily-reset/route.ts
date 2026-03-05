import { toLocalDateString } from "@/lib/date";
import { env } from "@/lib/env";
import { err, getRequestId, ok } from "@/lib/server/api";
import { getRepository } from "@/lib/server/repository";

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  const secret = request.headers.get("x-internal-secret");
  if (secret !== env.internalCronSecret) {
    return err(401, "UNAUTHORIZED", "Invalid internal secret", requestId);
  }

  try {
    const repo = getRepository();
    const cycleDate = toLocalDateString(new Date(), env.appTimeZone);
    const squad = await repo.resetDaily(cycleDate);

    return ok({ cycleDate, squad }, requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return err(500, "RESET_FAILED", message, requestId);
  }
}

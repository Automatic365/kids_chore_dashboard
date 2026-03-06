import { isParentAuthenticated } from "@/lib/server/auth";
import { reportError } from "@/lib/monitoring";
import { err, getRequestId, mapRouteErrorStatus, ok } from "@/lib/server/api";
import { getRepository } from "@/lib/server/repository";

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  if (!(await isParentAuthenticated())) {
    return err(401, "UNAUTHORIZED", "Unauthorized", requestId);
  }

  try {
    const repo = getRepository();
    const result = await repo.markNotificationsRead();
    return ok({ result }, requestId);
  } catch (error) {
    reportError(error, { route: "parent_notifications_read" });
    const message = error instanceof Error ? error.message : "Failed to mark notifications read";
    return err(
      mapRouteErrorStatus(message),
      "MARK_NOTIFICATIONS_READ_FAILED",
      message,
      requestId,
    );
  }
}

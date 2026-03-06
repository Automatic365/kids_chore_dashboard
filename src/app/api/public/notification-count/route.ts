import { err, getRequestId, mapRouteErrorStatus, ok } from "@/lib/server/api";
import { reportError } from "@/lib/monitoring";
import { getRepository } from "@/lib/server/repository";

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  try {
    const repo = getRepository();
    const unreadCount = await repo.getUnreadNotificationCount();
    return ok({ unreadCount }, requestId);
  } catch (error) {
    reportError(error, { route: "public_notification_count" });
    const message = error instanceof Error ? error.message : "Failed to load notification count";
    return err(
      mapRouteErrorStatus(message),
      "GET_NOTIFICATION_COUNT_FAILED",
      message,
      requestId,
    );
  }
}

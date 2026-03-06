import { isParentAuthenticated } from "@/lib/server/auth";
import { reportError } from "@/lib/monitoring";
import { err, getRequestId, mapRouteErrorStatus, ok } from "@/lib/server/api";
import { getRepository } from "@/lib/server/repository";

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  if (!(await isParentAuthenticated())) {
    return err(401, "UNAUTHORIZED", "Unauthorized", requestId);
  }

  const url = new URL(request.url);
  const limitRaw = Number(url.searchParams.get("limit") ?? "100");
  const limit = Number.isFinite(limitRaw)
    ? Math.max(1, Math.min(500, Math.floor(limitRaw)))
    : 100;

  try {
    const repo = getRepository();
    const notifications = await repo.getNotifications(limit);
    return ok({ notifications }, requestId);
  } catch (error) {
    reportError(error, { route: "parent_notifications_list" });
    const message = error instanceof Error ? error.message : "Failed to load notifications";
    return err(
      mapRouteErrorStatus(message),
      "GET_NOTIFICATIONS_FAILED",
      message,
      requestId,
    );
  }
}

import { NextRequest } from "next/server";

import { isParentAuthenticated } from "@/lib/server/auth";
import { err, getRequestId, mapRouteErrorStatus, ok } from "@/lib/server/api";
import { getRepository } from "@/lib/server/repository";
import { createMissionBackfillSchema } from "@/lib/server/schemas";

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  if (!(await isParentAuthenticated())) {
    return err(401, "UNAUTHORIZED", "Unauthorized", requestId);
  }

  const profileId = request.nextUrl.searchParams.get("profileId");
  if (!profileId) {
    return err(400, "INVALID_REQUEST", "profileId is required", requestId);
  }

  try {
    const repo = getRepository();
    const backfills = await repo.getMissionBackfills(profileId);
    return ok({ backfills }, requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load backfills";
    return err(
      mapRouteErrorStatus(message),
      "GET_MISSION_BACKFILLS_FAILED",
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
  const parsed = createMissionBackfillSchema.safeParse(body);
  if (!parsed.success) {
    return err(
      400,
      "INVALID_REQUEST",
      "Invalid mission backfill payload",
      requestId,
      parsed.error.flatten(),
    );
  }

  try {
    const repo = getRepository();
    const result = await repo.createMissionBackfill(parsed.data);
    return ok({ result }, requestId, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Mission backfill failed";
    return err(
      mapRouteErrorStatus(message),
      "CREATE_MISSION_BACKFILL_FAILED",
      message,
      requestId,
    );
  }
}

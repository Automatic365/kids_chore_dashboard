import { isParentAuthenticated } from "@/lib/server/auth";
import { err, getRequestId, mapRouteErrorStatus, ok } from "@/lib/server/api";
import { getRepository } from "@/lib/server/repository";
import { createMissionSchema } from "@/lib/server/schemas";

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  if (!(await isParentAuthenticated())) {
    return err(401, "UNAUTHORIZED", "Unauthorized", requestId);
  }

  const body = await request.json().catch(() => null);
  const parsed = createMissionSchema.safeParse(body);

  if (!parsed.success) {
    return err(
      400,
      "INVALID_REQUEST",
      "Invalid mission payload",
      requestId,
      parsed.error.flatten(),
    );
  }

  try {
    const repo = getRepository();
    const mission = await repo.createMission(parsed.data);
    return ok({ mission }, requestId, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Mission creation failed";
    return err(
      mapRouteErrorStatus(message),
      "CREATE_MISSION_FAILED",
      message,
      requestId,
    );
  }
}

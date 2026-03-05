import { isParentAuthenticated } from "@/lib/server/auth";
import { err, getRequestId, mapRouteErrorStatus, ok } from "@/lib/server/api";
import { getRepository } from "@/lib/server/repository";
import { createProfileSchema } from "@/lib/server/schemas";

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  if (!(await isParentAuthenticated())) {
    return err(401, "UNAUTHORIZED", "Unauthorized", requestId);
  }

  const body = await request.json().catch(() => null);
  const parsed = createProfileSchema.safeParse(body);

  if (!parsed.success) {
    return err(
      400,
      "INVALID_REQUEST",
      "Invalid profile payload",
      requestId,
      parsed.error.flatten(),
    );
  }

  try {
    const repo = getRepository();
    const profile = await repo.createProfile(parsed.data);
    return ok({ profile }, requestId, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Profile creation failed";
    return err(
      mapRouteErrorStatus(message),
      "CREATE_PROFILE_FAILED",
      message,
      requestId,
    );
  }
}

import { randomUUID } from "node:crypto";

import { isParentAuthenticated } from "@/lib/server/auth";
import { err, getRequestId, ok } from "@/lib/server/api";
import { createSignedMediaUploadSchema } from "@/lib/server/schemas";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const MEDIA_BUCKET = "hero-media";
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/svg+xml",
  "image/heic",
  "image/heif",
]);

function fileExtension(fileName: string, fileType: string): string {
  const byType = fileType.split("/")[1];
  if (byType) return byType.toLowerCase();

  const byName = fileName.split(".").pop();
  if (byName) return byName.toLowerCase();

  return "png";
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);

  if (!(await isParentAuthenticated())) {
    return err(401, "UNAUTHORIZED", "Unauthorized", requestId);
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return err(
      503,
      "SUPABASE_NOT_CONFIGURED",
      "Supabase is not configured for media upload",
      requestId,
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = createSignedMediaUploadSchema.safeParse(body);
  if (!parsed.success) {
    return err(400, "INVALID_REQUEST", "Invalid upload payload", requestId, parsed.error.flatten());
  }

  const { kind = "mission", fileName, fileType } = parsed.data;
  if (!ALLOWED_IMAGE_MIME_TYPES.has(fileType)) {
    return err(
      400,
      "INVALID_REQUEST",
      "Unsupported image type. Use PNG, JPEG, WEBP, GIF, AVIF, SVG, HEIC, or HEIF.",
      requestId,
    );
  }

  const folder = kind === "avatar" ? "avatars" : "missions";
  const ext = fileExtension(fileName, fileType);
  const objectPath = `${folder}/${Date.now()}-${randomUUID()}.${ext}`;

  const { data, error: signError } = await admin.storage
    .from(MEDIA_BUCKET)
    .createSignedUploadUrl(objectPath, {
      upsert: false,
    });

  if (signError || !data?.token || !data?.path) {
    return err(500, "UPLOAD_SIGN_FAILED", signError?.message ?? "Failed to create upload token", requestId);
  }

  const { data: publicData } = admin.storage.from(MEDIA_BUCKET).getPublicUrl(data.path);
  if (!publicData.publicUrl) {
    return err(500, "UPLOAD_SIGN_FAILED", "Failed to resolve uploaded media URL", requestId);
  }

  return ok(
    {
      bucket: MEDIA_BUCKET,
      path: data.path,
      token: data.token,
      url: publicData.publicUrl,
    },
    requestId,
    201,
  );
}


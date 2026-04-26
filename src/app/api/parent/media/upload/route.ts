import { randomUUID } from "node:crypto";

import { isParentAuthenticated } from "@/lib/server/auth";
import { err, getRequestId, ok } from "@/lib/server/api";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const MEDIA_BUCKET = "hero-media";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
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

function fileExtension(file: File): string {
  const byType = file.type.split("/")[1];
  if (byType) return byType.toLowerCase();

  const byName = file.name.split(".").pop();
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

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return err(400, "INVALID_REQUEST", "Invalid multipart payload", requestId);
  }

  const file = formData.get("file");
  const kind = String(formData.get("kind") ?? "mission");

  if (!(file instanceof File)) {
    return err(400, "INVALID_REQUEST", "Missing file", requestId);
  }
  if (!ALLOWED_IMAGE_MIME_TYPES.has(file.type)) {
    return err(
      400,
      "INVALID_REQUEST",
      "Unsupported image type. Use PNG, JPEG, WEBP, GIF, AVIF, SVG, HEIC, or HEIF.",
      requestId,
    );
  }
  if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
    return err(400, "INVALID_REQUEST", "Image exceeds 10MB limit", requestId);
  }

  const folder = kind === "avatar" ? "avatars" : "missions";
  const ext = fileExtension(file);
  const objectPath = `${folder}/${Date.now()}-${randomUUID()}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await admin.storage
    .from(MEDIA_BUCKET)
    .upload(objectPath, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return err(500, "UPLOAD_FAILED", uploadError.message, requestId);
  }

  const { data } = admin.storage.from(MEDIA_BUCKET).getPublicUrl(objectPath);
  if (!data.publicUrl) {
    return err(500, "UPLOAD_FAILED", "Failed to resolve uploaded media URL", requestId);
  }

  return ok({ url: data.publicUrl }, requestId, 201);
}

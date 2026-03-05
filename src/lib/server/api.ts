import { NextResponse } from "next/server";

export function getRequestId(request: Request): string {
  return (
    request.headers.get("x-request-id") ??
    (typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `req-${Date.now()}`)
  );
}

export function ok<T>(data: T, requestId?: string, status = 200) {
  return NextResponse.json(
    {
      ok: true,
      ...(requestId ? { requestId } : {}),
      ...data,
    },
    { status },
  );
}

export function err(
  status: number,
  code: string,
  message: string,
  requestId?: string,
  details?: unknown,
) {
  return NextResponse.json(
    {
      ok: false,
      ...(requestId ? { requestId } : {}),
      error: {
        code,
        message,
      },
      ...(details !== undefined ? { details } : {}),
    },
    { status },
  );
}

export function mapRouteErrorStatus(message: string): number {
  const normalized = message.toLowerCase();
  if (normalized.includes("unauthorized")) return 401;
  if (
    normalized.includes("invalid") ||
    normalized.includes("not found") ||
    normalized.includes("unavailable") ||
    normalized.includes("inactive") ||
    normalized.includes("failed")
  ) {
    return 400;
  }
  return 500;
}

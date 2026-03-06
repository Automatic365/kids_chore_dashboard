import { reportError } from "@/lib/monitoring";

export async function POST(request: Request) {
  const raw = await request.text();
  let parsed: unknown = raw;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    // Keep raw payload fallback.
  }

  const report = (parsed as { "csp-report"?: Record<string, unknown> } | null)?.[
    "csp-report"
  ] ?? null;

  reportError(new Error("CSP report received"), {
    blockedUri: String(report?.["blocked-uri"] ?? "unknown"),
    violatedDirective: String(report?.["violated-directive"] ?? "unknown"),
  });

  return new Response(null, { status: 204 });
}

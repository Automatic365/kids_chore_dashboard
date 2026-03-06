import { describe, expect, it } from "vitest";

import { POST } from "./route";

describe("POST /api/parent/auth/logout", () => {
  it("returns 200 and clears the parent session cookie", async () => {
    const response = await POST();
    const payload = (await response.json()) as { ok: boolean };
    const setCookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(setCookie).toContain("herohabits_parent_session=");
    expect(setCookie).toContain("Max-Age=0");
  });
});

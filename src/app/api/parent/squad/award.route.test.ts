import { beforeEach, describe, expect, it, vi } from "vitest";

const isParentAuthenticatedMock = vi.hoisted(() => vi.fn());
const awardSquadPowerMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/auth", () => ({
  isParentAuthenticated: isParentAuthenticatedMock,
}));

vi.mock("@/lib/server/repository", () => ({
  getRepository: () => ({
    awardSquadPower: awardSquadPowerMock,
  }),
}));

import { POST } from "./award/route";

describe("POST /api/parent/squad/award", () => {
  beforeEach(() => {
    isParentAuthenticatedMock.mockReset();
    awardSquadPowerMock.mockReset();
  });

  it("returns 401 when parent is not authenticated", async () => {
    isParentAuthenticatedMock.mockResolvedValue(false);

    const request = new Request("http://localhost/api/parent/squad/award", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ delta: 5 }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as {
      ok: boolean;
      error: { code: string };
    };

    expect(response.status).toBe(401);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 400 for invalid payload", async () => {
    isParentAuthenticatedMock.mockResolvedValue(true);

    const request = new Request("http://localhost/api/parent/squad/award", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ delta: 9999 }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as {
      ok: boolean;
      error: { code: string };
    };

    expect(response.status).toBe(400);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("INVALID_REQUEST");
  });
});

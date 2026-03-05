import { beforeEach, describe, expect, it, vi } from "vitest";

const isParentAuthenticatedMock = vi.hoisted(() => vi.fn());
const setSquadGoalMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/auth", () => ({
  isParentAuthenticated: isParentAuthenticatedMock,
}));

vi.mock("@/lib/server/repository", () => ({
  getRepository: () => ({
    setSquadGoal: setSquadGoalMock,
  }),
}));

import { POST } from "./goal/route";

describe("POST /api/parent/squad/goal", () => {
  beforeEach(() => {
    isParentAuthenticatedMock.mockReset();
    setSquadGoalMock.mockReset();
  });

  it("returns 401 when parent is not authenticated", async () => {
    isParentAuthenticatedMock.mockResolvedValue(false);

    const request = new Request("http://localhost/api/parent/squad/goal", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ goal: null }),
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

    const request = new Request("http://localhost/api/parent/squad/goal", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ goal: { title: "x" } }),
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

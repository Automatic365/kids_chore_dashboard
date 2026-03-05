import { beforeEach, describe, expect, it, vi } from "vitest";

const isParentAuthenticatedMock = vi.hoisted(() => vi.fn());
const createMissionMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/auth", () => ({
  isParentAuthenticated: isParentAuthenticatedMock,
}));

vi.mock("@/lib/server/repository", () => ({
  getRepository: () => ({
    createMission: createMissionMock,
  }),
}));

import { POST } from "./route";

describe("POST /api/parent/missions", () => {
  beforeEach(() => {
    isParentAuthenticatedMock.mockReset();
    createMissionMock.mockReset();
  });

  it("returns 401 when parent is not authenticated", async () => {
    isParentAuthenticatedMock.mockResolvedValue(false);

    const request = new Request("http://localhost/api/parent/missions", {
      method: "POST",
      headers: { "x-request-id": "req-parent-mission-auth" },
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const payload = (await response.json()) as {
      ok: boolean;
      error: { code: string };
    };

    expect(response.status).toBe(401);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("UNAUTHORIZED");
    expect(createMissionMock).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid payload", async () => {
    isParentAuthenticatedMock.mockResolvedValue(true);

    const request = new Request("http://localhost/api/parent/missions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ title: "x" }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as {
      ok: boolean;
      error: { code: string };
    };

    expect(response.status).toBe(400);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("INVALID_REQUEST");
    expect(createMissionMock).not.toHaveBeenCalled();
  });

  it("returns mapped failure when repository throws", async () => {
    isParentAuthenticatedMock.mockResolvedValue(true);
    createMissionMock.mockRejectedValue(new Error("db exploded"));

    const request = new Request("http://localhost/api/parent/missions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        profileId: "captain-alpha",
        title: "Operation Alpha",
        instructions: "Do the task",
        powerValue: 10,
      }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as {
      ok: boolean;
      error: { code: string; message: string };
    };

    expect(response.status).toBe(500);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("CREATE_MISSION_FAILED");
    expect(payload.error.message).toContain("db exploded");
  });
});

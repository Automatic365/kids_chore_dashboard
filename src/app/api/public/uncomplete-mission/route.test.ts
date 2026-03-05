import { beforeEach, describe, expect, it, vi } from "vitest";

const uncompleteMissionMock = vi.hoisted(() => vi.fn());
const isParentAuthenticatedMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/auth", () => ({
  isParentAuthenticated: isParentAuthenticatedMock,
}));

vi.mock("@/lib/server/repository", () => ({
  getRepository: () => ({
    uncompleteMission: uncompleteMissionMock,
  }),
}));

import { POST } from "./route";

describe("POST /api/public/uncomplete-mission", () => {
  beforeEach(() => {
    uncompleteMissionMock.mockReset();
    isParentAuthenticatedMock.mockReset();
  });

  it("returns 400 for invalid payload", async () => {
    const request = new Request("http://localhost/api/public/uncomplete-mission", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ missionId: "", profileId: "" }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as {
      ok: boolean;
      error: { code: string };
    };

    expect(response.status).toBe(400);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("INVALID_REQUEST");
    expect(uncompleteMissionMock).not.toHaveBeenCalled();
  });

  it("requires parent auth when force=true", async () => {
    isParentAuthenticatedMock.mockResolvedValue(false);

    const request = new Request("http://localhost/api/public/uncomplete-mission", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-request-id": "req-force-auth",
      },
      body: JSON.stringify({
        missionId: "m1",
        profileId: "captain-alpha",
        force: true,
      }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as {
      ok: boolean;
      requestId: string;
      error: { code: string };
    };

    expect(response.status).toBe(401);
    expect(payload.ok).toBe(false);
    expect(payload.requestId).toBe("req-force-auth");
    expect(payload.error.code).toBe("UNAUTHORIZED");
    expect(uncompleteMissionMock).not.toHaveBeenCalled();
  });

  it("allows force undo when parent is authenticated", async () => {
    isParentAuthenticatedMock.mockResolvedValue(true);
    uncompleteMissionMock.mockResolvedValue({
      undone: true,
      wasCompleted: true,
      insufficientUnspentPoints: false,
      profilePowerLevel: 3,
      squadPowerCurrent: 30,
      squadPowerMax: 100,
    });

    const request = new Request("http://localhost/api/public/uncomplete-mission", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        missionId: "m1",
        profileId: "captain-alpha",
        force: true,
      }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as {
      ok: boolean;
      result: { undone: boolean; wasCompleted: boolean };
    };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.result.undone).toBe(true);
    expect(payload.result.wasCompleted).toBe(true);
    expect(uncompleteMissionMock).toHaveBeenCalledWith({
      missionId: "m1",
      profileId: "captain-alpha",
      force: true,
    });
  });
});

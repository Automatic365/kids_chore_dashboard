import { beforeEach, describe, expect, it, vi } from "vitest";

const completeMissionMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/repository", () => ({
  getRepository: () => ({
    completeMission: completeMissionMock,
  }),
}));

import { POST } from "./route";

describe("POST /api/public/complete-mission", () => {
  beforeEach(() => {
    completeMissionMock.mockReset();
  });

  it("returns 400 for invalid payload", async () => {
    const request = new Request("http://localhost/api/public/complete-mission", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-request-id": "req-complete-invalid",
      },
      body: JSON.stringify({ missionId: "", profileId: "" }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as {
      ok: boolean;
      requestId: string;
      error: { code: string };
    };

    expect(response.status).toBe(400);
    expect(payload.ok).toBe(false);
    expect(payload.requestId).toBe("req-complete-invalid");
    expect(payload.error.code).toBe("INVALID_REQUEST");
    expect(completeMissionMock).not.toHaveBeenCalled();
  });

  it("returns completion result on success", async () => {
    completeMissionMock.mockResolvedValue({
      awarded: true,
      alreadyCompleted: false,
      profilePowerLevel: 10,
      squadPowerCurrent: 20,
      squadPowerMax: 100,
    });

    const request = new Request("http://localhost/api/public/complete-mission", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-request-id": "req-complete-ok",
      },
      body: JSON.stringify({
        missionId: "m1",
        profileId: "captain-alpha",
        clientRequestId: "client-1",
        clientCompletedAt: "2026-03-06T10:00:00.000Z",
      }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as {
      ok: boolean;
      requestId: string;
      result: { awarded: boolean };
    };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.requestId).toBe("req-complete-ok");
    expect(payload.result.awarded).toBe(true);
    expect(completeMissionMock).toHaveBeenCalledWith({
      missionId: "m1",
      profileId: "captain-alpha",
      clientRequestId: "client-1",
      clientCompletedAt: "2026-03-06T10:00:00.000Z",
    });
  });

  it("maps unknown repository errors to 500", async () => {
    completeMissionMock.mockRejectedValue(new Error("db exploded"));

    const request = new Request("http://localhost/api/public/complete-mission", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        missionId: "m1",
        profileId: "captain-alpha",
        clientRequestId: "client-2",
        clientCompletedAt: "2026-03-06T10:00:00.000Z",
      }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as {
      ok: boolean;
      error: { code: string; message: string };
    };

    expect(response.status).toBe(500);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("COMPLETE_MISSION_FAILED");
    expect(payload.error.message).toContain("db exploded");
  });
});

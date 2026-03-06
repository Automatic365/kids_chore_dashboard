import { beforeEach, describe, expect, it, vi } from "vitest";

const isParentAuthenticatedMock = vi.hoisted(() => vi.fn());
const restoreMissionMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/auth", () => ({
  isParentAuthenticated: isParentAuthenticatedMock,
}));

vi.mock("@/lib/server/repository", () => ({
  getRepository: () => ({
    restoreMission: restoreMissionMock,
  }),
}));

import { POST } from "./route";

describe("POST /api/parent/missions/[id]/restore", () => {
  beforeEach(() => {
    isParentAuthenticatedMock.mockReset();
    restoreMissionMock.mockReset();
  });

  it("returns 401 when parent is not authenticated", async () => {
    isParentAuthenticatedMock.mockResolvedValue(false);

    const request = new Request("http://localhost/api/parent/missions/m1/restore", {
      method: "POST",
      headers: { "x-request-id": "req-restore-auth" },
    });

    const response = await POST(request, { params: Promise.resolve({ id: "m1" }) });
    const payload = (await response.json()) as {
      ok: boolean;
      error: { code: string };
    };

    expect(response.status).toBe(401);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("UNAUTHORIZED");
    expect(restoreMissionMock).not.toHaveBeenCalled();
  });

  it("returns mapped 400 when repository reports mission not found", async () => {
    isParentAuthenticatedMock.mockResolvedValue(true);
    restoreMissionMock.mockRejectedValue(new Error("Mission not found"));

    const request = new Request("http://localhost/api/parent/missions/m1/restore", {
      method: "POST",
      headers: { "x-request-id": "req-restore-missing" },
    });

    const response = await POST(request, { params: Promise.resolve({ id: "m1" }) });
    const payload = (await response.json()) as {
      ok: boolean;
      error: { code: string; message: string };
    };

    expect(response.status).toBe(400);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("RESTORE_MISSION_FAILED");
    expect(payload.error.message).toContain("Mission not found");
  });

  it("returns restored mission for authenticated parent", async () => {
    isParentAuthenticatedMock.mockResolvedValue(true);
    restoreMissionMock.mockResolvedValue({
      id: "m1",
      profileId: "captain-alpha",
      title: "Operation: Brush Teeth",
      instructions: "Brush your teeth before bedtime.",
      imageUrl: null,
      powerValue: 10,
      isActive: true,
      recurringDaily: true,
      sortOrder: 1,
      deletedAt: null,
    });

    const request = new Request("http://localhost/api/parent/missions/m1/restore", {
      method: "POST",
      headers: { "x-request-id": "req-restore-ok" },
    });

    const response = await POST(request, { params: Promise.resolve({ id: "m1" }) });
    const payload = (await response.json()) as {
      ok: boolean;
      mission: { id: string; title: string };
      requestId: string;
    };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.requestId).toBe("req-restore-ok");
    expect(payload.mission.id).toBe("m1");
    expect(payload.mission.title).toBe("Operation: Brush Teeth");
    expect(restoreMissionMock).toHaveBeenCalledWith("m1");
  });
});

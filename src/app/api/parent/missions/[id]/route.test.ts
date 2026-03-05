import { beforeEach, describe, expect, it, vi } from "vitest";

const isParentAuthenticatedMock = vi.hoisted(() => vi.fn());
const updateMissionMock = vi.hoisted(() => vi.fn());
const deleteMissionMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/auth", () => ({
  isParentAuthenticated: isParentAuthenticatedMock,
}));

vi.mock("@/lib/server/repository", () => ({
  getRepository: () => ({
    updateMission: updateMissionMock,
    deleteMission: deleteMissionMock,
  }),
}));

import { DELETE, PATCH } from "./route";

describe("/api/parent/missions/[id]", () => {
  beforeEach(() => {
    isParentAuthenticatedMock.mockReset();
    updateMissionMock.mockReset();
    deleteMissionMock.mockReset();
  });

  it("PATCH returns 401 when parent is not authenticated", async () => {
    isParentAuthenticatedMock.mockResolvedValue(false);

    const request = new Request("http://localhost/api/parent/missions/m1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "New Title" }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: "m1" }) });
    const payload = (await response.json()) as {
      ok: boolean;
      error: { code: string };
    };

    expect(response.status).toBe(401);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("UNAUTHORIZED");
  });

  it("DELETE returns mapped error code when repository fails", async () => {
    isParentAuthenticatedMock.mockResolvedValue(true);
    deleteMissionMock.mockRejectedValue(new Error("unknown explosion"));

    const request = new Request("http://localhost/api/parent/missions/m1", {
      method: "DELETE",
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: "m1" }) });
    const payload = (await response.json()) as {
      ok: boolean;
      error: { code: string };
    };

    expect(response.status).toBe(500);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("DELETE_MISSION_FAILED");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const isParentAuthenticatedMock = vi.hoisted(() => vi.fn());
const deleteMissionBackfillMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/auth", () => ({
  isParentAuthenticated: isParentAuthenticatedMock,
}));

vi.mock("@/lib/server/repository", () => ({
  getRepository: () => ({
    deleteMissionBackfill: deleteMissionBackfillMock,
  }),
}));

import { DELETE } from "./route";

describe("DELETE /api/parent/missions/backfill/[id]", () => {
  beforeEach(() => {
    isParentAuthenticatedMock.mockReset();
    deleteMissionBackfillMock.mockReset();
  });

  it("returns 401 when parent is not authenticated", async () => {
    isParentAuthenticatedMock.mockResolvedValue(false);

    const request = new Request("http://localhost/api/parent/missions/backfill/bf1", {
      method: "DELETE",
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: "bf1" }) });
    const payload = (await response.json()) as {
      ok: boolean;
      error: { code: string };
    };

    expect(response.status).toBe(401);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("UNAUTHORIZED");
    expect(deleteMissionBackfillMock).not.toHaveBeenCalled();
  });

  it("deletes a mission backfill", async () => {
    isParentAuthenticatedMock.mockResolvedValue(true);
    deleteMissionBackfillMock.mockResolvedValue({
      removed: true,
      profileRewardPoints: 30,
      profileXpPoints: 110,
      profilePowerLevel: 110,
      squadPowerCurrent: 70,
      squadPowerMax: 1000,
    });

    const request = new Request("http://localhost/api/parent/missions/backfill/bf1", {
      method: "DELETE",
      headers: { "x-request-id": "req-backfill-delete" },
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: "bf1" }) });
    const payload = (await response.json()) as {
      ok: boolean;
      requestId: string;
      result: { removed: boolean };
    };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.requestId).toBe("req-backfill-delete");
    expect(payload.result.removed).toBe(true);
    expect(deleteMissionBackfillMock).toHaveBeenCalledWith("bf1");
  });
});

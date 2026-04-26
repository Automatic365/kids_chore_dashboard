import { beforeEach, describe, expect, it, vi } from "vitest";

const isParentAuthenticatedMock = vi.hoisted(() => vi.fn());
const updateRewardMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/auth", () => ({
  isParentAuthenticated: isParentAuthenticatedMock,
}));

vi.mock("@/lib/server/repository", () => ({
  getRepository: () => ({
    updateReward: updateRewardMock,
    deleteReward: vi.fn(),
  }),
}));

import { PATCH } from "./route";

describe("PATCH /api/parent/rewards/[id]", () => {
  beforeEach(() => {
    isParentAuthenticatedMock.mockReset();
    updateRewardMock.mockReset();
  });

  it("returns 401 when parent is not authenticated", async () => {
    isParentAuthenticatedMock.mockResolvedValue(false);

    const request = new Request("http://localhost/api/parent/rewards/r1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pointCost: 20 }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: "r1" }) });
    const payload = (await response.json()) as {
      ok: boolean;
      error: { code: string };
    };

    expect(response.status).toBe(401);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("UNAUTHORIZED");
  });

  it("PATCH accepts targetDaysToEarn and forwards it to the repository", async () => {
    isParentAuthenticatedMock.mockResolvedValue(true);
    updateRewardMock.mockResolvedValue({
      id: "r1",
      title: "Sticker",
      description: "Hero sticker",
      pointCost: 20,
      targetDaysToEarn: 3,
      minDaysBetweenClaims: 10,
      isActive: true,
      sortOrder: 1,
    });

    const request = new Request("http://localhost/api/parent/rewards/r1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        pointCost: 20,
        targetDaysToEarn: 3,
        minDaysBetweenClaims: 10,
      }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: "r1" }) });
    const payload = (await response.json()) as {
      ok: boolean;
      reward: { targetDaysToEarn: number | null };
    };

    expect(response.status).toBe(200);
    expect(updateRewardMock).toHaveBeenCalledWith(
      "r1",
      expect.objectContaining({
        pointCost: 20,
        targetDaysToEarn: 3,
        minDaysBetweenClaims: 10,
      }),
    );
    expect(payload.reward.targetDaysToEarn).toBe(3);
    expect(payload.reward.minDaysBetweenClaims).toBe(10);
  });
});

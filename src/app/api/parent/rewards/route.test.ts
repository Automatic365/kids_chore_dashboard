import { beforeEach, describe, expect, it, vi } from "vitest";

const isParentAuthenticatedMock = vi.hoisted(() => vi.fn());
const getRewardsMock = vi.hoisted(() => vi.fn());
const createRewardMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/auth", () => ({
  isParentAuthenticated: isParentAuthenticatedMock,
}));

vi.mock("@/lib/server/repository", () => ({
  getRepository: () => ({
    getRewards: getRewardsMock,
    createReward: createRewardMock,
  }),
}));

import { GET, POST } from "./route";

describe("/api/parent/rewards", () => {
  beforeEach(() => {
    isParentAuthenticatedMock.mockReset();
    getRewardsMock.mockReset();
    createRewardMock.mockReset();
  });

  it("GET returns 401 when parent is not authenticated", async () => {
    isParentAuthenticatedMock.mockResolvedValue(false);

    const request = new Request("http://localhost/api/parent/rewards", {
      method: "GET",
    });

    const response = await GET(request);
    const payload = (await response.json()) as {
      ok: boolean;
      error: { code: string };
    };

    expect(response.status).toBe(401);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("UNAUTHORIZED");
    expect(getRewardsMock).not.toHaveBeenCalled();
  });

  it("POST returns 400 for invalid payload", async () => {
    isParentAuthenticatedMock.mockResolvedValue(true);

    const request = new Request("http://localhost/api/parent/rewards", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "X" }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as {
      ok: boolean;
      error: { code: string };
    };

    expect(response.status).toBe(400);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("INVALID_REQUEST");
    expect(createRewardMock).not.toHaveBeenCalled();
  });

  it("POST accepts targetDaysToEarn and forwards it to the repository", async () => {
    isParentAuthenticatedMock.mockResolvedValue(true);
    createRewardMock.mockResolvedValue({
      id: "r1",
      title: "Sticker",
      description: "Hero sticker",
      pointCost: 15,
      targetDaysToEarn: 2,
      minDaysBetweenClaims: 7,
      isActive: true,
      sortOrder: 1,
    });

    const request = new Request("http://localhost/api/parent/rewards", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Sticker",
        description: "Hero sticker",
        pointCost: 15,
        targetDaysToEarn: 2,
        minDaysBetweenClaims: 7,
      }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as {
      ok: boolean;
      reward: { targetDaysToEarn: number | null };
    };

    expect(response.status).toBe(201);
    expect(createRewardMock).toHaveBeenCalledWith(
      expect.objectContaining({ targetDaysToEarn: 2, minDaysBetweenClaims: 7 }),
    );
    expect(payload.reward.targetDaysToEarn).toBe(2);
    expect(payload.reward.minDaysBetweenClaims).toBe(7);
  });
});

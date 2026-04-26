import { beforeEach, describe, expect, it, vi } from "vitest";

const getRewardsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/repository", () => ({
  getRepository: () => ({
    getRewards: getRewardsMock,
  }),
}));

import { GET } from "./route";

describe("GET /api/public/rewards", () => {
  beforeEach(() => {
    getRewardsMock.mockReset();
  });

  it("returns only active rewards", async () => {
    getRewardsMock.mockResolvedValue([
      {
        id: "r1",
        title: "Hero Sticker",
        description: "A shiny sticker",
        pointCost: 25,
        targetDaysToEarn: 2,
        minDaysBetweenClaims: null,
        isActive: true,
        sortOrder: 1,
      },
      {
        id: "r2",
        title: "Hidden Reward",
        description: "Not available",
        pointCost: 100,
        targetDaysToEarn: null,
        minDaysBetweenClaims: 10,
        isActive: false,
        sortOrder: 2,
      },
    ]);

    const response = await GET();
    const payload = (await response.json()) as {
      rewards: Array<{ id: string; isActive: boolean }>;
    };

    expect(response.status).toBe(200);
    expect(payload.rewards).toHaveLength(1);
    expect(payload.rewards[0]?.id).toBe("r1");
    expect(payload.rewards[0]?.isActive).toBe(true);
    expect(getRewardsMock).toHaveBeenCalledTimes(1);
  });
});

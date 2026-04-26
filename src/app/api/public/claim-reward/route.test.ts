import { beforeEach, describe, expect, it, vi } from "vitest";

const claimRewardMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/repository", () => ({
  getRepository: () => ({
    claimReward: claimRewardMock,
  }),
}));

import { POST } from "./route";

describe("POST /api/public/claim-reward", () => {
  beforeEach(() => {
    claimRewardMock.mockReset();
  });

  it("returns 400 for invalid payload", async () => {
    const request = new Request("http://localhost/api/public/claim-reward", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ profileId: "" }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as {
      ok: boolean;
      error: { code: string };
    };

    expect(response.status).toBe(400);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("INVALID_REQUEST");
    expect(claimRewardMock).not.toHaveBeenCalled();
  });

  it("returns claim result on success", async () => {
    claimRewardMock.mockResolvedValue({
      claimed: true,
      insufficientPoints: false,
      cooldownActive: false,
      nextClaimDate: null,
      cooldownDaysRemaining: null,
      newPowerLevel: 10,
      reward: {
        id: "r1",
        title: "Hero Sticker",
        description: "A shiny sticker",
        pointCost: 25,
        targetDaysToEarn: 2,
        minDaysBetweenClaims: null,
        isActive: true,
        sortOrder: 1,
      },
      rewardClaimId: "rc1",
    });

    const request = new Request("http://localhost/api/public/claim-reward", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-request-id": "req-claim-ok",
      },
      body: JSON.stringify({
        profileId: "captain-alpha",
        rewardId: "r1",
      }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as {
      ok: boolean;
      requestId: string;
      result: { claimed: boolean; rewardClaimId: string };
    };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.requestId).toBe("req-claim-ok");
    expect(payload.result.claimed).toBe(true);
    expect(payload.result.rewardClaimId).toBe("rc1");
    expect(claimRewardMock).toHaveBeenCalledWith({
      profileId: "captain-alpha",
      rewardId: "r1",
    });
  });

  it("maps repository business errors to 400", async () => {
    claimRewardMock.mockRejectedValue(new Error("reward inactive"));

    const request = new Request("http://localhost/api/public/claim-reward", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        profileId: "captain-alpha",
        rewardId: "r2",
      }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as {
      ok: boolean;
      error: { code: string; message: string };
    };

    expect(response.status).toBe(400);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("CLAIM_REWARD_FAILED");
    expect(payload.error.message).toContain("reward inactive");
  });
});

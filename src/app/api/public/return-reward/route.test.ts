import { beforeEach, describe, expect, it, vi } from "vitest";

const returnRewardMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/repository", () => ({
  getRepository: () => ({
    returnReward: returnRewardMock,
  }),
}));

import { POST } from "./route";

describe("POST /api/public/return-reward", () => {
  beforeEach(() => {
    returnRewardMock.mockReset();
  });

  it("returns 400 for invalid payload", async () => {
    const request = new Request("http://localhost/api/public/return-reward", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ profileId: "captain-alpha" }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as {
      ok: boolean;
      error: { code: string };
    };

    expect(response.status).toBe(400);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("INVALID_REQUEST");
    expect(returnRewardMock).not.toHaveBeenCalled();
  });

  it("returns return-reward result on success", async () => {
    returnRewardMock.mockResolvedValue({
      returned: true,
      newPowerLevel: 30,
      rewardClaimId: "rc1",
    });

    const request = new Request("http://localhost/api/public/return-reward", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-request-id": "req-return-ok",
      },
      body: JSON.stringify({
        profileId: "captain-alpha",
        rewardClaimId: "rc1",
      }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as {
      ok: boolean;
      requestId: string;
      result: { returned: boolean; rewardClaimId: string };
    };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.requestId).toBe("req-return-ok");
    expect(payload.result.returned).toBe(true);
    expect(payload.result.rewardClaimId).toBe("rc1");
    expect(returnRewardMock).toHaveBeenCalledWith({
      profileId: "captain-alpha",
      rewardClaimId: "rc1",
    });
  });

  it("maps unknown errors to 500", async () => {
    returnRewardMock.mockRejectedValue(new Error("unexpected failure"));

    const request = new Request("http://localhost/api/public/return-reward", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        profileId: "captain-alpha",
        rewardClaimId: "rc1",
      }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as {
      ok: boolean;
      error: { code: string; message: string };
    };

    expect(response.status).toBe(500);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("RETURN_REWARD_FAILED");
    expect(payload.error.message).toContain("unexpected failure");
  });
});

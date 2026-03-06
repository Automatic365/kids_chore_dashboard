import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getRewardClaimsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/repository", () => ({
  getRepository: () => ({
    getRewardClaims: getRewardClaimsMock,
  }),
}));

import { GET } from "./route";

describe("GET /api/public/reward-claims", () => {
  beforeEach(() => {
    getRewardClaimsMock.mockReset();
  });

  it("returns 400 when profileId query is missing", async () => {
    const request = new NextRequest("http://localhost/api/public/reward-claims");

    const response = await GET(request);
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(payload.error).toBe("profileId is required");
    expect(getRewardClaimsMock).not.toHaveBeenCalled();
  });

  it("returns reward claims for provided profileId", async () => {
    getRewardClaimsMock.mockResolvedValue([
      {
        id: "rc1",
        profileId: "captain-alpha",
        rewardId: "r1",
      },
    ]);

    const request = new NextRequest(
      "http://localhost/api/public/reward-claims?profileId=captain-alpha",
    );
    const response = await GET(request);
    const payload = (await response.json()) as { claims: Array<{ id: string }> };

    expect(response.status).toBe(200);
    expect(payload.claims).toHaveLength(1);
    expect(payload.claims[0]?.id).toBe("rc1");
    expect(getRewardClaimsMock).toHaveBeenCalledWith("captain-alpha");
  });

  it("returns 400 when repository throws", async () => {
    getRewardClaimsMock.mockRejectedValue(new Error("Profile not found"));

    const request = new NextRequest(
      "http://localhost/api/public/reward-claims?profileId=missing",
    );
    const response = await GET(request);
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(payload.error).toContain("Profile not found");
  });
});

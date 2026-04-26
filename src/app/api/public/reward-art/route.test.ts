import { beforeEach, describe, expect, it, vi } from "vitest";

const generateRewardClaimArtMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/reward-claim-art", () => ({
  generateRewardClaimArt: generateRewardClaimArtMock,
}));

import { POST } from "./route";

describe("POST /api/public/reward-art", () => {
  beforeEach(() => {
    generateRewardClaimArtMock.mockReset();
  });

  it("returns 400 for invalid payload", async () => {
    const response = await POST(
      new Request("http://localhost/api/public/reward-art", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ heroName: "A" }),
      }),
    );

    expect(response.status).toBe(400);
    expect(generateRewardClaimArtMock).not.toHaveBeenCalled();
  });

  it("returns generated image url", async () => {
    generateRewardClaimArtMock.mockResolvedValue({
      imageUrl: "https://example.com/sticker.png",
      stickerType: "vehicle",
      stickerConceptId: "jet",
      stickerPromptSeed: "cosmic:vehicle:jet",
    });

    const response = await POST(
      new Request("http://localhost/api/public/reward-art", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-request-id": "req-reward-art",
        },
        body: JSON.stringify({
          heroName: "Captain Comet",
          rewardTitle: "In-App Sticker",
          rewardDescription: "Unlock a new trophy sticker.",
          claimedAt: "2026-03-11T12:00:00.000Z",
          existingStickerConceptIds: ["robo-pup"],
        }),
      }),
    );

    const payload = (await response.json()) as {
      ok: boolean;
      requestId: string;
      imageUrl: string;
      stickerType: string;
      stickerConceptId: string;
      stickerPromptSeed: string;
    };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.requestId).toBe("req-reward-art");
    expect(payload.imageUrl).toBe("https://example.com/sticker.png");
    expect(payload.stickerType).toBe("vehicle");
    expect(payload.stickerConceptId).toBe("jet");
    expect(generateRewardClaimArtMock).toHaveBeenCalledWith({
      rewardTitle: "In-App Sticker",
      rewardDescription: "Unlock a new trophy sticker.",
      heroName: "Captain Comet",
      claimedAt: "2026-03-11T12:00:00.000Z",
      existingStickerConceptIds: ["robo-pup"],
    });
  });
});

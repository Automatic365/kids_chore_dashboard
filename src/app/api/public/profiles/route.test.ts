import { beforeEach, describe, expect, it, vi } from "vitest";

const getProfilesMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/repository", () => ({
  getRepository: () => ({
    getProfiles: getProfilesMock,
  }),
}));

import { GET } from "./route";

describe("GET /api/public/profiles", () => {
  beforeEach(() => {
    getProfilesMock.mockReset();
  });

  it("returns public profiles", async () => {
    getProfilesMock.mockResolvedValue([
      {
        id: "captain-alpha",
        heroName: "Captain Alpha",
        avatarUrl: "https://example.com/avatar-a.png",
        uiMode: "text",
        heroCardObjectPosition: "center",
        powerLevel: 20,
        currentStreak: 2,
        lastStreakDate: "2026-03-05",
      },
    ]);

    const response = await GET();
    const payload = (await response.json()) as {
      profiles: Array<{ id: string; heroName: string }>;
    };

    expect(response.status).toBe(200);
    expect(payload.profiles).toHaveLength(1);
    expect(payload.profiles[0]?.id).toBe("captain-alpha");
    expect(payload.profiles[0]?.heroName).toBe("Captain Alpha");
    expect(getProfilesMock).toHaveBeenCalledTimes(1);
  });
});

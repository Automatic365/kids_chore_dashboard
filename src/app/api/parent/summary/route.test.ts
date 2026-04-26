import { beforeEach, describe, expect, it, vi } from "vitest";

const isParentAuthenticatedMock = vi.hoisted(() => vi.fn());
const getProfilesMock = vi.hoisted(() => vi.fn());
const getSquadStateMock = vi.hoisted(() => vi.fn());
const getMissionsMock = vi.hoisted(() => vi.fn());
const getMissionHistoryMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/auth", () => ({
  isParentAuthenticated: isParentAuthenticatedMock,
}));

vi.mock("@/lib/server/repository", () => ({
  getRepository: () => ({
    getProfiles: getProfilesMock,
    getSquadState: getSquadStateMock,
    getMissions: getMissionsMock,
    getMissionHistory: getMissionHistoryMock,
  }),
}));

import { GET } from "./route";

describe("GET /api/parent/summary", () => {
  beforeEach(() => {
    isParentAuthenticatedMock.mockReset();
    getProfilesMock.mockReset();
    getSquadStateMock.mockReset();
    getMissionsMock.mockReset();
    getMissionHistoryMock.mockReset();
  });

  it("returns 401 when parent is not authenticated", async () => {
    isParentAuthenticatedMock.mockResolvedValue(false);

    const response = await GET();
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(401);
    expect(payload.error).toBe("Unauthorized");
    expect(getProfilesMock).not.toHaveBeenCalled();
  });

  it("returns launch-window household and per-hero analytics for authenticated parent", async () => {
    isParentAuthenticatedMock.mockResolvedValue(true);
    getProfilesMock.mockResolvedValue([
      {
        id: "captain-alpha",
        heroName: "Captain Alpha",
      },
    ]);
    getSquadStateMock.mockResolvedValue({
      squadPowerCurrent: 55,
      squadPowerMax: 1000,
      cycleDate: "2026-03-12",
      squadGoal: null,
    });
    getMissionsMock.mockResolvedValue([
      { id: "m1", title: "Operation: Brush Teeth" },
      { id: "m2", title: "Mission: Toy Tidy" },
    ]);
    getMissionHistoryMock.mockResolvedValue([
      { date: "2026-03-11", missions: [{ title: "Operation: Brush Teeth", powerAwarded: 10 }] },
      {
        date: "2026-03-12",
        missions: [
          { title: "Operation: Brush Teeth", powerAwarded: 10 },
          { title: "Mission: Toy Tidy", powerAwarded: 8 },
        ],
      },
    ]);

    const response = await GET();
    const payload = (await response.json()) as {
      cycleDate: string;
      windowDays: number;
      days: string[];
      household: {
        totalCompleted: number;
        totalRewardPointsEarned: number;
        averageRewardPointsPerHeroPerDay: number;
        topMissions: Array<{ title: string; completedCount: number }>;
        daily: Array<{ date: string; completed: number }>;
      };
      heroes: Array<{
        profileId: string;
        heroName: string;
        todayCompleted: number;
        todayTotal: number;
        averageRewardPointsPerDay: number;
        topMissions: Array<{ title: string; completedCount: number }>;
        daily: Array<{ date: string; completed: number; rewardPoints: number }>;
      }>;
    };

    expect(response.status).toBe(200);
    expect(payload.cycleDate).toBe("2026-03-12");
    expect(payload.windowDays).toBe(2);
    expect(payload.days).toEqual(["2026-03-11", "2026-03-12"]);
    expect(payload.household.totalCompleted).toBe(3);
    expect(payload.household.totalRewardPointsEarned).toBe(28);
    expect(payload.household.averageRewardPointsPerHeroPerDay).toBeCloseTo(14, 5);
    expect(payload.household.topMissions[0]).toMatchObject({
      title: "Operation: Brush Teeth",
      completedCount: 2,
    });
    expect(
      payload.household.daily.find((day) => day.date === "2026-03-12")?.completed,
    ).toBe(2);
    expect(payload.heroes).toHaveLength(1);
    expect(payload.heroes[0]).toMatchObject({
      profileId: "captain-alpha",
      heroName: "Captain Alpha",
      todayCompleted: 2,
      todayTotal: 2,
    });
    expect(payload.heroes[0]?.averageRewardPointsPerDay).toBeCloseTo(14, 5);
    expect(payload.heroes[0]?.topMissions[0]).toMatchObject({
      title: "Operation: Brush Teeth",
      completedCount: 2,
    });
    expect(
      payload.heroes[0]?.daily.find((day) => day.date === "2026-03-11")?.rewardPoints,
    ).toBe(10);
    expect(getMissionsMock).toHaveBeenCalledWith("captain-alpha");
    expect(getMissionHistoryMock).toHaveBeenCalledWith("captain-alpha", 30);
  });
});

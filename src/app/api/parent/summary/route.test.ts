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

  it("returns 7-day hero summary for authenticated parent", async () => {
    isParentAuthenticatedMock.mockResolvedValue(true);
    getProfilesMock.mockResolvedValue([
      {
        id: "captain-alpha",
        heroName: "Captain Alpha",
      },
    ]);
    getSquadStateMock.mockResolvedValue({
      squadPowerCurrent: 55,
      squadPowerMax: 100,
      cycleDate: "2026-03-05",
      squadGoal: null,
    });
    getMissionsMock.mockResolvedValue([
      { id: "m1", title: "Operation: Brush Teeth" },
      { id: "m2", title: "Mission: Toy Tidy" },
    ]);
    getMissionHistoryMock.mockResolvedValue([
      { date: "2026-03-04", missions: [{ title: "Operation: Brush Teeth", powerAwarded: 10 }] },
      {
        date: "2026-03-05",
        missions: [
          { title: "Operation: Brush Teeth", powerAwarded: 10 },
          { title: "Mission: Toy Tidy", powerAwarded: 8 },
        ],
      },
    ]);

    const response = await GET();
    const payload = (await response.json()) as {
      cycleDate: string;
      days: string[];
      heroes: Array<{
        profileId: string;
        todayCompleted: number;
        todayTotal: number;
        daily: Array<{ date: string; completed: number }>;
      }>;
    };

    expect(response.status).toBe(200);
    expect(payload.cycleDate).toBe("2026-03-05");
    expect(payload.days).toHaveLength(7);
    expect(payload.days[0]).toBe("2026-02-27");
    expect(payload.days[6]).toBe("2026-03-05");
    expect(payload.heroes).toHaveLength(1);
    expect(payload.heroes[0]?.profileId).toBe("captain-alpha");
    expect(payload.heroes[0]?.todayCompleted).toBe(2);
    expect(payload.heroes[0]?.todayTotal).toBe(2);
    expect(payload.heroes[0]?.daily.find((d) => d.date === "2026-03-04")?.completed).toBe(1);
    expect(getMissionsMock).toHaveBeenCalledWith("captain-alpha");
    expect(getMissionHistoryMock).toHaveBeenCalledWith("captain-alpha", 7);
  });
});

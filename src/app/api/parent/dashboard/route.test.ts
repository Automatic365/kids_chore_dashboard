import { beforeEach, describe, expect, it, vi } from "vitest";

const isParentAuthenticatedMock = vi.hoisted(() => vi.fn());
const getParentDashboardMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/auth", () => ({
  isParentAuthenticated: isParentAuthenticatedMock,
}));

vi.mock("@/lib/server/repository", () => ({
  getRepository: () => ({
    getParentDashboard: getParentDashboardMock,
  }),
}));

import { GET } from "./route";

describe("GET /api/parent/dashboard", () => {
  beforeEach(() => {
    isParentAuthenticatedMock.mockReset();
    getParentDashboardMock.mockReset();
  });

  it("returns 401 when parent is not authenticated", async () => {
    isParentAuthenticatedMock.mockResolvedValue(false);

    const response = await GET();
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(401);
    expect(payload.error).toBe("Unauthorized");
    expect(getParentDashboardMock).not.toHaveBeenCalled();
  });

  it("returns dashboard data when parent is authenticated", async () => {
    isParentAuthenticatedMock.mockResolvedValue(true);
    getParentDashboardMock.mockResolvedValue({
      profiles: [{ id: "captain-alpha", heroName: "Captain Alpha" }],
      missions: [],
      trashedMissions: [],
      squad: {
        squadPowerCurrent: 30,
        squadPowerMax: 100,
        cycleDate: "2026-03-05",
        squadGoal: null,
      },
      rewards: [],
    });

    const response = await GET();
    const payload = (await response.json()) as {
      profiles: Array<{ id: string; heroName: string }>;
      squad: { cycleDate: string };
    };

    expect(response.status).toBe(200);
    expect(payload.profiles[0]?.id).toBe("captain-alpha");
    expect(payload.squad.cycleDate).toBe("2026-03-05");
    expect(getParentDashboardMock).toHaveBeenCalledTimes(1);
  });
});

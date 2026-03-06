import { beforeEach, describe, expect, it, vi } from "vitest";

const getSquadStateMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/repository", () => ({
  getRepository: () => ({
    getSquadState: getSquadStateMock,
  }),
}));

import { GET } from "./route";

describe("GET /api/public/squad-state", () => {
  beforeEach(() => {
    getSquadStateMock.mockReset();
  });

  it("returns squad state", async () => {
    getSquadStateMock.mockResolvedValue({
      squadPowerCurrent: 40,
      squadPowerMax: 100,
      cycleDate: "2026-03-06",
      squadGoal: null,
    });

    const response = await GET();
    const payload = (await response.json()) as {
      squad: { squadPowerCurrent: number; cycleDate: string };
    };

    expect(response.status).toBe(200);
    expect(payload.squad.squadPowerCurrent).toBe(40);
    expect(payload.squad.cycleDate).toBe("2026-03-06");
    expect(getSquadStateMock).toHaveBeenCalledTimes(1);
  });
});

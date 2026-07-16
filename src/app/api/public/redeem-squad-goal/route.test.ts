import { beforeEach, describe, expect, it, vi } from "vitest";

const getSquadStateMock = vi.hoisted(() => vi.fn());
const redeemSquadGoalMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/repository", () => ({
  getRepository: () => ({
    getSquadState: getSquadStateMock,
    redeemSquadGoal: redeemSquadGoalMock,
  }),
}));

import { POST } from "./route";

function makeRequest(requestId = "req-squad-claim") {
  return new Request("http://localhost/api/public/redeem-squad-goal", {
    method: "POST",
    headers: { "x-request-id": requestId },
  });
}

describe("POST /api/public/redeem-squad-goal", () => {
  beforeEach(() => {
    getSquadStateMock.mockReset();
    redeemSquadGoalMock.mockReset();
  });

  it("returns 409 when no squad goal is set", async () => {
    getSquadStateMock.mockResolvedValue({
      squadPowerCurrent: 50,
      squadPowerMax: 100,
      cycleDate: "2026-07-13",
      squadGoal: null,
      goalCompletionCount: 0,
    });

    const response = await POST(makeRequest());
    const payload = (await response.json()) as {
      ok: boolean;
      error: { code: string };
    };

    expect(response.status).toBe(409);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("NO_SQUAD_GOAL");
    expect(redeemSquadGoalMock).not.toHaveBeenCalled();
  });

  it("returns 409 when the goal target is not reached", async () => {
    getSquadStateMock.mockResolvedValue({
      squadPowerCurrent: 40,
      squadPowerMax: 100,
      cycleDate: "2026-07-13",
      squadGoal: {
        title: "Movie Night",
        targetPower: 50,
        rewardDescription: "Family movie night",
      },
      goalCompletionCount: 0,
    });

    const response = await POST(makeRequest());
    const payload = (await response.json()) as {
      ok: boolean;
      error: { code: string };
    };

    expect(response.status).toBe(409);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("GOAL_NOT_REACHED");
    expect(redeemSquadGoalMock).not.toHaveBeenCalled();
  });

  it("redeems when the goal target is reached", async () => {
    getSquadStateMock.mockResolvedValue({
      squadPowerCurrent: 50,
      squadPowerMax: 100,
      cycleDate: "2026-07-13",
      squadGoal: {
        title: "Movie Night",
        targetPower: 50,
        rewardDescription: "Family movie night",
      },
      goalCompletionCount: 1,
    });
    redeemSquadGoalMock.mockResolvedValue({
      squadPowerCurrent: 0,
      squadPowerMax: 100,
      cycleDate: "2026-07-13",
      squadGoal: {
        title: "Movie Night",
        targetPower: 50,
        rewardDescription: "Family movie night",
      },
      goalCompletionCount: 2,
    });

    const response = await POST(makeRequest("req-squad-ok"));
    const payload = (await response.json()) as {
      ok: boolean;
      requestId: string;
      squad: { squadPowerCurrent: number; goalCompletionCount: number };
    };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.requestId).toBe("req-squad-ok");
    expect(payload.squad.squadPowerCurrent).toBe(0);
    expect(payload.squad.goalCompletionCount).toBe(2);
    expect(redeemSquadGoalMock).toHaveBeenCalledTimes(1);
  });

  it("maps repository errors through the error helper", async () => {
    getSquadStateMock.mockResolvedValue({
      squadPowerCurrent: 60,
      squadPowerMax: 100,
      cycleDate: "2026-07-13",
      squadGoal: {
        title: "Movie Night",
        targetPower: 50,
        rewardDescription: "Family movie night",
      },
      goalCompletionCount: 0,
    });
    redeemSquadGoalMock.mockRejectedValue(new Error("Supabase is not configured"));

    const response = await POST(makeRequest());
    const payload = (await response.json()) as {
      ok: boolean;
      error: { code: string; message: string };
    };

    expect(response.status).toBe(500);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("REDEEM_SQUAD_GOAL_FAILED");
    expect(payload.error.message).toContain("Supabase is not configured");
  });
});

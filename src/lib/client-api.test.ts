import { beforeEach, describe, expect, it, vi } from "vitest";

const localClaimSquadGoalMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/public-env", () => ({
  publicEnv: { useRemoteApi: true },
}));

vi.mock("@/lib/local-data", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/local-data")>()),
  localClaimSquadGoal: localClaimSquadGoalMock,
}));

import { claimSquadGoal } from "@/lib/client-api";

describe("withFallback error handling (via claimSquadGoal)", () => {
  beforeEach(() => {
    localClaimSquadGoalMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("propagates 4xx business rejections instead of falling back to local", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ error: { message: "Squad goal not reached yet" } }),
          { status: 409, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    await expect(claimSquadGoal()).rejects.toMatchObject({
      name: "ApiError",
      status: 409,
      message: "Squad goal not reached yet",
    });
    expect(localClaimSquadGoalMock).not.toHaveBeenCalled();
  });

  it("falls back to local storage when the network fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    localClaimSquadGoalMock.mockResolvedValue({
      squadPowerCurrent: 0,
      squadPowerMax: 100,
      cycleDate: "2026-07-16",
      squadGoal: null,
      goalCompletionCount: 1,
    });

    const result = await claimSquadGoal();

    expect(result.goalCompletionCount).toBe(1);
    expect(localClaimSquadGoalMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to local storage on 5xx server errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { message: "boom" } }), {
          status: 500,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    localClaimSquadGoalMock.mockResolvedValue({
      squadPowerCurrent: 0,
      squadPowerMax: 100,
      cycleDate: "2026-07-16",
      squadGoal: null,
      goalCompletionCount: 2,
    });

    const result = await claimSquadGoal();

    expect(result.goalCompletionCount).toBe(2);
    expect(localClaimSquadGoalMock).toHaveBeenCalledTimes(1);
  });
});

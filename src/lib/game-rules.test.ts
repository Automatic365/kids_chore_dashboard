import { describe, expect, it } from "vitest";

import {
  computeNextStreakState,
  evaluateUndoEligibility,
  previousCycleDate,
} from "@/lib/game-rules";

describe("game-rules", () => {
  it("computes previous cycle date", () => {
    expect(previousCycleDate("2026-03-05")).toBe("2026-03-04");
  });

  it("increments streak when prior date was yesterday", () => {
    const next = computeNextStreakState({
      currentStreak: 3,
      lastStreakDate: "2026-03-04",
      cycleDate: "2026-03-05",
    });
    expect(next.currentStreak).toBe(4);
    expect(next.lastStreakDate).toBe("2026-03-05");
  });

  it("starts streak at 1 after a gap", () => {
    const next = computeNextStreakState({
      currentStreak: 7,
      lastStreakDate: "2026-03-01",
      cycleDate: "2026-03-05",
    });
    expect(next.currentStreak).toBe(1);
    expect(next.lastStreakDate).toBe("2026-03-05");
  });

  it("blocks undo when unspent points are insufficient", () => {
    const result = evaluateUndoEligibility({
      profilePowerLevel: 5,
      pointsAwarded: 12,
    });

    expect(result.allowed).toBe(false);
    expect(result.insufficientUnspentPoints).toBe(true);
    expect(result.pointsRequiredToUndo).toBe(12);
  });

  it("allows force undo regardless of current unspent points", () => {
    const result = evaluateUndoEligibility({
      force: true,
      profilePowerLevel: 0,
      pointsAwarded: 20,
    });

    expect(result.allowed).toBe(true);
    expect(result.insufficientUnspentPoints).toBe(false);
  });
});

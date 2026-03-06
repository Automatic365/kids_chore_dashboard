import { describe, expect, it } from "vitest";

import {
  didHeroLevelIncrease,
  shouldTriggerSquadGoalWin,
} from "@/lib/board-rules";

describe("board-rules", () => {
  it("detects level increases across thresholds", () => {
    expect(didHeroLevelIncrease(40, 50)).toBe(true);
    expect(didHeroLevelIncrease(55, 149)).toBe(false);
    expect(didHeroLevelIncrease(149, 150)).toBe(true);
  });

  it("only triggers squad win when a configured goal is crossed", () => {
    const withoutGoal = shouldTriggerSquadGoalWin(
      {
        squadPowerCurrent: 80,
        squadPowerMax: 100,
        cycleDate: "2026-03-06",
        squadGoal: null,
      },
      100,
    );
    expect(withoutGoal).toBe(false);

    const withGoal = shouldTriggerSquadGoalWin(
      {
        squadPowerCurrent: 80,
        squadPowerMax: 100,
        cycleDate: "2026-03-06",
        squadGoal: {
          title: "Team Goal",
          targetPower: 90,
          rewardDescription: "Movie night",
        },
      },
      90,
    );
    expect(withGoal).toBe(true);
  });
});

import { describe, expect, it } from "vitest";

import { getRewardCooldownStatus } from "@/lib/reward-cooldown";
import { Reward } from "@/lib/types/domain";

const reward: Reward = {
  id: "r1",
  title: "10 Extra Minutes of TV",
  description: "TV time",
  pointCost: 60,
  targetDaysToEarn: 10,
  minDaysBetweenClaims: 10,
  isActive: true,
  sortOrder: 1,
};

describe("getRewardCooldownStatus", () => {
  it("returns inactive when the reward has no cooldown", () => {
    expect(
      getRewardCooldownStatus({
        reward: { ...reward, minDaysBetweenClaims: null },
        claims: [],
        now: new Date("2026-03-12T12:00:00.000Z"),
        timeZone: "America/Chicago",
      }),
    ).toMatchObject({
      cooldownActive: false,
      nextClaimDate: null,
      cooldownDaysRemaining: null,
    });
  });

  it("blocks claims until the configured number of local cycle days have passed", () => {
    const status = getRewardCooldownStatus({
      reward,
      claims: [{ rewardId: "r1", claimedAt: "2026-03-12T12:00:00.000Z" }],
      now: new Date("2026-03-15T12:00:00.000Z"),
      timeZone: "America/Chicago",
    });

    expect(status.cooldownActive).toBe(true);
    expect(status.nextClaimDate).toBe("2026-03-22");
    expect(status.cooldownDaysRemaining).toBe(7);
  });

  it("allows claims again on the next eligible local date", () => {
    const status = getRewardCooldownStatus({
      reward,
      claims: [{ rewardId: "r1", claimedAt: "2026-03-12T12:00:00.000Z" }],
      now: new Date("2026-03-22T12:00:00.000Z"),
      timeZone: "America/Chicago",
    });

    expect(status.cooldownActive).toBe(false);
    expect(status.nextClaimDate).toBe("2026-03-22");
    expect(status.cooldownDaysRemaining).toBe(0);
  });

  it("evaluates cooldown at asOf date and ignores future claims", () => {
    const status = getRewardCooldownStatus({
      reward: { ...reward, minDaysBetweenClaims: 3 },
      claims: [
        { rewardId: "r1", claimedAt: "2026-03-10T12:00:00.000Z" },
        { rewardId: "r1", claimedAt: "2026-03-16T12:00:00.000Z" },
      ],
      asOf: new Date("2026-03-12T12:00:00.000Z"),
      timeZone: "America/Chicago",
    });

    expect(status.cooldownActive).toBe(true);
    expect(status.nextClaimDate).toBe("2026-03-13");
    expect(status.latestClaimedAt).toBe("2026-03-10T12:00:00.000Z");
  });
});

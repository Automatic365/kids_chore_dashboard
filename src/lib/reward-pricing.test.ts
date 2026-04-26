import { describe, expect, it } from "vitest";

import { getRewardPricingPace, getSuggestedRewardPrice } from "@/lib/reward-pricing";

describe("getRewardPricingPace", () => {
  it("uses the stronger of recent average and current recurring mission capacity", () => {
    expect(
      getRewardPricingPace({
        averageRewardPointsPerHeroPerDay: 1.4,
        currentRecurringDailyCapacityPerHero: 28,
      }),
    ).toBe(28);

    expect(
      getRewardPricingPace({
        averageRewardPointsPerHeroPerDay: 24,
        currentRecurringDailyCapacityPerHero: 18,
      }),
    ).toBe(24);
  });
});

describe("getSuggestedRewardPrice", () => {
  it("returns null when target days are missing", () => {
    expect(getSuggestedRewardPrice(5, null)).toBeNull();
    expect(getSuggestedRewardPrice(5, undefined)).toBeNull();
  });

  it("calculates and rounds small rewards to a whole number", () => {
    expect(getSuggestedRewardPrice(4.2, 3)).toBe(13);
  });

  it("rounds larger rewards to the nearest five", () => {
    expect(getSuggestedRewardPrice(12.6, 4)).toBe(50);
    expect(getSuggestedRewardPrice(13.2, 4)).toBe(55);
  });

  it("clamps suggested prices into the supported range", () => {
    expect(getSuggestedRewardPrice(0.1, 1)).toBe(1);
    expect(getSuggestedRewardPrice(90, 20)).toBe(1000);
  });
});

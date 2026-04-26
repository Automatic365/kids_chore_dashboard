const MIN_REWARD_PRICE = 1;
const MAX_REWARD_PRICE = 1000;

function roundKidFriendly(value: number): number {
  if (value <= 20) {
    return Math.round(value);
  }
  return Math.round(value / 5) * 5;
}

export function getRewardPricingPace(params: {
  averageRewardPointsPerHeroPerDay: number;
  currentRecurringDailyCapacityPerHero: number;
}): number {
  return Math.max(
    0,
    params.averageRewardPointsPerHeroPerDay,
    params.currentRecurringDailyCapacityPerHero,
  );
}

export function getSuggestedRewardPrice(
  estimatedDailyRewardPointsPerHero: number,
  targetDaysToEarn: number | null | undefined,
): number | null {
  if (
    typeof targetDaysToEarn !== "number" ||
    !Number.isFinite(targetDaysToEarn) ||
    targetDaysToEarn <= 0
  ) {
    return null;
  }

  const raw = estimatedDailyRewardPointsPerHero * targetDaysToEarn;
  const rounded = roundKidFriendly(raw);
  return Math.max(MIN_REWARD_PRICE, Math.min(MAX_REWARD_PRICE, rounded));
}

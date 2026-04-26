import { toLocalDateString } from "@/lib/date";
import { Reward } from "@/lib/types/domain";

function addDaysToDateString(date: string, days: number): string {
  const next = new Date(`${date}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

function diffDays(fromDate: string, toDate: string): number {
  const from = new Date(`${fromDate}T00:00:00.000Z`);
  const to = new Date(`${toDate}T00:00:00.000Z`);
  return Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

export interface RewardClaimLike {
  rewardId: string;
  claimedAt: string;
}

export interface RewardCooldownStatus {
  cooldownActive: boolean;
  nextClaimDate: string | null;
  cooldownDaysRemaining: number | null;
  latestClaimedAt: string | null;
}

export function getRewardCooldownStatus(params: {
  reward: Reward;
  claims: RewardClaimLike[];
  now?: Date;
  asOf?: Date;
  timeZone?: string;
}): RewardCooldownStatus {
  if (
    typeof params.reward.minDaysBetweenClaims !== "number" ||
    !Number.isFinite(params.reward.minDaysBetweenClaims) ||
    params.reward.minDaysBetweenClaims <= 0
  ) {
    return {
      cooldownActive: false,
      nextClaimDate: null,
      cooldownDaysRemaining: null,
      latestClaimedAt: null,
    };
  }

  const referenceDate = params.asOf ?? params.now ?? new Date();
  const latestClaim = params.claims
    .filter((claim) => claim.rewardId === params.reward.id)
    .filter((claim) => {
      const claimedAt = new Date(claim.claimedAt);
      if (Number.isNaN(claimedAt.getTime())) {
        return false;
      }
      return claimedAt.getTime() <= referenceDate.getTime();
    })
    .sort((a, b) => b.claimedAt.localeCompare(a.claimedAt))[0];

  if (!latestClaim) {
    return {
      cooldownActive: false,
      nextClaimDate: null,
      cooldownDaysRemaining: null,
      latestClaimedAt: null,
    };
  }

  const timeZone = params.timeZone;
  const latestClaimDate = toLocalDateString(new Date(latestClaim.claimedAt), timeZone);
  const nextClaimDate = addDaysToDateString(
    latestClaimDate,
    params.reward.minDaysBetweenClaims,
  );
  const today = toLocalDateString(referenceDate, timeZone);

  if (today >= nextClaimDate) {
    return {
      cooldownActive: false,
      nextClaimDate,
      cooldownDaysRemaining: 0,
      latestClaimedAt: latestClaim.claimedAt,
    };
  }

  return {
    cooldownActive: true,
    nextClaimDate,
    cooldownDaysRemaining: diffDays(today, nextClaimDate),
    latestClaimedAt: latestClaim.claimedAt,
  };
}

export interface UndoEligibilityInput {
  force?: boolean;
  profileRewardPoints: number;
  pointsAwarded: number;
}

export interface UndoEligibilityResult {
  allowed: boolean;
  insufficientUnspentPoints: boolean;
  pointsRequiredToUndo?: number;
}

export interface StreakStateInput {
  currentStreak: number;
  lastStreakDate: string | null;
  cycleDate: string;
}

export interface StreakStateResult {
  currentStreak: number;
  lastStreakDate: string;
}

export interface RecomputedStreakState {
  currentStreak: number;
  lastStreakDate: string | null;
}

export function previousCycleDate(cycleDate: string): string {
  const date = new Date(`${cycleDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function computeNextStreakState(input: StreakStateInput): StreakStateResult {
  const yesterday = previousCycleDate(input.cycleDate);

  if (input.lastStreakDate === yesterday) {
    return {
      currentStreak: input.currentStreak + 1,
      lastStreakDate: input.cycleDate,
    };
  }

  if (input.lastStreakDate === input.cycleDate) {
    return {
      currentStreak: input.currentStreak,
      lastStreakDate: input.cycleDate,
    };
  }

  return {
    currentStreak: 1,
    lastStreakDate: input.cycleDate,
  };
}

export function recomputeStreakStateFromCompletionDates(
  completionDates: string[],
): RecomputedStreakState {
  const uniqueSortedDates = Array.from(new Set(completionDates)).sort((a, b) =>
    a.localeCompare(b),
  );

  if (uniqueSortedDates.length === 0) {
    return {
      currentStreak: 0,
      lastStreakDate: null,
    };
  }

  const lastStreakDate = uniqueSortedDates[uniqueSortedDates.length - 1] ?? null;
  if (!lastStreakDate) {
    return {
      currentStreak: 0,
      lastStreakDate: null,
    };
  }

  let streak = 1;
  let cursor = lastStreakDate;

  for (let index = uniqueSortedDates.length - 2; index >= 0; index -= 1) {
    const candidate = uniqueSortedDates[index];
    if (!candidate) continue;
    if (candidate !== previousCycleDate(cursor)) {
      break;
    }
    streak += 1;
    cursor = candidate;
  }

  return {
    currentStreak: streak,
    lastStreakDate,
  };
}

export function evaluateUndoEligibility(
  input: UndoEligibilityInput,
): UndoEligibilityResult {
  if (input.force) {
    return {
      allowed: true,
      insufficientUnspentPoints: false,
    };
  }

  if (input.profileRewardPoints < input.pointsAwarded) {
    return {
      allowed: false,
      insufficientUnspentPoints: true,
      pointsRequiredToUndo: input.pointsAwarded,
    };
  }

  return {
    allowed: true,
    insufficientUnspentPoints: false,
  };
}

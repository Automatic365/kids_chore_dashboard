export interface UndoEligibilityInput {
  force?: boolean;
  profilePowerLevel: number;
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

export function evaluateUndoEligibility(
  input: UndoEligibilityInput,
): UndoEligibilityResult {
  if (input.force) {
    return {
      allowed: true,
      insufficientUnspentPoints: false,
    };
  }

  if (input.profilePowerLevel < input.pointsAwarded) {
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

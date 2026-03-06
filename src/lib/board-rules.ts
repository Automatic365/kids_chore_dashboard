import { getHeroLevelIndex } from "@/lib/hero-levels";
import { SquadState } from "@/lib/types/domain";

export function didHeroLevelIncrease(
  previousPowerLevel: number,
  nextPowerLevel: number,
): boolean {
  return getHeroLevelIndex(nextPowerLevel) > getHeroLevelIndex(previousPowerLevel);
}

export function shouldTriggerSquadGoalWin(
  previousSquad: SquadState,
  nextSquadPowerCurrent: number,
): boolean {
  const target = previousSquad.squadGoal?.targetPower;
  if (typeof target !== "number") {
    return false;
  }

  return (
    previousSquad.squadPowerCurrent < target &&
    nextSquadPowerCurrent >= target
  );
}

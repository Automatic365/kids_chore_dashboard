export const DEFAULT_SQUAD_POWER_MAX = 1000;

export function normalizeSquadPowerMax(value: number | null | undefined): number {
  if (!Number.isFinite(value) || (value ?? 0) <= 0) {
    return DEFAULT_SQUAD_POWER_MAX;
  }

  return Math.max(Number(value), DEFAULT_SQUAD_POWER_MAX);
}

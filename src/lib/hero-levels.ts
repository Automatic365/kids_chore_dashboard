interface HeroLevel {
  minPower: number;
  name: string;
  color: string;
}

const HERO_LEVELS: HeroLevel[] = [
  { minPower: 0, name: "Recruit", color: "#94a3b8" },
  { minPower: 50, name: "Hero", color: "#3b82f6" },
  { minPower: 150, name: "Champion", color: "#f59e0b" },
  { minPower: 300, name: "Legend", color: "#ef4444" },
  { minPower: 600, name: "Cosmic", color: "#22c55e" },
];

export function getHeroLevelIndex(powerLevel: number): number {
  let index = 0;
  for (let i = 0; i < HERO_LEVELS.length; i += 1) {
    if (powerLevel >= HERO_LEVELS[i]!.minPower) {
      index = i;
    }
  }
  return index;
}

export function getHeroLevel(
  powerLevel: number,
): { name: string; color: string; nextPower: number | null } {
  const current = HERO_LEVELS[getHeroLevelIndex(powerLevel)]!;

  const next = HERO_LEVELS.find((level) => level.minPower > current.minPower) ?? null;
  return {
    name: current.name,
    color: current.color,
    nextPower: next ? next.minPower : null,
  };
}

export function getStreakBadge(streak: number): string | null {
  if (streak >= 30) return "🌟";
  if (streak >= 14) return "💫";
  if (streak >= 7) return "⚡";
  if (streak >= 3) return "🔥";
  return null;
}

export function getHeroLevelProgress(powerLevel: number): {
  progressPercent: number;
  currentMinPower: number;
  nextPower: number | null;
} {
  const currentIndex = getHeroLevelIndex(powerLevel);
  const current = HERO_LEVELS[currentIndex]!;
  const next = HERO_LEVELS[currentIndex + 1] ?? null;

  if (!next) {
    return {
      progressPercent: 100,
      currentMinPower: current.minPower,
      nextPower: null,
    };
  }

  const span = Math.max(1, next.minPower - current.minPower);
  const offset = Math.max(0, powerLevel - current.minPower);
  return {
    progressPercent: Math.min(100, Math.round((offset / span) * 100)),
    currentMinPower: current.minPower,
    nextPower: next.minPower,
  };
}

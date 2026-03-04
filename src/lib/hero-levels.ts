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

export function getHeroLevel(
  powerLevel: number,
): { name: string; color: string; nextPower: number | null } {
  let current = HERO_LEVELS[0];
  for (const level of HERO_LEVELS) {
    if (powerLevel >= level.minPower) {
      current = level;
    }
  }

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

interface HeroLevel {
  minPower: number;
  name: string;
  color: string;
}

const HERO_LEVELS: HeroLevel[] = [
  { minPower: 0, name: "Recruit", color: "#94a3b8" },
  { minPower: 75, name: "Sidekick", color: "#60a5fa" },
  { minPower: 180, name: "Hero", color: "#3b82f6" },
  { minPower: 340, name: "Super Hero", color: "#2563eb" },
  { minPower: 575, name: "Champion", color: "#f59e0b" },
  { minPower: 900, name: "Mega Champion", color: "#f97316" },
  { minPower: 1325, name: "Legend", color: "#ef4444" },
  { minPower: 1775, name: "Master Legend", color: "#dc2626" },
  { minPower: 2200, name: "Superhero Elite", color: "#a855f7" },
  { minPower: 2500, name: "Legendary Superhero", color: "#22c55e" },
];

const PRESTIGE_XP_SPAN = 1250;

export function getHeroLevelIndex(powerLevel: number): number {
  let index = 0;
  for (let i = 0; i < HERO_LEVELS.length; i += 1) {
    if (powerLevel >= HERO_LEVELS[i]!.minPower) {
      index = i;
    }
  }
  return index;
}

function getPrestigeStars(powerLevel: number): number {
  const topLevel = HERO_LEVELS[HERO_LEVELS.length - 1]!;
  if (powerLevel < topLevel.minPower + PRESTIGE_XP_SPAN) {
    return 0;
  }

  return Math.floor((powerLevel - topLevel.minPower) / PRESTIGE_XP_SPAN);
}

export function getHeroLevel(
  powerLevel: number,
): {
  name: string;
  color: string;
  nextPower: number | null;
  prestigeStars: number;
  displayName: string;
} {
  const currentIndex = getHeroLevelIndex(powerLevel);
  const current = HERO_LEVELS[currentIndex]!;
  const isTopLevel = currentIndex === HERO_LEVELS.length - 1;
  const prestigeStars = isTopLevel ? getPrestigeStars(powerLevel) : 0;
  const next = isTopLevel
    ? { minPower: current.minPower + (prestigeStars + 1) * PRESTIGE_XP_SPAN }
    : HERO_LEVELS[currentIndex + 1] ?? null;

  return {
    name: current.name,
    color: current.color,
    nextPower: next ? next.minPower : null,
    prestigeStars,
    displayName:
      prestigeStars > 0 ? `${current.name} ${"★".repeat(prestigeStars)}` : current.name,
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
  const isTopLevel = currentIndex === HERO_LEVELS.length - 1;

  if (!isTopLevel) {
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

  const prestigeStars = getPrestigeStars(powerLevel);
  const currentMinPower = current.minPower + prestigeStars * PRESTIGE_XP_SPAN;
  const nextPower = currentMinPower + PRESTIGE_XP_SPAN;
  const span = PRESTIGE_XP_SPAN;
  const offset = Math.max(0, powerLevel - currentMinPower);

  return {
    progressPercent: Math.min(100, Math.round((offset / span) * 100)),
    currentMinPower,
    nextPower,
  };
}

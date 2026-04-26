import {
  MissionHistoryEntry,
  MissionWithState,
  ParentSummaryData,
  ParentSummaryDay,
  ParentSummaryMissionStat,
  Profile,
} from "@/lib/types/domain";

function roundToTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

function topMissionStats(
  history: MissionHistoryEntry[],
  limit = 5,
): ParentSummaryMissionStat[] {
  const byTitle = new Map<string, ParentSummaryMissionStat>();

  for (const entry of history) {
    for (const mission of entry.missions) {
      const existing = byTitle.get(mission.title) ?? {
        title: mission.title,
        completedCount: 0,
        totalRewardPoints: 0,
        totalXpPoints: 0,
      };
      existing.completedCount += 1;
      existing.totalRewardPoints += mission.powerAwarded;
      existing.totalXpPoints += mission.powerAwarded;
      byTitle.set(mission.title, existing);
    }
  }

  return Array.from(byTitle.values())
    .sort((a, b) => {
      if (b.completedCount !== a.completedCount) {
        return b.completedCount - a.completedCount;
      }
      if (b.totalRewardPoints !== a.totalRewardPoints) {
        return b.totalRewardPoints - a.totalRewardPoints;
      }
      return a.title.localeCompare(b.title);
    })
    .slice(0, limit);
}

function dailyStats(days: string[], history: MissionHistoryEntry[]): ParentSummaryDay[] {
  const byDate = new Map<
    string,
    { completed: number; rewardPoints: number; xpPoints: number }
  >();

  for (const entry of history) {
    const existing = byDate.get(entry.date) ?? {
      completed: 0,
      rewardPoints: 0,
      xpPoints: 0,
    };
    existing.completed += entry.missions.length;
    existing.rewardPoints += entry.missions.reduce(
      (sum, mission) => sum + mission.powerAwarded,
      0,
    );
    existing.xpPoints += entry.missions.reduce((sum, mission) => sum + mission.powerAwarded, 0);
    byDate.set(entry.date, existing);
  }

  return days.map((date) => {
    const row = byDate.get(date);
    return {
      date,
      completed: row?.completed ?? 0,
      rewardPoints: row?.rewardPoints ?? 0,
      xpPoints: row?.xpPoints ?? 0,
    };
  });
}

export function buildDateWindow(endDate: string, days: number): string[] {
  return buildDateWindowFromStart({ endDate, days });
}

export function buildDateWindowFromStart(params: {
  endDate: string;
  days: number;
  startDate?: string;
}): string[] {
  const last = new Date(`${params.endDate}T00:00:00.000Z`);
  const earliest = new Date(last);
  earliest.setUTCDate(last.getUTCDate() - Math.max(0, params.days - 1));
  const earliestString = earliest.toISOString().slice(0, 10);
  const effectiveStart =
    params.startDate && params.startDate > earliestString
      ? new Date(`${params.startDate}T00:00:00.000Z`)
      : earliest;
  const values: string[] = [];
  for (
    const next = new Date(effectiveStart);
    next <= last;
    next.setUTCDate(next.getUTCDate() + 1)
  ) {
    values.push(next.toISOString().slice(0, 10));
  }
  return values;
}

export function buildParentSummary(params: {
  cycleDate: string;
  windowDays?: number;
  analyticsStartDate?: string;
  profiles: Profile[];
  missionsByProfileId: Map<string, MissionWithState[]>;
  historyByProfileId: Map<string, MissionHistoryEntry[]>;
}): ParentSummaryData {
  const windowDays = params.windowDays ?? 30;
  const days = buildDateWindowFromStart({
    endDate: params.cycleDate,
    days: windowDays,
    startDate: params.analyticsStartDate,
  });
  const divisorDays = Math.max(1, days.length);

  const heroes = params.profiles.map((profile) => {
    const missions = params.missionsByProfileId.get(profile.id) ?? [];
    const history = params.historyByProfileId.get(profile.id) ?? [];
    const daily = dailyStats(days, history);
    const totalRewardPointsEarned = daily.reduce((sum, day) => sum + day.rewardPoints, 0);
    const totalXpPointsEarned = daily.reduce((sum, day) => sum + day.xpPoints, 0);

    return {
      profileId: profile.id,
      heroName: profile.heroName,
      todayCompleted: daily.find((day) => day.date === params.cycleDate)?.completed ?? 0,
      todayTotal: missions.length,
      averageRewardPointsPerDay: roundToTenth(totalRewardPointsEarned / divisorDays),
      averageXpPointsPerDay: roundToTenth(totalXpPointsEarned / divisorDays),
      topMissions: topMissionStats(history),
      daily,
    };
  });

  const householdHistory = Array.from(params.historyByProfileId.values()).flat();
  const householdDaily = dailyStats(days, householdHistory);
  const totalRewardPointsEarned = householdDaily.reduce(
    (sum, day) => sum + day.rewardPoints,
    0,
  );
  const totalXpPointsEarned = householdDaily.reduce((sum, day) => sum + day.xpPoints, 0);
  const heroCount = Math.max(1, params.profiles.length);

  return {
    cycleDate: params.cycleDate,
    windowDays: divisorDays,
    days,
    household: {
      averageRewardPointsPerDay: roundToTenth(totalRewardPointsEarned / divisorDays),
      averageXpPointsPerDay: roundToTenth(totalXpPointsEarned / divisorDays),
      averageRewardPointsPerHeroPerDay: roundToTenth(
        totalRewardPointsEarned / divisorDays / heroCount,
      ),
      averageXpPointsPerHeroPerDay: roundToTenth(totalXpPointsEarned / divisorDays / heroCount),
      totalRewardPointsEarned,
      totalXpPointsEarned,
      totalCompleted: householdDaily.reduce((sum, day) => sum + day.completed, 0),
      topMissions: topMissionStats(householdHistory),
      daily: householdDaily,
    },
    heroes,
  };
}

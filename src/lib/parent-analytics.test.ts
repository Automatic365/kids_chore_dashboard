import { describe, expect, it } from "vitest";

import { buildParentSummary } from "@/lib/parent-analytics";
import { MissionHistoryEntry, MissionWithState, Profile } from "@/lib/types/domain";

describe("buildParentSummary", () => {
  it("builds household and hero analytics from 30-day mission history", () => {
    const profiles: Profile[] = [
      {
        id: "alpha",
        heroName: "Captain Alpha",
        avatarUrl: "/alpha.png",
        uiMode: "text",
        heroCardObjectPosition: "center",
        rewardPoints: 20,
        xpPoints: 50,
        powerLevel: 50,
        currentStreak: 2,
        lastStreakDate: "2026-03-05",
      },
      {
        id: "beta",
        heroName: "Super Beta",
        avatarUrl: "/beta.png",
        uiMode: "picture",
        heroCardObjectPosition: "center",
        rewardPoints: 18,
        xpPoints: 40,
        powerLevel: 40,
        currentStreak: 1,
        lastStreakDate: "2026-03-05",
      },
    ];

    const missionsByProfileId = new Map<string, MissionWithState[]>([
      [
        "alpha",
        [
          {
            id: "m1",
            profileId: "alpha",
            title: "Brush Teeth",
            instructions: "Brush",
            imageUrl: null,
            powerValue: 10,
            isActive: true,
            recurringDaily: true,
            sortOrder: 1,
            deletedAt: null,
            completedToday: false,
          },
          {
            id: "m2",
            profileId: "alpha",
            title: "Make Bed",
            instructions: "Make bed",
            imageUrl: null,
            powerValue: 8,
            isActive: true,
            recurringDaily: true,
            sortOrder: 2,
            deletedAt: null,
            completedToday: false,
          },
        ],
      ],
      [
        "beta",
        [
          {
            id: "m3",
            profileId: "beta",
            title: "Toy Tidy",
            instructions: "Tidy toys",
            imageUrl: null,
            powerValue: 6,
            isActive: true,
            recurringDaily: true,
            sortOrder: 1,
            deletedAt: null,
            completedToday: false,
          },
        ],
      ],
    ]);

    const historyByProfileId = new Map<string, MissionHistoryEntry[]>([
      [
        "alpha",
        [
          {
            date: "2026-03-04",
            missions: [{ title: "Brush Teeth", powerAwarded: 10 }],
          },
          {
            date: "2026-03-05",
            missions: [
              { title: "Brush Teeth", powerAwarded: 10 },
              { title: "Make Bed", powerAwarded: 8 },
            ],
          },
        ],
      ],
      [
        "beta",
        [
          {
            date: "2026-03-05",
            missions: [{ title: "Toy Tidy", powerAwarded: 6 }],
          },
        ],
      ],
    ]);

    const summary = buildParentSummary({
      cycleDate: "2026-03-05",
      windowDays: 30,
      analyticsStartDate: "2026-02-04",
      profiles,
      missionsByProfileId,
      historyByProfileId,
    });

    expect(summary.days).toHaveLength(30);
    expect(summary.household.totalCompleted).toBe(4);
    expect(summary.household.totalRewardPointsEarned).toBe(34);
    expect(summary.household.averageRewardPointsPerDay).toBeCloseTo(1.1, 5);
    expect(summary.household.averageRewardPointsPerHeroPerDay).toBeCloseTo(0.6, 5);
    expect(summary.household.topMissions[0]).toMatchObject({
      title: "Brush Teeth",
      completedCount: 2,
      totalRewardPoints: 20,
    });
    expect(summary.heroes[0]).toMatchObject({
      profileId: "alpha",
      todayCompleted: 2,
      todayTotal: 2,
    });
    expect(summary.heroes[0]?.averageRewardPointsPerDay).toBeCloseTo(0.9, 5);
    expect(summary.heroes[1]?.averageRewardPointsPerDay).toBeCloseTo(0.2, 5);
    expect(
      summary.heroes[1]?.daily.find((day) => day.date === "2026-03-05"),
    ).toMatchObject({
      completed: 1,
      rewardPoints: 6,
      xpPoints: 6,
    });
  });
});

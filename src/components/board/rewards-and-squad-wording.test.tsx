import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RewardsSection } from "@/components/board/rewards-section";
import { SquadSection } from "@/components/board/squad-section";
import type { Profile, Reward, SquadState } from "@/lib/types/domain";

const profile: Profile = {
  id: "p1",
  heroName: "Nova",
  avatarUrl: "",
  uiMode: "text",
  heroCardObjectPosition: "center",
  rewardPoints: 20,
  xpPoints: 40,
  powerLevel: 40,
  currentStreak: 0,
  lastStreakDate: null,
};

const reward: Reward = {
  id: "r1",
  title: "Movie Night",
  description: "Pick the movie",
  pointCost: 7,
  targetDaysToEarn: null,
  minDaysBetweenClaims: null,
  isActive: true,
  sortOrder: 1,
};

const squad: SquadState = {
  squadPowerCurrent: 30,
  squadPowerMax: 100,
  cycleDate: "2026-04-26",
  squadGoal: null,
};

describe("Rewards and squad terminology", () => {
  it("uses Reward Points language in rewards UI", () => {
    render(
      <RewardsSection
        rewards={[reward]}
        profile={profile}
        boardEditMode={false}
        updatingRewardById={{}}
        savedRewardById={{}}
        rewardCooldownById={{}}
        onClaim={vi.fn()}
        onUpdateCost={vi.fn()}
      />,
    );

    expect(screen.getByText("Spend Reward Points")).toBeInTheDocument();
    expect(screen.getByText("7 Reward Points")).toBeInTheDocument();
  });

  it("keeps Squad Power terminology in the squad header", () => {
    render(
      <SquadSection
        profile={profile}
        squad={squad}
        heroLevel={{ name: "Cadet", color: "#fff", nextPower: 50, displayName: "Cadet" }}
        personalProgress={25}
        completedCount={1}
        missionCount={4}
        todayRewardPointsEarned={7}
        unreadNotificationCount={0}
        isPressingParentSpot={false}
        onLongPressStart={vi.fn()}
        onLongPressEnd={vi.fn()}
        showSquadWin={false}
        onDismissSquadWin={vi.fn()}
      />,
    );

    expect(screen.getByText("Today's Reward Points")).toBeInTheDocument();
    expect(screen.getByText("Personal Reward Points")).toBeInTheDocument();
    expect(screen.getByText("Squad Power")).toBeInTheDocument();
  });
});

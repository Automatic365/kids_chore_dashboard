import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useMissionBoardController } from "@/components/board/use-mission-board-controller";
import type { Profile, Reward, SquadState } from "@/lib/types/domain";

const {
  claimRewardMock,
  fetchProfilesMock,
  fetchMissionsMock,
  fetchRewardClaimsMock,
  fetchRewardsMock,
  fetchSquadStateMock,
  fetchUnreadNotificationCountMock,
  reportErrorMock,
  confirmMock,
} = vi.hoisted(() => ({
  claimRewardMock: vi.fn(),
  fetchProfilesMock: vi.fn(),
  fetchMissionsMock: vi.fn(),
  fetchRewardClaimsMock: vi.fn(),
  fetchRewardsMock: vi.fn(),
  fetchSquadStateMock: vi.fn(),
  fetchUnreadNotificationCountMock: vi.fn(),
  reportErrorMock: vi.fn(),
  confirmMock: vi.fn(),
}));

vi.mock("@/lib/client-api", () => ({
  claimReward: claimRewardMock,
  completeMission: vi.fn(),
  deleteMission: vi.fn(),
  fetchMissionHistory: vi.fn(),
  fetchMissions: fetchMissionsMock,
  fetchUnreadNotificationCount: fetchUnreadNotificationCountMock,
  fetchProfiles: fetchProfilesMock,
  fetchRewardClaims: fetchRewardClaimsMock,
  fetchRewards: fetchRewardsMock,
  fetchSquadState: fetchSquadStateMock,
  isRemoteApiEnabled: vi.fn(() => false),
  returnReward: vi.fn(),
  uncompleteMission: vi.fn(),
  updateMission: vi.fn(),
  updateReward: vi.fn(),
}));

vi.mock("@/lib/board-rules", () => ({
  didHeroLevelIncrease: vi.fn(() => false),
  shouldTriggerSquadGoalWin: vi.fn(() => false),
}));

vi.mock("@/lib/hero-levels", () => ({
  getHeroLevel: vi.fn(() => ({ name: "Cadet", color: "#fff", nextPower: 10, displayName: "Cadet" })),
}));

vi.mock("@/lib/monitoring", () => ({
  reportError: reportErrorMock,
}));

vi.mock("@/lib/offline/queue", () => ({
  enqueueCompletion: vi.fn(),
  flushCompletionQueue: vi.fn(),
  removeQueuedCompletionsForMission: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: vi.fn(() => null),
}));

vi.mock("@/hooks/use-hero-dialog", () => ({
  useHeroDialog: () => ({
    confirm: confirmMock,
    dialogNode: null,
  }),
}));

function Harness() {
  const controller = useMissionBoardController("p1");

  if (controller.loading || !controller.profile || controller.rewards.length === 0) {
    return <div>Loading</div>;
  }

  return (
    <div>
      <button type="button" onClick={() => void controller.claimRewardAction(controller.rewards[0] as Reward)}>
        Claim First Reward
      </button>
      <p data-testid="effect">{controller.effectText ?? ""}</p>
      <p data-testid="reward-points">{controller.profile.rewardPoints}</p>
    </div>
  );
}

const reward: Reward = {
  id: "r1",
  title: "Movie Night",
  description: "Pick the movie",
  pointCost: 5,
  targetDaysToEarn: null,
  minDaysBetweenClaims: null,
  isActive: true,
  sortOrder: 1,
};

const squad: SquadState = {
  squadPowerCurrent: 10,
  squadPowerMax: 100,
  cycleDate: "2026-04-26",
  squadGoal: null,
};

function makeProfile(rewardPoints: number): Profile {
  return {
    id: "p1",
    heroName: "Nova",
    avatarUrl: "",
    uiMode: "text",
    heroCardObjectPosition: "center",
    rewardPoints,
    xpPoints: 20,
    powerLevel: 20,
    currentStreak: 0,
    lastStreakDate: null,
  };
}

function setupBoard(profileRewardPoints: number): void {
  fetchProfilesMock.mockResolvedValue([makeProfile(profileRewardPoints)]);
  fetchMissionsMock.mockResolvedValue([]);
  fetchSquadStateMock.mockResolvedValue(squad);
  fetchRewardsMock.mockResolvedValue([reward]);
  fetchRewardClaimsMock.mockResolvedValue([]);
  fetchUnreadNotificationCountMock.mockResolvedValue(0);
  confirmMock.mockResolvedValue(true);
}

describe("useMissionBoardController claimRewardAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    cleanup();
  });

  it("shows success feedback and updates reward points", async () => {
    setupBoard(10);
    claimRewardMock.mockResolvedValue({
      claimed: true,
      insufficientPoints: false,
      alreadyClaimed: false,
      cooldownActive: false,
      nextClaimDate: null,
      cooldownDaysRemaining: null,
      newRewardPoints: 5,
      newXpPoints: 20,
      newPowerLevel: 20,
      reward,
    });

    render(<Harness />);

    fireEvent.click(await screen.findByRole("button", { name: "Claim First Reward" }));

    await waitFor(() => expect(screen.getByTestId("effect")).toHaveTextContent("REWARD UNLOCKED!"));
    expect(claimRewardMock).toHaveBeenCalledWith({ profileId: "p1", rewardId: "r1" });
  });

  it("shows immediate feedback when points are insufficient before submit", async () => {
    setupBoard(2);

    render(<Harness />);

    fireEvent.click(await screen.findByRole("button", { name: "Claim First Reward" }));

    await waitFor(() =>
      expect(screen.getByTestId("effect")).toHaveTextContent("NEED MORE REWARD POINTS"),
    );
    expect(claimRewardMock).not.toHaveBeenCalled();
    expect(confirmMock).not.toHaveBeenCalled();
  });

  it("shows cooldown feedback when claim is blocked by cooldown", async () => {
    setupBoard(10);
    claimRewardMock.mockResolvedValue({
      claimed: false,
      insufficientPoints: false,
      alreadyClaimed: false,
      cooldownActive: true,
      nextClaimDate: "2026-04-28",
      cooldownDaysRemaining: 2,
      newRewardPoints: 10,
      newXpPoints: 20,
      newPowerLevel: 20,
      reward,
    });

    render(<Harness />);

    fireEvent.click(await screen.findByRole("button", { name: "Claim First Reward" }));

    await waitFor(() => expect(screen.getByTestId("effect")).toHaveTextContent("READY IN 2 DAYS"));
  });

  it("shows failure feedback and reloads board when claim request throws", async () => {
    setupBoard(10);
    claimRewardMock.mockRejectedValue(new Error("network failed"));

    render(<Harness />);

    fireEvent.click(await screen.findByRole("button", { name: "Claim First Reward" }));

    await waitFor(() => expect(screen.getByTestId("effect")).toHaveTextContent("CLAIM FAILED"));
    expect(reportErrorMock).toHaveBeenCalled();
    await waitFor(() => expect(fetchProfilesMock).toHaveBeenCalledTimes(2));
  });
});

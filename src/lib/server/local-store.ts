import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

import { clamp, isValidLocalDateString, toLocalDateString } from "@/lib/date";
import { env } from "@/lib/env";
import {
  computeNextStreakState,
  evaluateUndoEligibility,
  recomputeStreakStateFromCompletionDates,
} from "@/lib/game-rules";
import { toHeroCardObjectPosition } from "@/lib/hero-card-position";
import {
  buildMissionBackfillClientRequestId,
  isMissionBackfillClientRequestId,
} from "@/lib/mission-backfill";
import { getRewardCooldownStatus } from "@/lib/reward-cooldown";
import { STARTER_REWARD_PRESETS } from "@/lib/reward-presets";
import { compareRewardsByCost } from "@/lib/reward-order";
import { generateRewardStickerDataUrl } from "@/lib/reward-art";
import { generateRewardClaimArt } from "@/lib/server/reward-claim-art";
import { DEFAULT_SQUAD_POWER_MAX, normalizeSquadPowerMax } from "@/lib/squad-config";
import {
  AwardSquadPowerInput,
  ClaimRewardInput,
  ClaimRewardResult,
  CompletionResult,
  CreateMissionBackfillInput,
  CreateMissionBackfillResult,
  CreateMissionInput,
  CreateProfileInput,
  CreateRewardInput,
  DeleteMissionBackfillResult,
  Mission,
  MissionBackfillEntry,
  MissionHistoryEntry,
  MissionCompletionRequest,
  MissionUncompletionRequest,
  MissionWithState,
  MarkNotificationsReadResult,
  NotificationEvent,
  NotificationEventType,
  ParentDashboardData,
  Profile,
  Reward,
  RewardClaimEntry,
  RewardClaimRow,
  ReturnRewardInput,
  ReturnRewardResult,
  SquadGoal,
  SquadState,
  UncompletionResult,
  UpdateMissionInput,
  UpdateProfileInput,
  UpdateRewardInput,
} from "@/lib/types/domain";
import { hashPin, verifyPin } from "@/lib/server/pin";

const DATA_DIR = join(process.cwd(), "data");
const STORE_FILE = join(DATA_DIR, "local-store.json");

interface MissionHistoryRow {
  id: string;
  missionId: string;
  profileId: string;
  completedAt: string;
  completedOnLocalDate: string;
  clientRequestId: string;
  pointsAwarded: number;
}

interface LocalState {
  profiles: Profile[];
  missions: Mission[];
  missionHistory: MissionHistoryRow[];
  rewards: Reward[];
  rewardClaims: RewardClaimRow[];
  notifications: NotificationEvent[];
  squad: SquadState;
  parentPinHash: string;
}

function defaultProfiles(): Profile[] {
  return [
    {
      id: "captain-alpha",
      heroName: "Captain Comet",
      avatarUrl: "/avatars/captain.svg",
      uiMode: "text",
      heroCardObjectPosition: "center",
      rewardPoints: 0,
      xpPoints: 0,
      powerLevel: 0,
      currentStreak: 0,
      lastStreakDate: null,
    },
    {
      id: "super-tot",
      heroName: "Super Tot",
      avatarUrl: "/avatars/super.svg",
      uiMode: "picture",
      heroCardObjectPosition: "center",
      rewardPoints: 0,
      xpPoints: 0,
      powerLevel: 0,
      currentStreak: 0,
      lastStreakDate: null,
    },
  ];
}

function defaultMissions(): Mission[] {
  return [
    {
      id: "m1",
      profileId: "captain-alpha",
      title: "Operation: Brush Teeth",
      instructions: "Brush top and bottom teeth for two full minutes, then rinse.",
      imageUrl: "/missions/brush.svg",
      powerValue: 10,
      isActive: true,
      recurringDaily: true,
      sortOrder: 1,
      deletedAt: null,
    },
    {
      id: "m2",
      profileId: "captain-alpha",
      title: "Defeat Lego Monsters",
      instructions: "Pick up all Lego pieces and place them in the Lego bin.",
      imageUrl: "/missions/lego.svg",
      powerValue: 12,
      isActive: true,
      recurringDaily: true,
      sortOrder: 2,
      deletedAt: null,
    },
    {
      id: "m3",
      profileId: "captain-alpha",
      title: "Shield-Up Bedtime",
      instructions: "Put pajamas on, get in bed, and stay calm for bedtime.",
      imageUrl: "/missions/bed.svg",
      powerValue: 8,
      isActive: true,
      recurringDaily: true,
      sortOrder: 3,
      deletedAt: null,
    },
    {
      id: "m4",
      profileId: "super-tot",
      title: "Toy Bin Attack",
      instructions: "Put toys in the toy bin until the floor is clear.",
      imageUrl: "/missions/toys.svg",
      powerValue: 8,
      isActive: true,
      recurringDaily: true,
      sortOrder: 1,
      deletedAt: null,
    },
    {
      id: "m5",
      profileId: "super-tot",
      title: "Bed Rescue",
      instructions: "Climb into bed and pull blanket up for bedtime.",
      imageUrl: "/missions/bed.svg",
      powerValue: 8,
      isActive: true,
      recurringDaily: true,
      sortOrder: 2,
      deletedAt: null,
    },
    {
      id: "m6",
      profileId: "super-tot",
      title: "Toothpaste Zap",
      instructions: "Use toothbrush with toothpaste and brush with help.",
      imageUrl: "/missions/brush.svg",
      powerValue: 10,
      isActive: true,
      recurringDaily: true,
      sortOrder: 3,
      deletedAt: null,
    },
  ];
}

function defaultRewards(): Reward[] {
  return STARTER_REWARD_PRESETS.map((reward, index) => ({
    id: `r${index + 1}`,
    title: reward.title,
    description: reward.description,
    pointCost: reward.pointCost,
    targetDaysToEarn: reward.targetDaysToEarn ?? null,
    minDaysBetweenClaims: reward.minDaysBetweenClaims ?? null,
    isActive: reward.isActive ?? true,
    sortOrder: reward.sortOrder ?? index + 1,
  }));
}

function initialState(): LocalState {
  return {
    profiles: defaultProfiles(),
    missions: defaultMissions(),
    missionHistory: [],
    rewards: defaultRewards(),
    rewardClaims: [],
    notifications: [],
    squad: {
      squadPowerCurrent: 0,
      squadPowerMax: DEFAULT_SQUAD_POWER_MAX,
      cycleDate: toLocalDateString(new Date(), env.appTimeZone),
      squadGoal: null,
      goalCompletionCount: 0,
    },
    parentPinHash: env.parentPinHash || hashPin(env.parentPinPlain),
  };
}

function normalizeLoadedState(state: LocalState): LocalState {
  return {
    ...state,
    profiles: (state.profiles ?? []).map((profile) => ({
      ...profile,
      rewardPoints: profile.rewardPoints ?? profile.powerLevel ?? 0,
      xpPoints: profile.xpPoints ?? profile.powerLevel ?? 0,
      powerLevel: profile.xpPoints ?? profile.powerLevel ?? 0,
      heroCardObjectPosition: toHeroCardObjectPosition(profile.heroCardObjectPosition),
      currentStreak: profile.currentStreak ?? 0,
      lastStreakDate: profile.lastStreakDate ?? null,
    })),
    rewards:
      state.rewards && state.rewards.length > 0
        ? state.rewards.map((reward) => ({
            ...reward,
            targetDaysToEarn:
              typeof reward.targetDaysToEarn === "number"
                ? reward.targetDaysToEarn
                : null,
            minDaysBetweenClaims:
              typeof reward.minDaysBetweenClaims === "number"
                ? reward.minDaysBetweenClaims
                : null,
          }))
        : defaultRewards(),
    rewardClaims: state.rewardClaims ?? [],
    notifications: state.notifications ?? [],
    squad: {
      ...state.squad,
      squadPowerMax: normalizeSquadPowerMax(state.squad?.squadPowerMax),
      squadGoal: state.squad?.squadGoal ?? null,
      goalCompletionCount: state.squad?.goalCompletionCount ?? 0,
    },
  };
}

class LocalStore {
  private state: LocalState;

  constructor(options?: { skipDiskLoad?: boolean }) {
    this.state = options?.skipDiskLoad ? initialState() : this.loadFromDisk();
  }

  private loadFromDisk(): LocalState {
    try {
      if (existsSync(STORE_FILE)) {
        const raw = readFileSync(STORE_FILE, "utf8");
        return normalizeLoadedState(JSON.parse(raw) as LocalState);
      }
    } catch {
      // ignore read errors — fall through to defaults
    }
    return initialState();
  }

  private saveToDisk(): void {
    try {
      mkdirSync(DATA_DIR, { recursive: true });
      writeFileSync(STORE_FILE, JSON.stringify(this.state, null, 2), "utf8");
    } catch {
      // ignore write failures (e.g. read-only filesystem in serverless)
    }
  }

  private getCompletedSetForCycle(cycleDate: string): Set<string> {
    const completedMissionIds = this.state.missionHistory
      .filter((row) => row.completedOnLocalDate === cycleDate)
      .map((row) => row.missionId);
    return new Set(completedMissionIds);
  }

  private pushNotification(
    profileId: string,
    eventType: NotificationEventType,
    title: string,
    message: string,
  ): void {
    this.state.notifications.push({
      id: randomUUID(),
      profileId,
      eventType,
      title,
      message,
      createdAt: new Date().toISOString(),
      readAt: null,
    });
  }

  private recomputeProfileStreak(profileId: string): void {
    const profile = this.state.profiles.find((item) => item.id === profileId);
    if (!profile) {
      return;
    }

    const streak = recomputeStreakStateFromCompletionDates(
      this.state.missionHistory
        .filter((item) => item.profileId === profileId)
        .map((item) => item.completedOnLocalDate),
    );
    profile.currentStreak = streak.currentStreak;
    profile.lastStreakDate = streak.lastStreakDate;
  }

  getProfiles(): Profile[] {
    return [...this.state.profiles];
  }

  getSquadState(): SquadState {
    return {
      ...this.state.squad,
      squadGoal: this.state.squad.squadGoal
        ? { ...this.state.squad.squadGoal }
        : null,
    };
  }

  getMissions(profileId?: string): MissionWithState[] {
    const completedSet = this.getCompletedSetForCycle(this.state.squad.cycleDate);

    return this.state.missions
      .filter((mission) => mission.deletedAt === null)
      .filter((mission) => (profileId ? mission.isActive : true))
      .filter((mission) => (profileId ? mission.profileId === profileId : true))
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((mission) => ({
        ...mission,
        completedToday: mission.recurringDaily
          ? completedSet.has(mission.id)
          : this.state.missionHistory.some((item) => item.missionId === mission.id),
      }));
  }

  getTrashedMissions(): MissionWithState[] {
    return this.state.missions
      .filter((mission) => mission.deletedAt !== null)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((mission) => ({
        ...mission,
        completedToday: false,
      }));
  }

  completeMission(input: MissionCompletionRequest): CompletionResult {
    const existingByRequestId = this.state.missionHistory.find(
      (item) => item.clientRequestId === input.clientRequestId,
    );

    if (existingByRequestId) {
      const profile = this.state.profiles.find((p) => p.id === input.profileId);
      return {
        awarded: false,
        alreadyCompleted: true,
        profileRewardPoints: profile?.rewardPoints ?? 0,
        profileXpPoints: profile?.xpPoints ?? profile?.powerLevel ?? 0,
        profilePowerLevel: profile?.powerLevel ?? 0,
        squadPowerCurrent: this.state.squad.squadPowerCurrent,
        squadPowerMax: this.state.squad.squadPowerMax,
      };
    }

    const mission = this.state.missions.find((item) => item.id === input.missionId);
    if (
      !mission ||
      mission.profileId !== input.profileId ||
      !mission.isActive ||
      mission.deletedAt !== null
    ) {
      throw new Error("Mission not found or inactive");
    }

    const alreadyCompleted = mission.recurringDaily
      ? this.state.missionHistory.some(
          (item) =>
            item.missionId === mission.id &&
            item.completedOnLocalDate === this.state.squad.cycleDate,
        )
      : this.state.missionHistory.some((item) => item.missionId === mission.id);

    if (alreadyCompleted) {
      const profile = this.state.profiles.find((p) => p.id === input.profileId);
      return {
        awarded: false,
        alreadyCompleted: true,
        profileRewardPoints: profile?.rewardPoints ?? 0,
        profileXpPoints: profile?.xpPoints ?? profile?.powerLevel ?? 0,
        profilePowerLevel: profile?.powerLevel ?? 0,
        squadPowerCurrent: this.state.squad.squadPowerCurrent,
        squadPowerMax: this.state.squad.squadPowerMax,
      };
    }

    const hadCompletionTodayBefore = this.state.missionHistory.some(
      (item) =>
        item.profileId === input.profileId &&
        item.completedOnLocalDate === this.state.squad.cycleDate,
    );

    this.state.missionHistory.push({
      id: randomUUID(),
      missionId: mission.id,
      profileId: input.profileId,
      completedAt: input.clientCompletedAt,
      completedOnLocalDate: this.state.squad.cycleDate,
      clientRequestId: input.clientRequestId,
      pointsAwarded: mission.powerValue,
    });

    const profile = this.state.profiles.find((item) => item.id === input.profileId);
    if (!profile) {
      throw new Error("Profile not found");
    }

    if (!hadCompletionTodayBefore) {
      const nextStreak = computeNextStreakState({
        currentStreak: profile.currentStreak,
        lastStreakDate: profile.lastStreakDate,
        cycleDate: this.state.squad.cycleDate,
      });
      profile.currentStreak = nextStreak.currentStreak;
      profile.lastStreakDate = nextStreak.lastStreakDate;
    }

    profile.rewardPoints += mission.powerValue;
    profile.xpPoints += mission.powerValue;
    profile.powerLevel = profile.xpPoints;
    this.state.squad.squadPowerCurrent = clamp(
      this.state.squad.squadPowerCurrent + mission.powerValue,
      0,
      this.state.squad.squadPowerMax,
    );
    this.pushNotification(
      input.profileId,
      "mission_complete",
      "Mission Complete",
      `${profile.heroName} finished "${mission.title}" (+${mission.powerValue} power).`,
    );

    this.saveToDisk();

    return {
      awarded: true,
      alreadyCompleted: false,
      profileRewardPoints: profile.rewardPoints,
      profileXpPoints: profile.xpPoints,
      profilePowerLevel: profile.powerLevel,
      squadPowerCurrent: this.state.squad.squadPowerCurrent,
      squadPowerMax: this.state.squad.squadPowerMax,
    };
  }

  uncompleteMission(input: MissionUncompletionRequest): UncompletionResult {
    const mission = this.state.missions.find((item) => item.id === input.missionId);
    if (
      !mission ||
      mission.profileId !== input.profileId ||
      !mission.isActive ||
      mission.deletedAt !== null
    ) {
      throw new Error("Mission not found or inactive");
    }

    const profile = this.state.profiles.find((item) => item.id === input.profileId);
    if (!profile) {
      throw new Error("Profile not found");
    }

    const historyMatches = this.state.missionHistory
      .filter(
        (item) =>
          item.missionId === input.missionId && item.profileId === input.profileId,
      )
      .filter((item) =>
        mission.recurringDaily
          ? item.completedOnLocalDate === this.state.squad.cycleDate
          : true,
      )
      .sort((a, b) => b.completedAt.localeCompare(a.completedAt));

    const target = historyMatches[0];

    if (!target) {
      return {
        undone: false,
        wasCompleted: false,
        insufficientUnspentPoints: false,
        profileRewardPoints: profile.rewardPoints,
        profileXpPoints: profile.xpPoints,
        profilePowerLevel: profile.powerLevel,
        squadPowerCurrent: this.state.squad.squadPowerCurrent,
        squadPowerMax: this.state.squad.squadPowerMax,
      };
    }

    const undoPolicy = evaluateUndoEligibility({
      force: input.force,
      profileRewardPoints: profile.rewardPoints,
      pointsAwarded: target.pointsAwarded,
    });

    if (!undoPolicy.allowed) {
      return {
        undone: false,
        wasCompleted: true,
        insufficientUnspentPoints: undoPolicy.insufficientUnspentPoints,
        pointsRequiredToUndo: undoPolicy.pointsRequiredToUndo,
        profileRewardPoints: profile.rewardPoints,
        profileXpPoints: profile.xpPoints,
        profilePowerLevel: profile.powerLevel,
        squadPowerCurrent: this.state.squad.squadPowerCurrent,
        squadPowerMax: this.state.squad.squadPowerMax,
      };
    }

    this.state.missionHistory = this.state.missionHistory.filter(
      (item) => item.id !== target.id,
    );

    profile.rewardPoints = Math.max(0, profile.rewardPoints - target.pointsAwarded);
    profile.xpPoints = Math.max(0, profile.xpPoints - target.pointsAwarded);
    profile.powerLevel = profile.xpPoints;
    this.state.squad.squadPowerCurrent = clamp(
      this.state.squad.squadPowerCurrent - target.pointsAwarded,
      0,
      this.state.squad.squadPowerMax,
    );

    this.saveToDisk();

    return {
      undone: true,
      wasCompleted: true,
      insufficientUnspentPoints: false,
      profileRewardPoints: profile.rewardPoints,
      profileXpPoints: profile.xpPoints,
      profilePowerLevel: profile.powerLevel,
      squadPowerCurrent: this.state.squad.squadPowerCurrent,
      squadPowerMax: this.state.squad.squadPowerMax,
    };
  }

  createMission(input: CreateMissionInput): Mission {
    const sortOrder =
      input.sortOrder ??
      this.state.missions.filter(
        (m) => m.profileId === input.profileId && m.deletedAt === null,
      ).length + 1;

    const mission: Mission = {
      id: randomUUID(),
      profileId: input.profileId,
      title: input.title,
      instructions: input.instructions,
      imageUrl: input.imageUrl ?? null,
      powerValue: input.powerValue,
      isActive: input.isActive ?? true,
      recurringDaily: input.recurringDaily ?? true,
      sortOrder,
      deletedAt: null,
    };

    this.state.missions.push(mission);
    this.saveToDisk();
    return mission;
  }

  updateMission(id: string, input: UpdateMissionInput): Mission {
    const mission = this.state.missions.find((item) => item.id === id);
    if (!mission) {
      throw new Error("Mission not found");
    }

    if (input.title !== undefined) mission.title = input.title;
    if (input.instructions !== undefined) mission.instructions = input.instructions;
    if (input.imageUrl !== undefined) mission.imageUrl = input.imageUrl;
    if (input.powerValue !== undefined) mission.powerValue = input.powerValue;
    if (input.isActive !== undefined) mission.isActive = input.isActive;
    if (input.recurringDaily !== undefined) {
      mission.recurringDaily = input.recurringDaily;
    }
    if (input.sortOrder !== undefined) mission.sortOrder = input.sortOrder;

    this.saveToDisk();
    return { ...mission };
  }

  deleteMission(id: string): void {
    const mission = this.state.missions.find((item) => item.id === id);
    if (!mission) {
      throw new Error("Mission not found");
    }

    mission.isActive = false;
    mission.deletedAt = new Date().toISOString();
    this.state.missionHistory = this.state.missionHistory.filter(
      (item) => item.missionId !== id,
    );
    this.saveToDisk();
  }

  restoreMission(id: string): Mission {
    const mission = this.state.missions.find((item) => item.id === id);
    if (!mission) {
      throw new Error("Mission not found");
    }

    mission.deletedAt = null;
    mission.isActive = true;
    this.saveToDisk();
    return { ...mission };
  }

  getRewards(): Reward[] {
    return [...this.state.rewards].sort(compareRewardsByCost);
  }

  createReward(input: CreateRewardInput): Reward {
    const reward: Reward = {
      id: randomUUID(),
      title: input.title,
      description: input.description,
      pointCost: input.pointCost,
      targetDaysToEarn: input.targetDaysToEarn ?? null,
      minDaysBetweenClaims: input.minDaysBetweenClaims ?? null,
      isActive: input.isActive ?? true,
      sortOrder: input.sortOrder ?? this.state.rewards.length + 1,
    };
    this.state.rewards.push(reward);
    this.saveToDisk();
    return reward;
  }

  updateReward(id: string, input: UpdateRewardInput): Reward {
    const reward = this.state.rewards.find((item) => item.id === id);
    if (!reward) {
      throw new Error("Reward not found");
    }

    if (input.title !== undefined) reward.title = input.title;
    if (input.description !== undefined) reward.description = input.description;
    if (input.pointCost !== undefined) reward.pointCost = input.pointCost;
    if (input.targetDaysToEarn !== undefined) {
      reward.targetDaysToEarn = input.targetDaysToEarn;
    }
    if (input.minDaysBetweenClaims !== undefined) {
      reward.minDaysBetweenClaims = input.minDaysBetweenClaims;
    }
    if (input.isActive !== undefined) reward.isActive = input.isActive;
    if (input.sortOrder !== undefined) reward.sortOrder = input.sortOrder;
    this.saveToDisk();
    return { ...reward };
  }

  deleteReward(id: string): void {
    const idx = this.state.rewards.findIndex((item) => item.id === id);
    if (idx === -1) {
      throw new Error("Reward not found");
    }

    this.state.rewards.splice(idx, 1);
    this.saveToDisk();
  }

  async claimReward(input: ClaimRewardInput): Promise<ClaimRewardResult> {
    const reward = this.state.rewards.find((item) => item.id === input.rewardId);
    if (!reward || !reward.isActive) {
      throw new Error("Reward unavailable");
    }

    const profile = this.state.profiles.find((item) => item.id === input.profileId);
    if (!profile) {
      throw new Error("Profile not found");
    }

    const claimTime = input.claimedAt ? new Date(input.claimedAt) : new Date();
    if (Number.isNaN(claimTime.getTime())) {
      throw new Error("Invalid claim timestamp");
    }

    const cooldown = getRewardCooldownStatus({
      reward,
      claims: this.state.rewardClaims.filter((claim) => claim.profileId === input.profileId),
      asOf: claimTime,
      timeZone: env.appTimeZone,
    });
    if (cooldown.cooldownActive) {
      return {
        claimed: false,
        insufficientPoints: false,
        alreadyClaimed: false,
        cooldownActive: true,
        nextClaimDate: cooldown.nextClaimDate,
        cooldownDaysRemaining: cooldown.cooldownDaysRemaining,
        newRewardPoints: profile.rewardPoints,
        newXpPoints: profile.xpPoints,
        newPowerLevel: profile.powerLevel,
        reward,
      };
    }

    if (profile.rewardPoints < reward.pointCost) {
      return {
        claimed: false,
        insufficientPoints: true,
        alreadyClaimed: false,
        cooldownActive: false,
        nextClaimDate: cooldown.nextClaimDate,
        cooldownDaysRemaining: cooldown.cooldownDaysRemaining,
        newRewardPoints: profile.rewardPoints,
        newXpPoints: profile.xpPoints,
        newPowerLevel: profile.powerLevel,
        reward,
      };
    }

    profile.rewardPoints -= reward.pointCost;
    profile.powerLevel = profile.xpPoints;
    const claimedAt = claimTime.toISOString();
    const existingStickerConceptIds = this.state.rewardClaims
      .filter((claim) => claim.profileId === input.profileId)
      .map((claim) => claim.stickerConceptId)
      .filter((value): value is string => typeof value === "string" && value.length > 0);
    const art = await generateRewardClaimArt({
      rewardTitle: reward.title,
      rewardDescription: reward.description,
      heroName: profile.heroName,
      claimedAt,
      existingStickerConceptIds,
    });
    this.state.rewardClaims.push({
      id: randomUUID(),
      profileId: input.profileId,
      rewardId: input.rewardId,
      pointCost: reward.pointCost,
      claimedAt,
      imageUrl: art.imageUrl,
      stickerType: art.stickerType,
      stickerConceptId: art.stickerConceptId,
      stickerPromptSeed: art.stickerPromptSeed,
    });
    this.pushNotification(
      input.profileId,
      "reward_claimed",
      "Reward Claimed",
      `${profile.heroName} claimed "${reward.title}" (-${reward.pointCost} reward points).`,
    );
    this.saveToDisk();

    return {
      claimed: true,
      insufficientPoints: false,
      alreadyClaimed: false,
      cooldownActive: false,
      nextClaimDate: null,
      cooldownDaysRemaining: null,
      newRewardPoints: profile.rewardPoints,
      newXpPoints: profile.xpPoints,
      newPowerLevel: profile.powerLevel,
      reward,
    };
  }

  returnReward(input: ReturnRewardInput): ReturnRewardResult {
    const profile = this.state.profiles.find((item) => item.id === input.profileId);
    if (!profile) {
      throw new Error("Profile not found");
    }

    const claimIndex = this.state.rewardClaims.findIndex(
      (claim) => claim.id === input.rewardClaimId && claim.profileId === input.profileId,
    );

    if (claimIndex === -1) {
      return {
        returned: false,
        restoredPoints: 0,
        newRewardPoints: profile.rewardPoints,
        newXpPoints: profile.xpPoints,
        newPowerLevel: profile.powerLevel,
      };
    }

    const claim = this.state.rewardClaims[claimIndex];
    this.state.rewardClaims.splice(claimIndex, 1);
    profile.rewardPoints += claim.pointCost;
    profile.powerLevel = profile.xpPoints;
    const rewardTitle =
      this.state.rewards.find((item) => item.id === claim.rewardId)?.title ?? "a reward";
    this.pushNotification(
      input.profileId,
      "reward_returned",
      "Reward Returned",
      `${profile.heroName} gave back "${rewardTitle}" (+${claim.pointCost} reward points).`,
    );
    this.saveToDisk();

    return {
      returned: true,
      restoredPoints: claim.pointCost,
      newRewardPoints: profile.rewardPoints,
      newXpPoints: profile.xpPoints,
      newPowerLevel: profile.powerLevel,
    };
  }

  getRewardClaims(profileId: string): RewardClaimEntry[] {
    const rewardById = new Map(this.state.rewards.map((reward) => [reward.id, reward]));
    return this.state.rewardClaims
      .filter((claim) => claim.profileId === profileId)
      .sort((a, b) => b.claimedAt.localeCompare(a.claimedAt))
      .map((claim) => {
        const reward = rewardById.get(claim.rewardId);
        const imageUrl =
          claim.imageUrl ??
          generateRewardStickerDataUrl({
            rewardTitle: reward?.title ?? "Reward",
            heroName:
              this.state.profiles.find((profile) => profile.id === claim.profileId)?.heroName ??
              "Hero",
            claimedAt: claim.claimedAt,
            stickerType: claim.stickerType,
            stickerConceptId: claim.stickerConceptId,
            stickerPromptSeed: claim.stickerPromptSeed,
          });
        return {
          id: claim.id,
          rewardId: claim.rewardId,
          title: reward?.title ?? "Mystery Reward",
          description: reward?.description ?? "Reward claimed",
          pointCost: claim.pointCost,
          claimedAt: claim.claimedAt,
          imageUrl,
          stickerType: claim.stickerType,
          stickerConceptId: claim.stickerConceptId,
          stickerPromptSeed: claim.stickerPromptSeed,
        };
      });
  }

  awardSquadPower(input: AwardSquadPowerInput): SquadState {
    this.state.squad.squadPowerCurrent = clamp(
      this.state.squad.squadPowerCurrent + input.delta,
      0,
      this.state.squad.squadPowerMax,
    );
    this.saveToDisk();
    return this.getSquadState();
  }

  setSquadGoal(goal: SquadGoal | null): SquadState {
    this.state.squad.squadGoal = goal ? { ...goal } : null;
    this.saveToDisk();
    return this.getSquadState();
  }

  redeemSquadGoal(): SquadState {
    this.state.squad.squadPowerCurrent = 0;
    this.state.squad.goalCompletionCount = (this.state.squad.goalCompletionCount ?? 0) + 1;
    this.saveToDisk();
    return this.getSquadState();
  }

  verifyParentPin(pin: string): boolean {
    return verifyPin(pin, this.state.parentPinHash);
  }

  changeParentPin(newPin: string): void {
    this.state.parentPinHash = hashPin(newPin);
    this.saveToDisk();
  }

  getParentDashboard(): ParentDashboardData {
    return {
      profiles: this.getProfiles(),
      missions: this.getMissions(),
      trashedMissions: this.getTrashedMissions(),
      squad: this.getSquadState(),
      rewards: this.getRewards(),
    };
  }

  resetDaily(cycleDate = toLocalDateString(new Date(), env.appTimeZone)): SquadState {
    this.state.squad.cycleDate = cycleDate;
    this.saveToDisk();
    return this.getSquadState();
  }

  getMissionHistory(profileId: string, days: number): MissionHistoryEntry[] {
    const start = new Date(`${this.state.squad.cycleDate}T00:00:00.000Z`);
    start.setUTCDate(start.getUTCDate() - Math.max(0, days - 1));
    const minDate = start.toISOString().slice(0, 10);

    const missionTitleById = new Map(this.state.missions.map((mission) => [mission.id, mission.title]));
    const grouped = new Map<string, Array<{ title: string; powerAwarded: number }>>();

    for (const row of this.state.missionHistory) {
      if (row.profileId !== profileId || row.completedOnLocalDate < minDate) {
        continue;
      }

      const group = grouped.get(row.completedOnLocalDate) ?? [];
      group.push({
        title: missionTitleById.get(row.missionId) ?? "Mission",
        powerAwarded: row.pointsAwarded,
      });
      grouped.set(row.completedOnLocalDate, group);
    }

    return Array.from(grouped.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([date, missions]) => ({ date, missions }));
  }

  createMissionBackfill(input: CreateMissionBackfillInput): CreateMissionBackfillResult {
    if (!isValidLocalDateString(input.localDate)) {
      throw new Error("Invalid localDate");
    }
    if (input.localDate >= this.state.squad.cycleDate) {
      throw new Error("Backfill date must be before today");
    }

    const mission = this.state.missions.find(
      (item) =>
        item.id === input.missionId &&
        item.profileId === input.profileId &&
        item.isActive &&
        item.deletedAt === null,
    );
    if (!mission) {
      throw new Error("Mission not found or inactive");
    }

    const duplicate = this.state.missionHistory.find(
      (row) =>
        row.missionId === input.missionId && row.completedOnLocalDate === input.localDate,
    );
    if (duplicate) {
      throw new Error("Backfill already exists for this mission and date");
    }

    const completedAt = new Date().toISOString();
    const row: MissionHistoryRow = {
      id: randomUUID(),
      missionId: mission.id,
      profileId: input.profileId,
      completedAt,
      completedOnLocalDate: input.localDate,
      clientRequestId: buildMissionBackfillClientRequestId({
        profileId: input.profileId,
        missionId: input.missionId,
        localDate: input.localDate,
      }),
      pointsAwarded: mission.powerValue,
    };
    this.state.missionHistory.push(row);

    const profile = this.state.profiles.find((item) => item.id === input.profileId);
    if (!profile) {
      throw new Error("Profile not found");
    }

    profile.rewardPoints += mission.powerValue;
    profile.xpPoints += mission.powerValue;
    profile.powerLevel = profile.xpPoints;
    this.state.squad.squadPowerCurrent = clamp(
      this.state.squad.squadPowerCurrent + mission.powerValue,
      0,
      this.state.squad.squadPowerMax,
    );
    this.recomputeProfileStreak(input.profileId);
    this.saveToDisk();

    return {
      entry: {
        id: row.id,
        profileId: row.profileId,
        missionId: row.missionId,
        missionTitle: mission.title,
        localDate: row.completedOnLocalDate,
        pointsAwarded: row.pointsAwarded,
        createdAt: row.completedAt,
      },
      profileRewardPoints: profile.rewardPoints,
      profileXpPoints: profile.xpPoints,
      profilePowerLevel: profile.powerLevel,
      squadPowerCurrent: this.state.squad.squadPowerCurrent,
      squadPowerMax: this.state.squad.squadPowerMax,
    };
  }

  getMissionBackfills(profileId: string): MissionBackfillEntry[] {
    const missionTitleById = new Map(this.state.missions.map((mission) => [mission.id, mission.title]));
    return this.state.missionHistory
      .filter(
        (row) =>
          row.profileId === profileId &&
          isMissionBackfillClientRequestId(row.clientRequestId),
      )
      .sort((a, b) => {
        if (a.completedOnLocalDate !== b.completedOnLocalDate) {
          return a.completedOnLocalDate < b.completedOnLocalDate ? 1 : -1;
        }
        return b.completedAt.localeCompare(a.completedAt);
      })
      .map((row) => ({
        id: row.id,
        profileId: row.profileId,
        missionId: row.missionId,
        missionTitle: missionTitleById.get(row.missionId) ?? "Mission",
        localDate: row.completedOnLocalDate,
        pointsAwarded: row.pointsAwarded,
        createdAt: row.completedAt,
      }));
  }

  deleteMissionBackfill(id: string): DeleteMissionBackfillResult {
    const row = this.state.missionHistory.find((item) => item.id === id);
    if (!row) {
      throw new Error("Backfill entry not found");
    }
    if (!isMissionBackfillClientRequestId(row.clientRequestId)) {
      throw new Error("Only parent backfills can be removed");
    }

    const profile = this.state.profiles.find((item) => item.id === row.profileId);
    if (!profile) {
      throw new Error("Profile not found");
    }

    this.state.missionHistory = this.state.missionHistory.filter((item) => item.id !== id);
    profile.rewardPoints = Math.max(0, profile.rewardPoints - row.pointsAwarded);
    profile.xpPoints = Math.max(0, profile.xpPoints - row.pointsAwarded);
    profile.powerLevel = profile.xpPoints;
    this.state.squad.squadPowerCurrent = clamp(
      this.state.squad.squadPowerCurrent - row.pointsAwarded,
      0,
      this.state.squad.squadPowerMax,
    );
    this.recomputeProfileStreak(profile.id);
    this.saveToDisk();

    return {
      removed: true,
      profileRewardPoints: profile.rewardPoints,
      profileXpPoints: profile.xpPoints,
      profilePowerLevel: profile.powerLevel,
      squadPowerCurrent: this.state.squad.squadPowerCurrent,
      squadPowerMax: this.state.squad.squadPowerMax,
    };
  }

  getNotifications(limit = 100): NotificationEvent[] {
    return [...this.state.notifications]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, Math.max(1, Math.min(500, limit)));
  }

  markNotificationsRead(): MarkNotificationsReadResult {
    const now = new Date().toISOString();
    let markedCount = 0;

    for (const item of this.state.notifications) {
      if (item.readAt) continue;
      item.readAt = now;
      markedCount += 1;
    }

    if (markedCount > 0) {
      this.saveToDisk();
    }

    return { markedCount };
  }

  getUnreadNotificationCount(): number {
    return this.state.notifications.filter((item) => item.readAt === null).length;
  }

  createProfile(input: CreateProfileInput): Profile {
    const profile: Profile = {
      id: randomUUID(),
      heroName: input.heroName,
      avatarUrl: input.avatarUrl,
      uiMode: input.uiMode,
      heroCardObjectPosition: toHeroCardObjectPosition(input.heroCardObjectPosition),
      rewardPoints: 0,
      xpPoints: 0,
      powerLevel: 0,
      currentStreak: 0,
      lastStreakDate: null,
    };
    this.state.profiles.push(profile);
    this.saveToDisk();
    return profile;
  }

  updateProfile(id: string, input: UpdateProfileInput): Profile {
    const profile = this.state.profiles.find((p) => p.id === id);
    if (!profile) throw new Error("Profile not found");

    if (input.heroName !== undefined) profile.heroName = input.heroName;
    if (input.avatarUrl !== undefined) profile.avatarUrl = input.avatarUrl;
    if (input.uiMode !== undefined) profile.uiMode = input.uiMode;
    if (input.heroCardObjectPosition !== undefined) {
      profile.heroCardObjectPosition = toHeroCardObjectPosition(input.heroCardObjectPosition);
    }

    this.saveToDisk();
    return { ...profile };
  }

  deleteProfile(id: string): void {
    const profileIndex = this.state.profiles.findIndex((p) => p.id === id);
    if (profileIndex === -1) throw new Error("Profile not found");

    this.state.missions = this.state.missions.filter((mission) => mission.profileId !== id);
    this.state.missionHistory = this.state.missionHistory.filter(
      (row) => row.profileId !== id,
    );
    this.state.rewardClaims = this.state.rewardClaims.filter(
      (row) => row.profileId !== id,
    );

    this.state.profiles.splice(profileIndex, 1);
    this.saveToDisk();
  }
}

declare global {
  var __heroHabitsLocalStore__: LocalStore | undefined;
}

export function getLocalStore(): LocalStore {
  if (!global.__heroHabitsLocalStore__) {
    global.__heroHabitsLocalStore__ = new LocalStore();
  }

  return global.__heroHabitsLocalStore__;
}

export function resetLocalStoreForTests(): void {
  global.__heroHabitsLocalStore__ = new LocalStore({ skipDiskLoad: true });
}

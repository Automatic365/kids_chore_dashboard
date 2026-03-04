import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

import { clamp, toLocalDateString } from "@/lib/date";
import { env } from "@/lib/env";
import { generateRewardStickerDataUrl } from "@/lib/reward-art";
import {
  AwardSquadPowerInput,
  ClaimRewardInput,
  ClaimRewardResult,
  CompletionResult,
  CreateMissionInput,
  CreateProfileInput,
  CreateRewardInput,
  Mission,
  MissionHistoryEntry,
  MissionCompletionRequest,
  MissionUncompletionRequest,
  MissionWithState,
  ParentDashboardData,
  Profile,
  Reward,
  RewardClaimEntry,
  RewardClaimRow,
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
      powerLevel: 0,
      currentStreak: 0,
      lastStreakDate: null,
    },
    {
      id: "super-tot",
      heroName: "Super Tot",
      avatarUrl: "/avatars/super.svg",
      uiMode: "picture",
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
  return [
    {
      id: "r1",
      title: "Hero Sticker",
      description: "Pick one sticker from Mission Command.",
      pointCost: 25,
      isActive: true,
      sortOrder: 1,
    },
    {
      id: "r2",
      title: "Comic Break",
      description: "15 minutes of comic or story time.",
      pointCost: 40,
      isActive: true,
      sortOrder: 2,
    },
  ];
}

function initialState(): LocalState {
  return {
    profiles: defaultProfiles(),
    missions: defaultMissions(),
    missionHistory: [],
    rewards: defaultRewards(),
    rewardClaims: [],
    squad: {
      squadPowerCurrent: 0,
      squadPowerMax: 100,
      cycleDate: toLocalDateString(new Date(), env.appTimeZone),
      squadGoal: null,
    },
    parentPinHash: env.parentPinHash || hashPin(env.parentPinPlain),
  };
}

function normalizeLoadedState(state: LocalState): LocalState {
  return {
    ...state,
    profiles: (state.profiles ?? []).map((profile) => ({
      ...profile,
      currentStreak: profile.currentStreak ?? 0,
      lastStreakDate: profile.lastStreakDate ?? null,
    })),
    rewards:
      state.rewards && state.rewards.length > 0
        ? state.rewards
        : defaultRewards(),
    rewardClaims: state.rewardClaims ?? [],
    squad: {
      ...state.squad,
      squadGoal: state.squad?.squadGoal ?? null,
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

  private getPreviousDate(dateString: string): string {
    const date = new Date(`${dateString}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() - 1);
    return date.toISOString().slice(0, 10);
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
      return {
        awarded: false,
        alreadyCompleted: true,
        profilePowerLevel:
          this.state.profiles.find((p) => p.id === input.profileId)?.powerLevel ?? 0,
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
      return {
        awarded: false,
        alreadyCompleted: true,
        profilePowerLevel:
          this.state.profiles.find((p) => p.id === input.profileId)?.powerLevel ?? 0,
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
      const yesterday = this.getPreviousDate(this.state.squad.cycleDate);
      if (profile.lastStreakDate === yesterday) {
        profile.currentStreak += 1;
      } else if (profile.lastStreakDate !== this.state.squad.cycleDate) {
        profile.currentStreak = 1;
      }
      profile.lastStreakDate = this.state.squad.cycleDate;
    }

    profile.powerLevel += mission.powerValue;
    this.state.squad.squadPowerCurrent = clamp(
      this.state.squad.squadPowerCurrent + mission.powerValue,
      0,
      this.state.squad.squadPowerMax,
    );

    this.saveToDisk();

    return {
      awarded: true,
      alreadyCompleted: false,
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
        profilePowerLevel: profile.powerLevel,
        squadPowerCurrent: this.state.squad.squadPowerCurrent,
        squadPowerMax: this.state.squad.squadPowerMax,
      };
    }

    this.state.missionHistory = this.state.missionHistory.filter(
      (item) => item.id !== target.id,
    );

    profile.powerLevel = Math.max(0, profile.powerLevel - target.pointsAwarded);
    this.state.squad.squadPowerCurrent = clamp(
      this.state.squad.squadPowerCurrent - target.pointsAwarded,
      0,
      this.state.squad.squadPowerMax,
    );

    this.saveToDisk();

    return {
      undone: true,
      wasCompleted: true,
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
    return [...this.state.rewards].sort((a, b) => a.sortOrder - b.sortOrder);
  }

  createReward(input: CreateRewardInput): Reward {
    const reward: Reward = {
      id: randomUUID(),
      title: input.title,
      description: input.description,
      pointCost: input.pointCost,
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

  claimReward(input: ClaimRewardInput): ClaimRewardResult {
    const reward = this.state.rewards.find((item) => item.id === input.rewardId);
    if (!reward || !reward.isActive) {
      throw new Error("Reward unavailable");
    }

    const profile = this.state.profiles.find((item) => item.id === input.profileId);
    if (!profile) {
      throw new Error("Profile not found");
    }

    if (profile.powerLevel < reward.pointCost) {
      return {
        claimed: false,
        insufficientPoints: true,
        alreadyClaimed: false,
        newPowerLevel: profile.powerLevel,
        reward,
      };
    }

    const existingClaim = this.state.rewardClaims.find(
      (claim) => claim.profileId === input.profileId && claim.rewardId === input.rewardId,
    );
    if (existingClaim) {
      return {
        claimed: false,
        insufficientPoints: false,
        alreadyClaimed: true,
        newPowerLevel: profile.powerLevel,
        reward,
      };
    }

    profile.powerLevel -= reward.pointCost;
    const claimedAt = new Date().toISOString();
    this.state.rewardClaims.push({
      id: randomUUID(),
      profileId: input.profileId,
      rewardId: input.rewardId,
      pointCost: reward.pointCost,
      claimedAt,
      imageUrl: generateRewardStickerDataUrl({
        rewardTitle: reward.title,
        heroName: profile.heroName,
        claimedAt,
      }),
    });
    this.saveToDisk();

    return {
      claimed: true,
      insufficientPoints: false,
      alreadyClaimed: false,
      newPowerLevel: profile.powerLevel,
      reward,
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
          });
        return {
          id: claim.id,
          rewardId: claim.rewardId,
          title: reward?.title ?? "Mystery Reward",
          description: reward?.description ?? "Reward claimed",
          pointCost: claim.pointCost,
          claimedAt: claim.claimedAt,
          imageUrl,
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

  createProfile(input: CreateProfileInput): Profile {
    const profile: Profile = {
      id: randomUUID(),
      heroName: input.heroName,
      avatarUrl: input.avatarUrl,
      uiMode: input.uiMode,
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

import { randomUUID } from "node:crypto";

import { clamp, toLocalDateString } from "@/lib/date";
import { env } from "@/lib/env";
import {
  AwardSquadPowerInput,
  CompletionResult,
  CreateMissionInput,
  Mission,
  MissionCompletionRequest,
  MissionUncompletionRequest,
  MissionWithState,
  ParentDashboardData,
  Profile,
  SquadState,
  UncompletionResult,
  UpdateMissionInput,
} from "@/lib/types/domain";
import { hashPin, verifyPin } from "@/lib/server/pin";

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
    },
    {
      id: "super-tot",
      heroName: "Super Tot",
      avatarUrl: "/avatars/super.svg",
      uiMode: "picture",
      powerLevel: 0,
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

function initialState(): LocalState {
  return {
    profiles: defaultProfiles(),
    missions: defaultMissions(),
    missionHistory: [],
    squad: {
      squadPowerCurrent: 0,
      squadPowerMax: 100,
      cycleDate: toLocalDateString(new Date(), env.appTimeZone),
    },
    parentPinHash: env.parentPinHash || hashPin(env.parentPinPlain),
  };
}

class LocalStore {
  private state: LocalState = initialState();

  private getCompletedSetForCycle(cycleDate: string): Set<string> {
    const completedMissionIds = this.state.missionHistory
      .filter((row) => row.completedOnLocalDate === cycleDate)
      .map((row) => row.missionId);
    return new Set(completedMissionIds);
  }

  getProfiles(): Profile[] {
    return [...this.state.profiles];
  }

  getSquadState(): SquadState {
    return { ...this.state.squad };
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

    profile.powerLevel += mission.powerValue;
    this.state.squad.squadPowerCurrent = clamp(
      this.state.squad.squadPowerCurrent + mission.powerValue,
      0,
      this.state.squad.squadPowerMax,
    );

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
  }

  restoreMission(id: string): Mission {
    const mission = this.state.missions.find((item) => item.id === id);
    if (!mission) {
      throw new Error("Mission not found");
    }

    mission.deletedAt = null;
    mission.isActive = true;
    return { ...mission };
  }

  awardSquadPower(input: AwardSquadPowerInput): SquadState {
    this.state.squad.squadPowerCurrent = clamp(
      this.state.squad.squadPowerCurrent + input.delta,
      0,
      this.state.squad.squadPowerMax,
    );
    return this.getSquadState();
  }

  verifyParentPin(pin: string): boolean {
    return verifyPin(pin, this.state.parentPinHash);
  }

  getParentDashboard(): ParentDashboardData {
    return {
      profiles: this.getProfiles(),
      missions: this.getMissions(),
      trashedMissions: this.getTrashedMissions(),
      squad: this.getSquadState(),
    };
  }

  resetDaily(cycleDate = toLocalDateString(new Date(), env.appTimeZone)): SquadState {
    this.state.squad.cycleDate = cycleDate;
    return this.getSquadState();
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
  global.__heroHabitsLocalStore__ = new LocalStore();
}

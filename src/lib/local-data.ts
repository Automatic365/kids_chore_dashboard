"use client";

import { openDB } from "idb";

import { clamp, toLocalDateString } from "@/lib/date";
import { computeNextStreakState, evaluateUndoEligibility } from "@/lib/game-rules";
import { publicEnv } from "@/lib/public-env";
import { generateRewardStickerDataUrl } from "@/lib/reward-art";
import { sha256Hex } from "@/lib/security/hash-client";
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
  MarkNotificationsReadResult,
  NotificationEvent,
  ParentDashboardData,
  Profile,
  Reward,
  RewardClaimEntry,
  ReturnRewardInput,
  ReturnRewardResult,
  SquadState,
  SquadGoal,
  UncompletionResult,
  UpdateMissionInput,
  UpdateProfileInput,
  UpdateRewardInput,
} from "@/lib/types/domain";

interface MissionHistoryLocal {
  id: string;
  missionId: string;
  profileId: string;
  completedAt: string;
  completedOnLocalDate: string;
  clientRequestId: string;
  pointsAwarded: number;
}

interface ParentSettingsLocal {
  pinHash: string;
  updatedAt: string;
}

interface RewardClaimLocal {
  id: string;
  profileId: string;
  rewardId: string;
  pointCost: number;
  claimedAt: string;
  imageUrl?: string | null;
}

interface MetaRow {
  key: "squad" | "parent_settings" | "squad_goal";
  value: SquadState | ParentSettingsLocal | SquadGoal | null;
}

type NotificationEventLocal = NotificationEvent;

const DB_NAME = "hero-habits-local";
const DB_VERSION = 3;
const SESSION_KEY = "herohabits-parent-session-exp";
const SESSION_TTL_MS = 1000 * 60 * 60 * 8;

let dbPromise: ReturnType<typeof openDB> | null = null;
let seeded = false;

const defaultProfiles: Profile[] = [
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

const defaultMissions: Mission[] = [
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

const defaultRewards: Reward[] = [
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

type StoredMission = Omit<Mission, "recurringDaily" | "instructions"> & {
  recurringDaily?: boolean;
  instructions?: string;
  deletedAt?: string | null;
};

type StoredProfile = Omit<Profile, "currentStreak" | "lastStreakDate"> & {
  currentStreak?: number;
  lastStreakDate?: string | null;
};

function normalizeMission(mission: StoredMission): Mission {
  return {
    ...mission,
    recurringDaily: mission.recurringDaily ?? true,
    instructions: mission.instructions ?? "Complete this mission.",
    deletedAt: mission.deletedAt ?? null,
  };
}

function normalizeProfile(profile: StoredProfile): Profile {
  return {
    ...profile,
    currentStreak: profile.currentStreak ?? 0,
    lastStreakDate: profile.lastStreakDate ?? null,
  };
}

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const profiles = db.createObjectStore("profiles", { keyPath: "id" });
          profiles.createIndex("by-name", "heroName");

          const missions = db.createObjectStore("missions", { keyPath: "id" });
          missions.createIndex("by-profile", "profileId");

          const history = db.createObjectStore("missionHistory", { keyPath: "id" });
          history.createIndex("by-client-request-id", "clientRequestId", {
            unique: true,
          });
          history.createIndex("by-cycle-date", "completedOnLocalDate");
          history.createIndex("by-mission-cycle", ["missionId", "completedOnLocalDate"]);

          db.createObjectStore("meta", { keyPath: "key" });
        }

        if (oldVersion < 2) {
          if (!db.objectStoreNames.contains("rewards")) {
            db.createObjectStore("rewards", { keyPath: "id" });
          }
          if (!db.objectStoreNames.contains("rewardClaims")) {
            db.createObjectStore("rewardClaims", { keyPath: "id" });
          }
        }

        if (oldVersion < 3) {
          if (!db.objectStoreNames.contains("notifications")) {
            const notifications = db.createObjectStore("notifications", {
              keyPath: "id",
            });
            notifications.createIndex("by-created-at", "createdAt");
            notifications.createIndex("by-read-at", "readAt");
          }
        }
      },
    });
  }

  const db = await dbPromise;
  await ensureSeeded(db);
  return db;
}

async function hashPin(pin: string): Promise<string> {
  return sha256Hex(`${pin}:${publicEnv.parentPinPepper}`);
}

async function ensureSeeded(db: Awaited<ReturnType<typeof openDB>>) {
  if (seeded) {
    return;
  }

  const profileCount = await db.count("profiles");
  if (profileCount > 0) {
    if (db.objectStoreNames.contains("rewards")) {
      const rewardCount = await db.count("rewards");
      if (rewardCount === 0) {
        const tx = db.transaction("rewards", "readwrite");
        for (const reward of defaultRewards) {
          await tx.store.put(reward);
        }
        await tx.done;
      }
    }
    seeded = true;
    return;
  }

  const today = toLocalDateString(new Date(), publicEnv.appTimeZone);
  const pinHash =
    publicEnv.parentPinHash.length > 0
      ? publicEnv.parentPinHash
      : await hashPin(publicEnv.parentPinPlain);

  const tx = db.transaction(
    ["profiles", "missions", "meta", "rewards", "rewardClaims", "notifications"],
    "readwrite",
  );

  for (const profile of defaultProfiles) {
    await tx.objectStore("profiles").put(profile);
  }

  for (const mission of defaultMissions) {
    await tx.objectStore("missions").put(mission);
  }

  for (const reward of defaultRewards) {
    await tx.objectStore("rewards").put(reward);
  }

  const squad: SquadState = {
    squadPowerCurrent: 0,
    squadPowerMax: 100,
    cycleDate: today,
    squadGoal: null,
  };

  const parentSettings: ParentSettingsLocal = {
    pinHash,
    updatedAt: new Date().toISOString(),
  };

  await tx.objectStore("meta").put({ key: "squad", value: squad } satisfies MetaRow);
  await tx
    .objectStore("meta")
    .put({ key: "parent_settings", value: parentSettings } satisfies MetaRow);

  await tx.done;
  seeded = true;
}

async function getMetaValue<T>(db: Awaited<ReturnType<typeof openDB>>, key: MetaRow["key"]) {
  const row = (await db.get("meta", key)) as MetaRow | undefined;
  return (row?.value ?? null) as T | null;
}

async function setMetaValue(
  db: Awaited<ReturnType<typeof openDB>>,
  key: MetaRow["key"],
  value: MetaRow["value"],
) {
  await db.put("meta", { key, value } satisfies MetaRow);
}

async function pushNotificationEvent(
  tx: { objectStore: (name: string) => { put: (value: unknown) => Promise<unknown> } },
  event: Omit<NotificationEvent, "id" | "createdAt" | "readAt">,
) {
  const payload: NotificationEventLocal = {
    id: randomId(),
    profileId: event.profileId,
    eventType: event.eventType,
    title: event.title,
    message: event.message,
    createdAt: new Date().toISOString(),
    readAt: null,
  };
  await tx.objectStore("notifications").put(payload);
}

async function ensureCurrentCycle(db: Awaited<ReturnType<typeof openDB>>): Promise<SquadState> {
  const squadRaw = (await getMetaValue<SquadState>(db, "squad")) ?? {
    squadPowerCurrent: 0,
    squadPowerMax: 100,
    cycleDate: toLocalDateString(new Date(), publicEnv.appTimeZone),
    squadGoal: null,
  };
  const squad: SquadState = {
    ...squadRaw,
    squadGoal: squadRaw.squadGoal ?? null,
  };

  const today = toLocalDateString(new Date(), publicEnv.appTimeZone);
  if (squad.cycleDate !== today) {
    const next = { ...squad, cycleDate: today };
    await setMetaValue(db, "squad", next);
    return next;
  }

  return squad;
}

function isParentAuthenticatedLocally(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const expRaw = window.localStorage.getItem(SESSION_KEY);
  if (!expRaw) return false;

  const exp = Number(expRaw);
  if (!Number.isFinite(exp)) return false;

  if (Date.now() > exp) {
    window.localStorage.removeItem(SESSION_KEY);
    return false;
  }

  return true;
}

function setParentSession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SESSION_KEY, String(Date.now() + SESSION_TTL_MS));
}

export function clearParentSession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SESSION_KEY);
}

export async function localGetProfiles(): Promise<Profile[]> {
  const db = await getDb();
  const profiles = (await db.getAll("profiles")) as StoredProfile[];
  return profiles
    .map(normalizeProfile)
    .sort((a, b) => a.heroName.localeCompare(b.heroName));
}

export async function localGetSquadState(): Promise<SquadState> {
  const db = await getDb();
  return ensureCurrentCycle(db);
}

export async function localGetMissions(profileId?: string): Promise<MissionWithState[]> {
  const db = await getDb();
  const squad = await ensureCurrentCycle(db);

  const allMissions = ((await db.getAll("missions")) as StoredMission[]).map(
    normalizeMission,
  );
  const filtered = allMissions
    .filter((mission) => mission.deletedAt === null)
    .filter((mission) => (profileId ? mission.isActive : true))
    .filter((mission) => (profileId ? mission.profileId === profileId : true))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const todaysHistory = (await db.getAllFromIndex(
    "missionHistory",
    "by-cycle-date",
    squad.cycleDate,
  )) as MissionHistoryLocal[];
  const completedTodaySet = new Set(todaysHistory.map((item) => item.missionId));
  const allHistory = (await db.getAll("missionHistory")) as MissionHistoryLocal[];
  const completedEverSet = new Set(allHistory.map((item) => item.missionId));

  return filtered.map((mission) => ({
    ...mission,
    completedToday: mission.recurringDaily
      ? completedTodaySet.has(mission.id)
      : completedEverSet.has(mission.id),
  }));
}

export async function localGetTrashedMissions(): Promise<MissionWithState[]> {
  const db = await getDb();
  const allMissions = ((await db.getAll("missions")) as StoredMission[]).map(
    normalizeMission,
  );

  return allMissions
    .filter((mission) => mission.deletedAt !== null)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((mission) => ({
      ...mission,
      completedToday: false,
    }));
}

export async function localGetRewards(): Promise<Reward[]> {
  const db = await getDb();
  if (!db.objectStoreNames.contains("rewards")) {
    return [];
  }

  const rewards = (await db.getAll("rewards")) as Reward[];
  return rewards.sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function localGetRewardClaims(
  profileId: string,
): Promise<RewardClaimEntry[]> {
  const db = await getDb();
  if (!db.objectStoreNames.contains("rewardClaims")) {
    return [];
  }

  const [claims, rewards] = await Promise.all([
    db.getAll("rewardClaims") as Promise<RewardClaimLocal[]>,
    db.getAll("rewards") as Promise<Reward[]>,
  ]);
  const rewardById = new Map(rewards.map((reward) => [reward.id, reward]));
  const profiles = (await db.getAll("profiles")) as StoredProfile[];
  const heroByProfileId = new Map(
    profiles.map((profile) => [profile.id, normalizeProfile(profile).heroName]),
  );

  return claims
    .filter((claim) => claim.profileId === profileId)
    .sort((a, b) => b.claimedAt.localeCompare(a.claimedAt))
    .map((claim) => {
      const reward = rewardById.get(claim.rewardId);
      const imageUrl =
        claim.imageUrl ??
        generateRewardStickerDataUrl({
          rewardTitle: reward?.title ?? "Reward",
          heroName: heroByProfileId.get(claim.profileId) ?? "Hero",
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

export async function localCompleteMission(
  input: MissionCompletionRequest,
): Promise<CompletionResult> {
  const db = await getDb();
  const squad = await ensureCurrentCycle(db);
  const tx = db.transaction(
    ["missions", "profiles", "missionHistory", "meta", "notifications"],
    "readwrite",
  );

  const existingRequest = (await tx
    .objectStore("missionHistory")
    .index("by-client-request-id")
    .get(input.clientRequestId)) as MissionHistoryLocal | undefined;

  if (existingRequest) {
    const profileRow = (await tx.objectStore("profiles").get(
      input.profileId,
    )) as StoredProfile;
    const profile = profileRow ? normalizeProfile(profileRow) : undefined;
    await tx.done;

    return {
      awarded: false,
      alreadyCompleted: true,
      profilePowerLevel: profile?.powerLevel ?? 0,
      squadPowerCurrent: squad.squadPowerCurrent,
      squadPowerMax: squad.squadPowerMax,
    };
  }

  const missionRow = (await tx
    .objectStore("missions")
    .get(input.missionId)) as StoredMission | undefined;
  const mission = missionRow ? normalizeMission(missionRow) : undefined;
  if (
    !mission ||
    mission.profileId !== input.profileId ||
    !mission.isActive ||
    mission.deletedAt !== null
  ) {
    await tx.done;
    throw new Error("Mission not found or inactive");
  }

  let completed: MissionHistoryLocal | undefined;
  if (mission.recurringDaily) {
    completed = (await tx
      .objectStore("missionHistory")
      .index("by-mission-cycle")
      .get([input.missionId, squad.cycleDate])) as MissionHistoryLocal | undefined;
  } else {
    const allHistory = (await tx.objectStore("missionHistory").getAll()) as MissionHistoryLocal[];
    completed = allHistory.find((item) => item.missionId === input.missionId);
  }

  if (completed) {
    const profileRow = (await tx.objectStore("profiles").get(
      input.profileId,
    )) as StoredProfile;
    const profile = profileRow ? normalizeProfile(profileRow) : undefined;
    await tx.done;

    return {
      awarded: false,
      alreadyCompleted: true,
      profilePowerLevel: profile?.powerLevel ?? 0,
      squadPowerCurrent: squad.squadPowerCurrent,
      squadPowerMax: squad.squadPowerMax,
    };
  }

  const profileRow = (await tx.objectStore("profiles").get(
    input.profileId,
  )) as StoredProfile | undefined;
  const profile = profileRow ? normalizeProfile(profileRow) : undefined;
  if (!profile) {
    await tx.done;
    throw new Error("Profile not found");
  }

  const hadCompletionTodayBefore = (await tx.objectStore("missionHistory").getAll()).some(
    (row: MissionHistoryLocal) =>
      row.profileId === input.profileId && row.completedOnLocalDate === squad.cycleDate,
  );

  const nextProfile: Profile = {
    ...profile,
    powerLevel: profile.powerLevel + mission.powerValue,
  };

  if (!hadCompletionTodayBefore) {
    const nextStreak = computeNextStreakState({
      currentStreak: nextProfile.currentStreak,
      lastStreakDate: nextProfile.lastStreakDate,
      cycleDate: squad.cycleDate,
    });
    nextProfile.currentStreak = nextStreak.currentStreak;
    nextProfile.lastStreakDate = nextStreak.lastStreakDate;
  }

  const nextSquad: SquadState = {
    ...squad,
    squadPowerCurrent: clamp(
      squad.squadPowerCurrent + mission.powerValue,
      0,
      squad.squadPowerMax,
    ),
  };

  const historyRow: MissionHistoryLocal = {
    id: randomId(),
    missionId: input.missionId,
    profileId: input.profileId,
    completedAt: input.clientCompletedAt,
    completedOnLocalDate: squad.cycleDate,
    clientRequestId: input.clientRequestId,
    pointsAwarded: mission.powerValue,
  };

  await tx.objectStore("missionHistory").put(historyRow);
  await tx.objectStore("profiles").put(nextProfile);
  await tx.objectStore("meta").put({
    key: "squad",
    value: nextSquad,
  } satisfies MetaRow);
  await pushNotificationEvent(tx, {
    profileId: input.profileId,
    eventType: "mission_complete",
    title: "Mission Complete",
    message: `${nextProfile.heroName} finished "${mission.title}" (+${mission.powerValue} power).`,
  });
  await tx.done;

  return {
    awarded: true,
    alreadyCompleted: false,
    profilePowerLevel: nextProfile.powerLevel,
    squadPowerCurrent: nextSquad.squadPowerCurrent,
    squadPowerMax: nextSquad.squadPowerMax,
  };
}

export async function localUncompleteMission(
  input: MissionUncompletionRequest,
): Promise<UncompletionResult> {
  if (input.force && !isParentAuthenticatedLocally()) {
    throw new Error("UNAUTHORIZED");
  }

  const db = await getDb();
  const squad = await ensureCurrentCycle(db);
  const tx = db.transaction(
    ["missions", "profiles", "missionHistory", "meta"],
    "readwrite",
  );

  const missionRow = (await tx
    .objectStore("missions")
    .get(input.missionId)) as StoredMission | undefined;
  const mission = missionRow ? normalizeMission(missionRow) : undefined;
  if (
    !mission ||
    mission.profileId !== input.profileId ||
    !mission.isActive ||
    mission.deletedAt !== null
  ) {
    await tx.done;
    throw new Error("Mission not found or inactive");
  }

  const allHistory = (await tx.objectStore("missionHistory").getAll()) as MissionHistoryLocal[];
  const matchingRows = allHistory
    .filter((row) => row.missionId === input.missionId && row.profileId === input.profileId)
    .filter((row) =>
      mission.recurringDaily ? row.completedOnLocalDate === squad.cycleDate : true,
    )
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  const targetRow = matchingRows[0];

  const profileRow = (await tx.objectStore("profiles").get(
    input.profileId,
  )) as StoredProfile | undefined;
  const profile = profileRow ? normalizeProfile(profileRow) : undefined;
  if (!profile) {
    await tx.done;
    throw new Error("Profile not found");
  }

  if (!targetRow) {
    await tx.done;
    return {
      undone: false,
      wasCompleted: false,
      insufficientUnspentPoints: false,
      profilePowerLevel: profile.powerLevel,
      squadPowerCurrent: squad.squadPowerCurrent,
      squadPowerMax: squad.squadPowerMax,
    };
  }

  const undoPolicy = evaluateUndoEligibility({
    force: input.force,
    profilePowerLevel: profile.powerLevel,
    pointsAwarded: targetRow.pointsAwarded,
  });

  if (!undoPolicy.allowed) {
    await tx.done;
    return {
      undone: false,
      wasCompleted: true,
      insufficientUnspentPoints: undoPolicy.insufficientUnspentPoints,
      pointsRequiredToUndo: undoPolicy.pointsRequiredToUndo,
      profilePowerLevel: profile.powerLevel,
      squadPowerCurrent: squad.squadPowerCurrent,
      squadPowerMax: squad.squadPowerMax,
    };
  }

  await tx.objectStore("missionHistory").delete(targetRow.id);

  const pointsToReverse = targetRow.pointsAwarded;
  const nextProfile: Profile = {
    ...profile,
    powerLevel: Math.max(0, profile.powerLevel - pointsToReverse),
  };

  const nextSquad: SquadState = {
    ...squad,
    squadPowerCurrent: clamp(
      squad.squadPowerCurrent - pointsToReverse,
      0,
      squad.squadPowerMax,
    ),
  };

  await tx.objectStore("profiles").put(nextProfile);
  await tx.objectStore("meta").put({
    key: "squad",
    value: nextSquad,
  } satisfies MetaRow);
  await tx.done;

  return {
    undone: true,
    wasCompleted: true,
    insufficientUnspentPoints: false,
    profilePowerLevel: nextProfile.powerLevel,
    squadPowerCurrent: nextSquad.squadPowerCurrent,
    squadPowerMax: nextSquad.squadPowerMax,
  };
}

export async function localLoginParent(pin: string): Promise<boolean> {
  const db = await getDb();
  const settings = (await getMetaValue<ParentSettingsLocal>(
    db,
    "parent_settings",
  )) as ParentSettingsLocal | null;

  if (!settings) {
    return false;
  }

  const candidateHash = await hashPin(pin);
  if (candidateHash !== settings.pinHash) {
    return false;
  }

  setParentSession();
  return true;
}

function assertParentSession() {
  if (!isParentAuthenticatedLocally()) {
    throw new Error("UNAUTHORIZED");
  }
}

export async function localGetParentDashboard(): Promise<ParentDashboardData> {
  assertParentSession();

  const [profiles, missions, trashedMissions, squad, rewards] = await Promise.all([
    localGetProfiles(),
    localGetMissions(),
    localGetTrashedMissions(),
    localGetSquadState(),
    localGetRewards(),
  ]);

  return { profiles, missions, trashedMissions, squad, rewards };
}

export async function localCreateMission(input: CreateMissionInput): Promise<Mission> {
  assertParentSession();

  const db = await getDb();
  const missions = ((await db.getAll("missions")) as StoredMission[]).map(
    normalizeMission,
  );
  const nextSortOrder =
    input.sortOrder ??
    missions.filter((m) => m.profileId === input.profileId && m.deletedAt === null).length +
      1;

  const mission: Mission = {
    id: randomId(),
    profileId: input.profileId,
    title: input.title,
    instructions: input.instructions,
    imageUrl: input.imageUrl ?? null,
    powerValue: input.powerValue,
    isActive: input.isActive ?? true,
    recurringDaily: input.recurringDaily ?? true,
    sortOrder: nextSortOrder,
    deletedAt: null,
  };

  await db.put("missions", mission);
  return mission;
}

export async function localUpdateMission(
  id: string,
  input: UpdateMissionInput,
): Promise<Mission> {
  assertParentSession();

  const db = await getDb();
  const missionRow = (await db.get("missions", id)) as StoredMission | undefined;
  const mission = missionRow ? normalizeMission(missionRow) : undefined;
  if (!mission) throw new Error("Mission not found");

  const next: Mission = {
    ...mission,
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.instructions !== undefined ? { instructions: input.instructions } : {}),
    ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
    ...(input.powerValue !== undefined ? { powerValue: input.powerValue } : {}),
    ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    ...(input.recurringDaily !== undefined
      ? { recurringDaily: input.recurringDaily }
      : {}),
    ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
  };

  await db.put("missions", next);
  return next;
}

export async function localDeleteMission(id: string): Promise<void> {
  assertParentSession();

  const db = await getDb();
  const tx = db.transaction(["missions", "missionHistory"], "readwrite");

  const missionRow = (await tx.objectStore("missions").get(id)) as StoredMission | undefined;
  if (!missionRow) {
    await tx.done;
    throw new Error("Mission not found");
  }
  const mission = normalizeMission(missionRow);
  mission.isActive = false;
  mission.deletedAt = new Date().toISOString();
  await tx.objectStore("missions").put(mission);

  const historyRows = (await tx.objectStore("missionHistory").getAll()) as MissionHistoryLocal[];
  for (const row of historyRows) {
    if (row.missionId === id) {
      await tx.objectStore("missionHistory").delete(row.id);
    }
  }

  await tx.done;
}

export async function localRestoreMission(id: string): Promise<Mission> {
  assertParentSession();

  const db = await getDb();
  const missionRow = (await db.get("missions", id)) as StoredMission | undefined;
  const mission = missionRow ? normalizeMission(missionRow) : undefined;
  if (!mission) throw new Error("Mission not found");

  const next: Mission = {
    ...mission,
    deletedAt: null,
    isActive: true,
  };

  await db.put("missions", next);
  return next;
}

export async function localCreateReward(input: CreateRewardInput): Promise<Reward> {
  assertParentSession();

  const db = await getDb();
  const rewards = await localGetRewards();
  const reward: Reward = {
    id: randomId(),
    title: input.title,
    description: input.description,
    pointCost: input.pointCost,
    isActive: input.isActive ?? true,
    sortOrder: input.sortOrder ?? rewards.length + 1,
  };
  await db.put("rewards", reward);
  return reward;
}

export async function localUpdateReward(
  id: string,
  input: UpdateRewardInput,
): Promise<Reward> {
  assertParentSession();

  const db = await getDb();
  const reward = (await db.get("rewards", id)) as Reward | undefined;
  if (!reward) {
    throw new Error("Reward not found");
  }

  const next: Reward = {
    ...reward,
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.pointCost !== undefined ? { pointCost: input.pointCost } : {}),
    ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
  };

  await db.put("rewards", next);
  return next;
}

export async function localDeleteReward(id: string): Promise<void> {
  assertParentSession();

  const db = await getDb();
  const reward = await db.get("rewards", id);
  if (!reward) {
    throw new Error("Reward not found");
  }
  await db.delete("rewards", id);
}

export async function localClaimReward(
  input: ClaimRewardInput,
): Promise<ClaimRewardResult> {
  const db = await getDb();
  const tx = db.transaction(
    ["profiles", "rewards", "rewardClaims", "notifications"],
    "readwrite",
  );

  const profileRow = (await tx.objectStore("profiles").get(
    input.profileId,
  )) as StoredProfile | undefined;
  const profile = profileRow ? normalizeProfile(profileRow) : undefined;
  if (!profile) {
    await tx.done;
    throw new Error("Profile not found");
  }

  const reward = (await tx.objectStore("rewards").get(input.rewardId)) as Reward | undefined;
  if (!reward || !reward.isActive) {
    await tx.done;
    throw new Error("Reward unavailable");
  }

  if (profile.powerLevel < reward.pointCost) {
    await tx.done;
    return {
      claimed: false,
      insufficientPoints: true,
      alreadyClaimed: false,
      newPowerLevel: profile.powerLevel,
      reward,
    };
  }

  const nextProfile: Profile = {
    ...profile,
    powerLevel: profile.powerLevel - reward.pointCost,
  };

  const claimedAt = new Date().toISOString();
  const claim: RewardClaimLocal = {
    id: randomId(),
    profileId: input.profileId,
    rewardId: input.rewardId,
    pointCost: reward.pointCost,
    claimedAt,
    imageUrl: generateRewardStickerDataUrl({
      rewardTitle: reward.title,
      heroName: profile.heroName,
      claimedAt,
    }),
  };

  await tx.objectStore("profiles").put(nextProfile);
  await tx.objectStore("rewardClaims").put(claim);
  await pushNotificationEvent(tx, {
    profileId: input.profileId,
    eventType: "reward_claimed",
    title: "Reward Claimed",
    message: `${profile.heroName} claimed "${reward.title}" (-${reward.pointCost} power).`,
  });
  await tx.done;

  return {
    claimed: true,
    insufficientPoints: false,
    alreadyClaimed: false,
    newPowerLevel: nextProfile.powerLevel,
    reward,
  };
}

export async function localReturnReward(
  input: ReturnRewardInput,
): Promise<ReturnRewardResult> {
  const db = await getDb();
  const tx = db.transaction(
    ["profiles", "rewardClaims", "notifications", "rewards"],
    "readwrite",
  );

  const profileRow = (await tx.objectStore("profiles").get(
    input.profileId,
  )) as StoredProfile | undefined;
  const profile = profileRow ? normalizeProfile(profileRow) : undefined;
  if (!profile) {
    await tx.done;
    throw new Error("Profile not found");
  }

  const claim = (await tx.objectStore("rewardClaims").get(
    input.rewardClaimId,
  )) as RewardClaimLocal | undefined;
  if (!claim || claim.profileId !== input.profileId) {
    await tx.done;
    return {
      returned: false,
      restoredPoints: 0,
      newPowerLevel: profile.powerLevel,
    };
  }

  const nextProfile: Profile = {
    ...profile,
    powerLevel: profile.powerLevel + claim.pointCost,
  };

  const reward = (await tx.objectStore("rewards").get(claim.rewardId)) as Reward | undefined;
  await tx.objectStore("profiles").put(nextProfile);
  await tx.objectStore("rewardClaims").delete(claim.id);
  await pushNotificationEvent(tx, {
    profileId: input.profileId,
    eventType: "reward_returned",
    title: "Reward Returned",
    message: `${profile.heroName} gave back "${reward?.title ?? "a reward"}" (+${claim.pointCost} power).`,
  });
  await tx.done;

  return {
    returned: true,
    restoredPoints: claim.pointCost,
    newPowerLevel: nextProfile.powerLevel,
  };
}

export async function localAwardSquadPower(
  input: AwardSquadPowerInput,
): Promise<SquadState> {
  assertParentSession();

  const db = await getDb();
  const squad = await ensureCurrentCycle(db);

  const nextSquad: SquadState = {
    ...squad,
    squadPowerCurrent: clamp(
      squad.squadPowerCurrent + input.delta,
      0,
      squad.squadPowerMax,
    ),
  };

  await setMetaValue(db, "squad", nextSquad);
  return nextSquad;
}

export async function localSetSquadGoal(goal: SquadGoal | null): Promise<SquadState> {
  assertParentSession();

  const db = await getDb();
  const squad = await ensureCurrentCycle(db);
  const next: SquadState = {
    ...squad,
    squadGoal: goal ? { ...goal } : null,
  };
  await setMetaValue(db, "squad", next);
  return next;
}

export async function localLogoutParent(): Promise<void> {
  clearParentSession();
}

export async function localResetDaily(cycleDate: string): Promise<SquadState> {
  assertParentSession();

  const db = await getDb();
  const squad = await ensureCurrentCycle(db);
  const next = { ...squad, cycleDate };
  await setMetaValue(db, "squad", next);
  return next;
}

export async function localGetMissionHistory(
  profileId: string,
  days: number,
): Promise<MissionHistoryEntry[]> {
  const db = await getDb();
  const squad = await ensureCurrentCycle(db);
  const missionRows = ((await db.getAll("missions")) as StoredMission[]).map(
    normalizeMission,
  );
  const titleById = new Map(missionRows.map((mission) => [mission.id, mission.title]));

  const allHistory = (await db.getAll("missionHistory")) as MissionHistoryLocal[];
  const start = new Date(`${squad.cycleDate}T00:00:00.000Z`);
  start.setUTCDate(start.getUTCDate() - Math.max(0, days - 1));
  const minDate = start.toISOString().slice(0, 10);

  const grouped = new Map<string, Array<{ title: string; powerAwarded: number }>>();
  for (const row of allHistory) {
    if (row.profileId !== profileId || row.completedOnLocalDate < minDate) {
      continue;
    }

    const list = grouped.get(row.completedOnLocalDate) ?? [];
    list.push({
      title: titleById.get(row.missionId) ?? "Mission",
      powerAwarded: row.pointsAwarded,
    });
    grouped.set(row.completedOnLocalDate, list);
  }

  return Array.from(grouped.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, missions]) => ({ date, missions }));
}

export async function localGetNotifications(limit = 100): Promise<NotificationEvent[]> {
  assertParentSession();

  const db = await getDb();
  if (!db.objectStoreNames.contains("notifications")) {
    return [];
  }

  const rows = (await db.getAll("notifications")) as NotificationEventLocal[];
  return rows
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, Math.max(1, Math.min(500, limit)));
}

export async function localMarkNotificationsRead(): Promise<MarkNotificationsReadResult> {
  assertParentSession();

  const db = await getDb();
  if (!db.objectStoreNames.contains("notifications")) {
    return { markedCount: 0 };
  }

  const tx = db.transaction("notifications", "readwrite");
  const rows = (await tx.store.getAll()) as NotificationEventLocal[];
  const now = new Date().toISOString();
  let markedCount = 0;

  for (const row of rows) {
    if (row.readAt) continue;
    markedCount += 1;
    await tx.store.put({ ...row, readAt: now });
  }

  await tx.done;
  return { markedCount };
}

export async function localGetUnreadNotificationCount(): Promise<number> {
  const db = await getDb();
  if (!db.objectStoreNames.contains("notifications")) {
    return 0;
  }

  const rows = (await db.getAll("notifications")) as NotificationEventLocal[];
  return rows.filter((row) => !row.readAt).length;
}

export async function localCreateProfile(input: CreateProfileInput): Promise<Profile> {
  assertParentSession();

  const db = await getDb();
  const profile: Profile = {
    id: randomId(),
    heroName: input.heroName,
    avatarUrl: input.avatarUrl,
    uiMode: input.uiMode,
    powerLevel: 0,
    currentStreak: 0,
    lastStreakDate: null,
  };
  await db.put("profiles", profile);
  return profile;
}

export async function localUpdateProfile(
  id: string,
  input: UpdateProfileInput,
): Promise<Profile> {
  assertParentSession();

  const db = await getDb();
  const profileRow = (await db.get("profiles", id)) as StoredProfile | undefined;
  const profile = profileRow ? normalizeProfile(profileRow) : undefined;
  if (!profile) throw new Error("Profile not found");

  const next: Profile = {
    ...profile,
    ...(input.heroName !== undefined ? { heroName: input.heroName } : {}),
    ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
    ...(input.uiMode !== undefined ? { uiMode: input.uiMode } : {}),
  };

  await db.put("profiles", next);
  return next;
}

export async function localDeleteProfile(id: string): Promise<void> {
  assertParentSession();

  const db = await getDb();
  const tx = db.transaction(
    ["profiles", "missions", "missionHistory", "rewardClaims"],
    "readwrite",
  );

  const profile = await tx.objectStore("profiles").get(id);
  if (!profile) {
    await tx.done;
    throw new Error("Profile not found");
  }

  const allMissions = (await tx.objectStore("missions").getAll()) as StoredMission[];
  for (const m of allMissions) {
    if (m.profileId === id) {
      await tx.objectStore("missions").delete(m.id);
    }
  }

  const allHistory = (await tx.objectStore("missionHistory").getAll()) as MissionHistoryLocal[];
  for (const row of allHistory) {
    if (row.profileId === id) {
      await tx.objectStore("missionHistory").delete(row.id);
    }
  }

  const allClaims = (await tx.objectStore("rewardClaims").getAll()) as RewardClaimLocal[];
  for (const claim of allClaims) {
    if (claim.profileId === id) {
      await tx.objectStore("rewardClaims").delete(claim.id);
    }
  }

  await tx.objectStore("profiles").delete(id);
  await tx.done;
}

export async function localChangeParentPin(newPin: string): Promise<void> {
  assertParentSession();

  const db = await getDb();
  const pinHash = await hashPin(newPin);
  const settings: ParentSettingsLocal = {
    pinHash,
    updatedAt: new Date().toISOString(),
  };
  await setMetaValue(db, "parent_settings", settings);
}

export async function resetLocalDataForTests(): Promise<void> {
  if (typeof indexedDB === "undefined") {
    return;
  }

  if (dbPromise) {
    const db = await dbPromise;
    db.close();
  }
  dbPromise = null;
  seeded = false;
  clearParentSession();

  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
    setTimeout(() => resolve(), 50);
  });
}

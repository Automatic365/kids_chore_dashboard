"use client";

import { openDB } from "idb";

import { clamp, toLocalDateString } from "@/lib/date";
import { publicEnv } from "@/lib/public-env";
import { sha256Hex } from "@/lib/security/hash-client";
import {
  AwardSquadPowerInput,
  CompletionResult,
  CreateMissionInput,
  CreateProfileInput,
  Mission,
  MissionCompletionRequest,
  MissionUncompletionRequest,
  MissionWithState,
  ParentDashboardData,
  Profile,
  SquadState,
  UncompletionResult,
  UpdateMissionInput,
  UpdateProfileInput,
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

interface MetaRow {
  key: "squad" | "parent_settings";
  value: SquadState | ParentSettingsLocal;
}

const DB_NAME = "hero-habits-local";
const DB_VERSION = 1;
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
  },
  {
    id: "super-tot",
    heroName: "Super Tot",
    avatarUrl: "/avatars/super.svg",
    uiMode: "picture",
    powerLevel: 0,
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

type StoredMission = Omit<Mission, "recurringDaily" | "instructions"> & {
  recurringDaily?: boolean;
  instructions?: string;
  deletedAt?: string | null;
};

function normalizeMission(mission: StoredMission): Mission {
  return {
    ...mission,
    recurringDaily: mission.recurringDaily ?? true,
    instructions: mission.instructions ?? "Complete this mission.",
    deletedAt: mission.deletedAt ?? null,
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
      upgrade(db) {
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
    seeded = true;
    return;
  }

  const today = toLocalDateString(new Date(), publicEnv.appTimeZone);
  const pinHash =
    publicEnv.parentPinHash.length > 0
      ? publicEnv.parentPinHash
      : await hashPin(publicEnv.parentPinPlain);

  const tx = db.transaction(["profiles", "missions", "meta"], "readwrite");

  for (const profile of defaultProfiles) {
    await tx.objectStore("profiles").put(profile);
  }

  for (const mission of defaultMissions) {
    await tx.objectStore("missions").put(mission);
  }

  const squad: SquadState = {
    squadPowerCurrent: 0,
    squadPowerMax: 100,
    cycleDate: today,
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

async function ensureCurrentCycle(db: Awaited<ReturnType<typeof openDB>>): Promise<SquadState> {
  const squad = (await getMetaValue<SquadState>(db, "squad")) ?? {
    squadPowerCurrent: 0,
    squadPowerMax: 100,
    cycleDate: toLocalDateString(new Date(), publicEnv.appTimeZone),
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
  const profiles = (await db.getAll("profiles")) as Profile[];
  return profiles.sort((a, b) => a.heroName.localeCompare(b.heroName));
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

export async function localCompleteMission(
  input: MissionCompletionRequest,
): Promise<CompletionResult> {
  const db = await getDb();
  const squad = await ensureCurrentCycle(db);
  const tx = db.transaction(
    ["missions", "profiles", "missionHistory", "meta"],
    "readwrite",
  );

  const existingRequest = (await tx
    .objectStore("missionHistory")
    .index("by-client-request-id")
    .get(input.clientRequestId)) as MissionHistoryLocal | undefined;

  if (existingRequest) {
    const profile = (await tx.objectStore("profiles").get(input.profileId)) as Profile;
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
    const profile = (await tx.objectStore("profiles").get(input.profileId)) as Profile;
    await tx.done;

    return {
      awarded: false,
      alreadyCompleted: true,
      profilePowerLevel: profile?.powerLevel ?? 0,
      squadPowerCurrent: squad.squadPowerCurrent,
      squadPowerMax: squad.squadPowerMax,
    };
  }

  const profile = (await tx.objectStore("profiles").get(input.profileId)) as Profile | undefined;
  if (!profile) {
    await tx.done;
    throw new Error("Profile not found");
  }

  const nextProfile: Profile = {
    ...profile,
    powerLevel: profile.powerLevel + mission.powerValue,
  };

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

  const profile = (await tx.objectStore("profiles").get(input.profileId)) as Profile | undefined;
  if (!profile) {
    await tx.done;
    throw new Error("Profile not found");
  }

  if (!targetRow) {
    await tx.done;
    return {
      undone: false,
      wasCompleted: false,
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

  const [profiles, missions, trashedMissions, squad] = await Promise.all([
    localGetProfiles(),
    localGetMissions(),
    localGetTrashedMissions(),
    localGetSquadState(),
  ]);

  return { profiles, missions, trashedMissions, squad };
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

export async function localCreateProfile(input: CreateProfileInput): Promise<Profile> {
  assertParentSession();

  const db = await getDb();
  const profile: Profile = {
    id: randomId(),
    heroName: input.heroName,
    avatarUrl: input.avatarUrl,
    uiMode: input.uiMode,
    powerLevel: 0,
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
  const profile = (await db.get("profiles", id)) as Profile | undefined;
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
  const tx = db.transaction(["profiles", "missions"], "readwrite");

  const profile = await tx.objectStore("profiles").get(id);
  if (!profile) {
    await tx.done;
    throw new Error("Profile not found");
  }

  // soft-delete all missions for this profile
  const allMissions = (await tx.objectStore("missions").getAll()) as StoredMission[];
  const now = new Date().toISOString();
  for (const m of allMissions) {
    if (m.profileId === id && !m.deletedAt) {
      await tx.objectStore("missions").put({ ...normalizeMission(m), isActive: false, deletedAt: now });
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

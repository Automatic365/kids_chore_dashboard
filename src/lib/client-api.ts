import {
  localAwardSquadPower,
  localClaimReward,
  localChangeParentPin,
  localCompleteMission,
  localCreateMission,
  localCreateProfile,
  localCreateReward,
  localDeleteMission,
  localDeleteProfile,
  localDeleteReward,
  localGetRewardClaims,
  localGetMissionHistory,
  localGetMissions,
  localGetParentDashboard,
  localGetProfiles,
  localGetRewards,
  localGetSquadState,
  localLoginParent,
  localLogoutParent,
  localRestoreMission,
  localSetSquadGoal,
  localUncompleteMission,
  localUpdateMission,
  localUpdateProfile,
  localUpdateReward,
} from "@/lib/local-data";
import { publicEnv } from "@/lib/public-env";
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
  MissionUncompletionRequest,
  MissionWithState,
  ParentDashboardData,
  Profile,
  Reward,
  RewardClaimEntry,
  SquadGoal,
  SquadState,
  UncompletionResult,
  UpdateMissionInput,
  UpdateProfileInput,
  UpdateRewardInput,
} from "@/lib/types/domain";

export function isRemoteApiEnabled(): boolean {
  return publicEnv.useRemoteApi;
}

async function withFallback<T>(
  remote: () => Promise<T>,
  local: () => Promise<T>,
): Promise<T> {
  if (!isRemoteApiEnabled()) {
    return local();
  }

  try {
    return await remote();
  } catch {
    return local();
  }
}

export async function fetchProfiles(): Promise<Profile[]> {
  return withFallback(
    async () => {
      const response = await fetch("/api/public/profiles", { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to load profiles");
      const data = (await response.json()) as { profiles: Profile[] };
      return data.profiles;
    },
    () => localGetProfiles(),
  );
}

export async function fetchMissions(profileId: string): Promise<MissionWithState[]> {
  return withFallback(
    async () => {
      const response = await fetch(`/api/public/missions?profileId=${profileId}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Failed to load missions");
      const data = (await response.json()) as { missions: MissionWithState[] };
      return data.missions;
    },
    () => localGetMissions(profileId),
  );
}

export async function fetchSquadState(): Promise<SquadState> {
  return withFallback(
    async () => {
      const response = await fetch("/api/public/squad-state", { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to load squad state");
      const data = (await response.json()) as { squad: SquadState };
      return data.squad;
    },
    () => localGetSquadState(),
  );
}

export async function completeMission(payload: {
  missionId: string;
  profileId: string;
  clientRequestId: string;
  clientCompletedAt: string;
}): Promise<CompletionResult> {
  if (!isRemoteApiEnabled()) {
    return localCompleteMission(payload);
  }

  const response = await fetch("/api/public/complete-mission", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? "Mission completion failed");
  }

  const data = (await response.json()) as { result: CompletionResult };
  return data.result;
}

export async function uncompleteMission(
  payload: MissionUncompletionRequest,
): Promise<UncompletionResult> {
  if (!isRemoteApiEnabled()) {
    return localUncompleteMission(payload);
  }

  const response = await fetch("/api/public/uncomplete-mission", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? "Mission undo failed");
  }

  const data = (await response.json()) as { result: UncompletionResult };
  return data.result;
}

export async function loginParent(pin: string): Promise<boolean> {
  return withFallback(
    async () => {
      const response = await fetch("/api/parent/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      return response.ok;
    },
    () => localLoginParent(pin),
  );
}

export async function logoutParent(): Promise<void> {
  return withFallback(
    async () => {
      await fetch("/api/parent/auth/logout", { method: "POST" });
    },
    () => localLogoutParent(),
  );
}

export async function fetchParentDashboard(): Promise<ParentDashboardData> {
  return withFallback(
    async () => {
      const response = await fetch("/api/parent/dashboard", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(response.status === 401 ? "UNAUTHORIZED" : "Failed to load");
      }
      return (await response.json()) as ParentDashboardData;
    },
    () => localGetParentDashboard(),
  );
}

export async function createMission(input: CreateMissionInput): Promise<Mission> {
  return withFallback(
    async () => {
      const response = await fetch("/api/parent/missions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) throw new Error("Mission creation failed");
      const data = (await response.json()) as { mission: Mission };
      return data.mission;
    },
    () => localCreateMission(input),
  );
}

export async function updateMission(
  id: string,
  input: UpdateMissionInput,
): Promise<Mission> {
  return withFallback(
    async () => {
      const response = await fetch(`/api/parent/missions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) throw new Error("Mission update failed");
      const data = (await response.json()) as { mission: Mission };
      return data.mission;
    },
    () => localUpdateMission(id, input),
  );
}

export async function deleteMission(id: string): Promise<void> {
  return withFallback(
    async () => {
      const response = await fetch(`/api/parent/missions/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Mission delete failed");
    },
    () => localDeleteMission(id),
  );
}

export async function restoreMission(id: string): Promise<Mission> {
  return withFallback(
    async () => {
      const response = await fetch(`/api/parent/missions/${id}/restore`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Mission restore failed");
      const data = (await response.json()) as { mission: Mission };
      return data.mission;
    },
    () => localRestoreMission(id),
  );
}

export async function awardSquadPower(
  input: AwardSquadPowerInput,
): Promise<SquadState> {
  return withFallback(
    async () => {
      const response = await fetch("/api/parent/squad/award", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) throw new Error("Squad award failed");
      const data = (await response.json()) as { squad: SquadState };
      return data.squad;
    },
    () => localAwardSquadPower(input),
  );
}

export async function createProfile(input: CreateProfileInput): Promise<Profile> {
  return withFallback(
    async () => {
      const response = await fetch("/api/parent/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) throw new Error("Profile creation failed");
      const data = (await response.json()) as { profile: Profile };
      return data.profile;
    },
    () => localCreateProfile(input),
  );
}

export async function updateProfile(
  id: string,
  input: UpdateProfileInput,
): Promise<Profile> {
  return withFallback(
    async () => {
      const response = await fetch(`/api/parent/profiles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) throw new Error("Profile update failed");
      const data = (await response.json()) as { profile: Profile };
      return data.profile;
    },
    () => localUpdateProfile(id, input),
  );
}

export async function deleteProfile(id: string): Promise<void> {
  return withFallback(
    async () => {
      const response = await fetch(`/api/parent/profiles/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Profile delete failed");
    },
    () => localDeleteProfile(id),
  );
}

export async function changeParentPin(newPin: string): Promise<void> {
  return withFallback(
    async () => {
      const response = await fetch("/api/parent/auth/change-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPin }),
      });
      if (!response.ok) throw new Error("PIN change failed");
    },
    () => localChangeParentPin(newPin),
  );
}

export async function fetchRewards(): Promise<Reward[]> {
  return withFallback(
    async () => {
      const response = await fetch("/api/public/rewards", { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to load rewards");
      const data = (await response.json()) as { rewards: Reward[] };
      return data.rewards;
    },
    () => localGetRewards(),
  );
}

export async function fetchRewardClaims(
  profileId: string,
): Promise<RewardClaimEntry[]> {
  return withFallback(
    async () => {
      const response = await fetch(
        `/api/public/reward-claims?profileId=${encodeURIComponent(profileId)}`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error("Failed to load reward claims");
      const data = (await response.json()) as { claims: RewardClaimEntry[] };
      return data.claims;
    },
    () => localGetRewardClaims(profileId),
  );
}

export async function createReward(input: CreateRewardInput): Promise<Reward> {
  return withFallback(
    async () => {
      const response = await fetch("/api/parent/rewards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) throw new Error("Reward creation failed");
      const data = (await response.json()) as { reward: Reward };
      return data.reward;
    },
    () => localCreateReward(input),
  );
}

export async function updateReward(id: string, input: UpdateRewardInput): Promise<Reward> {
  return withFallback(
    async () => {
      const response = await fetch(`/api/parent/rewards/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) throw new Error("Reward update failed");
      const data = (await response.json()) as { reward: Reward };
      return data.reward;
    },
    () => localUpdateReward(id, input),
  );
}

export async function deleteReward(id: string): Promise<void> {
  return withFallback(
    async () => {
      const response = await fetch(`/api/parent/rewards/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Reward delete failed");
    },
    () => localDeleteReward(id),
  );
}

export async function claimReward(input: ClaimRewardInput): Promise<ClaimRewardResult> {
  if (!isRemoteApiEnabled()) {
    return localClaimReward(input);
  }

  const response = await fetch("/api/public/claim-reward", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const err = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? "Claim failed");
  }
  const data = (await response.json()) as { result: ClaimRewardResult };
  return data.result;
}

export async function setSquadGoal(goal: SquadGoal | null): Promise<SquadState> {
  return withFallback(
    async () => {
      const response = await fetch("/api/parent/squad/goal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal }),
      });
      if (!response.ok) throw new Error("Failed to set squad goal");
      const data = (await response.json()) as { squad: SquadState };
      return data.squad;
    },
    () => localSetSquadGoal(goal),
  );
}

export async function fetchMissionHistory(
  profileId: string,
  days: number,
): Promise<MissionHistoryEntry[]> {
  return withFallback(
    async () => {
      const response = await fetch(
        `/api/public/mission-history?profileId=${encodeURIComponent(profileId)}&days=${Math.max(
          1,
          Math.floor(days),
        )}`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error("Failed to load mission history");
      const data = (await response.json()) as { history: MissionHistoryEntry[] };
      return data.history;
    },
    () => localGetMissionHistory(profileId, days),
  );
}

export async function generateAvatar(heroName: string): Promise<string> {
  if (!isRemoteApiEnabled()) {
    const emojis = [
      "🦸",
      "🦸‍♀️",
      "🛡️",
      "⚡",
      "🌟",
      "🔥",
      "🚀",
      "🧠",
      "🦁",
      "🐯",
      "🐼",
      "🐙",
      "🦊",
      "🐲",
      "🛰️",
      "🎯",
      "🎨",
      "🏆",
      "💥",
      "🌈",
    ];
    const code = heroName.trim().charCodeAt(0);
    return emojis[(Number.isFinite(code) ? Math.abs(code) : 0) % emojis.length];
  }

  const response = await fetch("/api/parent/profiles/generate-avatar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ heroName }),
  });
  if (!response.ok) {
    throw new Error("Avatar generation failed");
  }
  const data = (await response.json()) as { avatarDataUrl: string };
  return data.avatarDataUrl;
}

export interface ParentSummaryData {
  cycleDate: string;
  days: string[];
  heroes: Array<{
    profileId: string;
    heroName: string;
    todayCompleted: number;
    todayTotal: number;
    daily: Array<{ date: string; completed: number }>;
  }>;
}

export async function fetchParentSummary(): Promise<ParentSummaryData> {
  return withFallback(
    async () => {
      const response = await fetch("/api/parent/summary", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(response.status === 401 ? "UNAUTHORIZED" : "Failed to load summary");
      }
      return (await response.json()) as ParentSummaryData;
    },
    async () => {
      const [profiles, squad] = await Promise.all([
        localGetProfiles(),
        localGetSquadState(),
      ]);
      const dates: string[] = [];
      const cycle = new Date(`${squad.cycleDate}T00:00:00.000Z`);
      for (let i = 6; i >= 0; i -= 1) {
        const d = new Date(cycle);
        d.setUTCDate(cycle.getUTCDate() - i);
        dates.push(d.toISOString().slice(0, 10));
      }

      const heroes = await Promise.all(
        profiles.map(async (profile) => {
          const [missions, history] = await Promise.all([
            localGetMissions(profile.id),
            localGetMissionHistory(profile.id, 7),
          ]);
          const counts = new Map(history.map((entry) => [entry.date, entry.missions.length]));
          return {
            profileId: profile.id,
            heroName: profile.heroName,
            todayCompleted: counts.get(squad.cycleDate) ?? 0,
            todayTotal: missions.length,
            daily: dates.map((date) => ({ date, completed: counts.get(date) ?? 0 })),
          };
        }),
      );

      return {
        cycleDate: squad.cycleDate,
        days: dates,
        heroes,
      };
    },
  );
}

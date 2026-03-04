import {
  localAwardSquadPower,
  localChangeParentPin,
  localCompleteMission,
  localCreateMission,
  localCreateProfile,
  localDeleteMission,
  localDeleteProfile,
  localGetMissions,
  localGetParentDashboard,
  localGetProfiles,
  localGetSquadState,
  localLoginParent,
  localLogoutParent,
  localRestoreMission,
  localUncompleteMission,
  localUpdateMission,
  localUpdateProfile,
} from "@/lib/local-data";
import { publicEnv } from "@/lib/public-env";
import {
  AwardSquadPowerInput,
  CompletionResult,
  CreateMissionInput,
  CreateProfileInput,
  Mission,
  MissionUncompletionRequest,
  MissionWithState,
  ParentDashboardData,
  Profile,
  SquadState,
  UncompletionResult,
  UpdateMissionInput,
  UpdateProfileInput,
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
  return withFallback(
    async () => {
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
    },
    () => localCompleteMission(payload),
  );
}

export async function uncompleteMission(
  payload: MissionUncompletionRequest,
): Promise<UncompletionResult> {
  return withFallback(
    async () => {
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
    },
    () => localUncompleteMission(payload),
  );
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

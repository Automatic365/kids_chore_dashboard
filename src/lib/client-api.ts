import {
  localAwardSquadPower,
  localClaimReward,
  localChangeParentPin,
  localCompleteMission,
  localCreateMissionBackfill,
  localCreateMission,
  localCreateProfile,
  localCreateReward,
  localDeleteMissionBackfill,
  localDeleteMission,
  localDeleteProfile,
  localDeleteReward,
  localGetMissionBackfills,
  localGetNotifications,
  localGetRewardClaims,
  localGetUnreadNotificationCount,
  localGetMissionHistory,
  localGetMissions,
  localGetParentDashboard,
  localGetProfiles,
  localGetRewards,
  localGetSquadState,
  localLoginParent,
  localLogoutParent,
  localReturnReward,
  localRestoreMission,
  localRedeemSquadGoal,
  localSetSquadGoal,
  localMarkNotificationsRead,
  localUncompleteMission,
  localUpdateMission,
  localUpdateProfile,
  localUpdateReward,
} from "@/lib/local-data";
import { ANALYTICS_MAX_WINDOW_DAYS, ANALYTICS_START_DATE } from "@/lib/analytics-config";
import { buildParentSummary } from "@/lib/parent-analytics";
import { publicEnv } from "@/lib/public-env";
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
  MarkNotificationsReadResult,
  Mission,
  MissionBackfillEntry,
  MissionHistoryEntry,
  MissionUncompletionRequest,
  MissionWithState,
  NotificationEvent,
  ParentDashboardData,
  ParentSummaryData,
  Profile,
  Reward,
  RewardClaimEntry,
  ReturnRewardInput,
  ReturnRewardResult,
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

type ErrorPayload = {
  error?: string | { message?: string };
};

function getApiErrorMessage(payload: ErrorPayload, fallback: string): string {
  if (typeof payload.error === "string" && payload.error.length > 0) {
    return payload.error;
  }
  if (
    typeof payload.error === "object" &&
    payload.error !== null &&
    typeof payload.error.message === "string" &&
    payload.error.message.length > 0
  ) {
    return payload.error.message;
  }
  return fallback;
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
    const err = (await response.json().catch(() => ({}))) as ErrorPayload;
    throw new Error(getApiErrorMessage(err, "Mission completion failed"));
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
    const err = (await response.json().catch(() => ({}))) as ErrorPayload;
    throw new Error(getApiErrorMessage(err, "Mission undo failed"));
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
      if (!response.ok) {
        const err = (await response.json().catch(() => ({}))) as ErrorPayload;
        throw new Error(getApiErrorMessage(err, "Mission creation failed"));
      }
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
      if (!response.ok) {
        const err = (await response.json().catch(() => ({}))) as ErrorPayload;
        throw new Error(getApiErrorMessage(err, "Mission update failed"));
      }
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
      if (!response.ok) {
        const err = (await response.json().catch(() => ({}))) as ErrorPayload;
        throw new Error(getApiErrorMessage(err, "Mission delete failed"));
      }
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
      if (!response.ok) {
        const err = (await response.json().catch(() => ({}))) as ErrorPayload;
        throw new Error(getApiErrorMessage(err, "Mission restore failed"));
      }
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
      if (!response.ok) {
        const err = (await response.json().catch(() => ({}))) as ErrorPayload;
        throw new Error(getApiErrorMessage(err, "Squad award failed"));
      }
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
      if (!response.ok) {
        const err = (await response.json().catch(() => ({}))) as ErrorPayload;
        throw new Error(getApiErrorMessage(err, "Profile creation failed"));
      }
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
      if (!response.ok) {
        const err = (await response.json().catch(() => ({}))) as ErrorPayload;
        throw new Error(getApiErrorMessage(err, "Profile update failed"));
      }
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
      if (!response.ok) {
        const err = (await response.json().catch(() => ({}))) as ErrorPayload;
        throw new Error(getApiErrorMessage(err, "Profile delete failed"));
      }
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
      if (!response.ok) {
        const err = (await response.json().catch(() => ({}))) as ErrorPayload;
        throw new Error(getApiErrorMessage(err, "PIN change failed"));
      }
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
      if (!response.ok) {
        const err = (await response.json().catch(() => ({}))) as ErrorPayload;
        throw new Error(getApiErrorMessage(err, "Reward creation failed"));
      }
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
      if (!response.ok) {
        const err = (await response.json().catch(() => ({}))) as ErrorPayload;
        throw new Error(getApiErrorMessage(err, "Reward update failed"));
      }
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
      if (!response.ok) {
        const err = (await response.json().catch(() => ({}))) as ErrorPayload;
        throw new Error(getApiErrorMessage(err, "Reward delete failed"));
      }
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
    const err = (await response.json().catch(() => ({}))) as ErrorPayload;
    throw new Error(getApiErrorMessage(err, "Claim failed"));
  }
  const data = (await response.json()) as { result: ClaimRewardResult };
  return data.result;
}

export async function createMissionBackfill(
  input: CreateMissionBackfillInput,
): Promise<CreateMissionBackfillResult> {
  return withFallback(
    async () => {
      const response = await fetch("/api/parent/missions/backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        const err = (await response.json().catch(() => ({}))) as ErrorPayload;
        throw new Error(getApiErrorMessage(err, "Mission backfill failed"));
      }
      const data = (await response.json()) as { result: CreateMissionBackfillResult };
      return data.result;
    },
    () => localCreateMissionBackfill(input),
  );
}

export async function fetchMissionBackfills(
  profileId: string,
): Promise<MissionBackfillEntry[]> {
  return withFallback(
    async () => {
      const response = await fetch(
        `/api/parent/missions/backfill?profileId=${encodeURIComponent(profileId)}`,
        {
          cache: "no-store",
        },
      );
      if (!response.ok) {
        const err = (await response.json().catch(() => ({}))) as ErrorPayload;
        throw new Error(getApiErrorMessage(err, "Failed to load backfills"));
      }
      const data = (await response.json()) as { backfills: MissionBackfillEntry[] };
      return data.backfills;
    },
    () => localGetMissionBackfills(profileId),
  );
}

export async function deleteMissionBackfill(id: string): Promise<DeleteMissionBackfillResult> {
  return withFallback(
    async () => {
      const response = await fetch(`/api/parent/missions/backfill/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const err = (await response.json().catch(() => ({}))) as ErrorPayload;
        throw new Error(getApiErrorMessage(err, "Failed to remove backfill"));
      }
      const data = (await response.json()) as { result: DeleteMissionBackfillResult };
      return data.result;
    },
    () => localDeleteMissionBackfill(id),
  );
}

export async function returnReward(input: ReturnRewardInput): Promise<ReturnRewardResult> {
  return withFallback(
    async () => {
      const response = await fetch("/api/public/return-reward", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        const err = (await response.json().catch(() => ({}))) as ErrorPayload;
        throw new Error(getApiErrorMessage(err, "Return reward failed"));
      }
      const data = (await response.json()) as { result: ReturnRewardResult };
      return data.result;
    },
    () => localReturnReward(input),
  );
}

export async function setSquadGoal(goal: SquadGoal | null): Promise<SquadState> {
  return withFallback(
    async () => {
      const response = await fetch("/api/parent/squad/goal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal }),
      });
      if (!response.ok) {
        const err = (await response.json().catch(() => ({}))) as ErrorPayload;
        throw new Error(getApiErrorMessage(err, "Failed to set squad goal"));
      }
      const data = (await response.json()) as { squad: SquadState };
      return data.squad;
    },
    () => localSetSquadGoal(goal),
  );
}

export async function redeemSquadGoal(): Promise<SquadState> {
  return withFallback(
    async () => {
      const response = await fetch("/api/parent/squad/redeem", { method: "POST" });
      if (!response.ok) {
        const err = (await response.json().catch(() => ({}))) as ErrorPayload;
        throw new Error(getApiErrorMessage(err, "Failed to redeem squad goal"));
      }
      const data = (await response.json()) as { squad: SquadState };
      return data.squad;
    },
    () => localRedeemSquadGoal(),
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

export async function fetchNotifications(limit = 100): Promise<NotificationEvent[]> {
  return withFallback(
    async () => {
      const response = await fetch(
        `/api/parent/notifications?limit=${Math.max(1, Math.floor(limit))}`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        throw new Error(response.status === 401 ? "UNAUTHORIZED" : "Failed to load notifications");
      }
      const data = (await response.json()) as { notifications: NotificationEvent[] };
      return data.notifications;
    },
    () => localGetNotifications(limit),
  );
}

export async function markNotificationsRead(): Promise<MarkNotificationsReadResult> {
  return withFallback(
    async () => {
      const response = await fetch("/api/parent/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        throw new Error(response.status === 401 ? "UNAUTHORIZED" : "Failed to mark notifications read");
      }
      const data = (await response.json()) as { result: MarkNotificationsReadResult };
      return data.result;
    },
    () => localMarkNotificationsRead(),
  );
}

export async function fetchUnreadNotificationCount(): Promise<number> {
  return withFallback(
    async () => {
      const response = await fetch("/api/public/notification-count", {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("Failed to load notification count");
      }
      const data = (await response.json()) as { unreadCount: number };
      return data.unreadCount;
    },
    () => localGetUnreadNotificationCount(),
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

export async function uploadParentMedia(
  file: File,
  kind: "avatar" | "mission" = "mission",
): Promise<string> {
  const formData = new FormData();
  formData.set("file", file);
  formData.set("kind", kind);

  const response = await fetch("/api/parent/media/upload", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const err = (await response.json().catch(() => ({}))) as ErrorPayload;
    throw new Error(getApiErrorMessage(err, "Media upload failed"));
  }

  const data = (await response.json()) as { url: string };
  return data.url;
}

export interface SignedParentMediaUpload {
  bucket: string;
  path: string;
  token: string;
  url: string;
}

export async function createSignedParentMediaUpload(input: {
  kind: "avatar" | "mission";
  fileName: string;
  fileType: string;
  fileSize: number;
}): Promise<SignedParentMediaUpload> {
  const response = await fetch("/api/parent/media/signed-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const err = (await response.json().catch(() => ({}))) as ErrorPayload;
    throw new Error(getApiErrorMessage(err, "Failed to prepare media upload"));
  }

  return (await response.json()) as SignedParentMediaUpload;
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
      const profileData = await Promise.all(
        profiles.map(async (profile) => {
          const [missions, history] = await Promise.all([
            localGetMissions(profile.id),
            localGetMissionHistory(profile.id, ANALYTICS_MAX_WINDOW_DAYS),
          ]);
          return { profileId: profile.id, missions, history };
        }),
      );

      return buildParentSummary({
        cycleDate: squad.cycleDate,
        windowDays: ANALYTICS_MAX_WINDOW_DAYS,
        analyticsStartDate: ANALYTICS_START_DATE,
        profiles,
        missionsByProfileId: new Map(
          profileData.map((entry) => [entry.profileId, entry.missions]),
        ),
        historyByProfileId: new Map(
          profileData.map((entry) => [entry.profileId, entry.history]),
        ),
      });
    },
  );
}

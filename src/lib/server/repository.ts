import { clamp, isValidLocalDateString, toLocalDateString } from "@/lib/date";
import { env, hasSupabaseAdmin } from "@/lib/env";
import {
  evaluateUndoEligibility,
  recomputeStreakStateFromCompletionDates,
} from "@/lib/game-rules";
import { toHeroCardObjectPosition } from "@/lib/hero-card-position";
import {
  buildMissionBackfillClientRequestId,
  isMissionBackfillClientRequestId,
} from "@/lib/mission-backfill";
import { getRewardCooldownStatus } from "@/lib/reward-cooldown";
import { compareRewardsByCost } from "@/lib/reward-order";
import { DEFAULT_SQUAD_POWER_MAX, normalizeSquadPowerMax } from "@/lib/squad-config";
import { getLocalStore } from "@/lib/server/local-store";
import { hashPin, verifyPin } from "@/lib/server/pin";
import { generateRewardClaimArt } from "@/lib/server/reward-claim-art";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  AwardSquadPowerInput,
  ClaimRewardInput,
  ClaimRewardResult,
  CompletionResult,
  CreateMissionBackfillInput,
  CreateMissionInput,
  CreateProfileInput,
  CreateRewardInput,
  CreateMissionBackfillResult,
  DeleteMissionBackfillResult,
  Mission,
  MissionBackfillEntry,
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
  SquadGoal,
  SquadState,
  UncompletionResult,
  UpdateMissionInput,
  UpdateProfileInput,
  UpdateRewardInput,
} from "@/lib/types/domain";

export interface Repository {
  getProfiles(): Promise<Profile[]>;
  getMissions(profileId?: string): Promise<MissionWithState[]>;
  getTrashedMissions(): Promise<MissionWithState[]>;
  getSquadState(): Promise<SquadState>;
  completeMission(input: MissionCompletionRequest): Promise<CompletionResult>;
  uncompleteMission(input: MissionUncompletionRequest): Promise<UncompletionResult>;
  createMission(input: CreateMissionInput): Promise<Mission>;
  updateMission(id: string, input: UpdateMissionInput): Promise<Mission>;
  deleteMission(id: string): Promise<void>;
  restoreMission(id: string): Promise<Mission>;
  awardSquadPower(input: AwardSquadPowerInput): Promise<SquadState>;
  getRewards(): Promise<Reward[]>;
  createReward(input: CreateRewardInput): Promise<Reward>;
  updateReward(id: string, input: UpdateRewardInput): Promise<Reward>;
  deleteReward(id: string): Promise<void>;
  claimReward(input: ClaimRewardInput): Promise<ClaimRewardResult>;
  returnReward(input: ReturnRewardInput): Promise<ReturnRewardResult>;
  getRewardClaims(profileId: string): Promise<RewardClaimEntry[]>;
  setSquadGoal(goal: SquadGoal | null): Promise<SquadState>;
  redeemSquadGoal(): Promise<SquadState>;
  getMissionHistory(profileId: string, days: number): Promise<MissionHistoryEntry[]>;
  createMissionBackfill(input: CreateMissionBackfillInput): Promise<CreateMissionBackfillResult>;
  getMissionBackfills(profileId: string): Promise<MissionBackfillEntry[]>;
  deleteMissionBackfill(id: string): Promise<DeleteMissionBackfillResult>;
  getNotifications(limit?: number): Promise<NotificationEvent[]>;
  markNotificationsRead(): Promise<MarkNotificationsReadResult>;
  getUnreadNotificationCount(): Promise<number>;
  verifyParentPin(pin: string): Promise<boolean>;
  changeParentPin(newPin: string): Promise<void>;
  getParentDashboard(): Promise<ParentDashboardData>;
  resetDaily(cycleDate?: string): Promise<SquadState>;
  createProfile(input: CreateProfileInput): Promise<Profile>;
  updateProfile(id: string, input: UpdateProfileInput): Promise<Profile>;
  deleteProfile(id: string): Promise<void>;
}

function mapProfile(row: {
  id: string;
  hero_name: string;
  avatar_url: string;
  ui_mode: "text" | "picture";
  hero_card_object_position?: string | null;
  reward_points?: number | null;
  power_level: number;
  current_streak?: number | null;
  last_streak_date?: string | null;
}): Profile {
  const xpPoints = Number(row.power_level ?? 0);
  const rewardPoints = Number(row.reward_points ?? row.power_level ?? 0);
  return {
    id: row.id,
    heroName: row.hero_name,
    avatarUrl: row.avatar_url,
    uiMode: row.ui_mode,
    heroCardObjectPosition: toHeroCardObjectPosition(row.hero_card_object_position),
    rewardPoints,
    xpPoints,
    powerLevel: xpPoints,
    currentStreak: Number(row.current_streak ?? 0),
    lastStreakDate: row.last_streak_date ?? null,
  };
}

function mapMission(row: {
  id: string;
  profile_id: string;
  title: string;
  instructions: string;
  image_url: string | null;
  power_value: number;
  is_active: boolean;
  recurring_daily: boolean;
  sort_order: number;
  deleted_at: string | null;
}): Mission {
  return {
    id: row.id,
    profileId: row.profile_id,
    title: row.title,
    instructions: row.instructions,
    imageUrl: row.image_url,
    powerValue: row.power_value,
    isActive: row.is_active,
    recurringDaily: row.recurring_daily,
    sortOrder: row.sort_order,
    deletedAt: row.deleted_at,
  };
}

type ProfileRow = {
  id: string;
  hero_name: string;
  avatar_url: string;
  ui_mode: "text" | "picture";
  hero_card_object_position?: string | null;
  reward_points?: number | null;
  power_level: number;
  current_streak?: number | null;
  last_streak_date?: string | null;
};

type MissionRow = {
  id: string;
  profile_id: string;
  title: string;
  instructions: string;
  image_url: string | null;
  power_value: number;
  is_active: boolean;
  recurring_daily: boolean;
  sort_order: number;
  deleted_at: string | null;
};

type SquadRow = {
  squad_power_current: number;
  squad_power_max: number;
  cycle_date: string;
  squad_goal_title?: string | null;
  squad_goal_target_power?: number | null;
  squad_goal_reward_description?: string | null;
  goal_completion_count?: number | null;
};

type RewardRow = {
  id: string;
  title: string;
  description: string;
  point_cost: number;
  target_days_to_earn?: number | null;
  min_days_between_claims?: number | null;
  is_active: boolean;
  sort_order: number;
};

type RewardClaimSupabaseRow = {
  id: string;
  profile_id: string;
  reward_id: string;
  point_cost: number;
  claimed_at: string;
  image_url: string | null;
  sticker_type: "vehicle" | "companion" | null;
  sticker_concept_id: string | null;
  sticker_prompt_seed: string | null;
};

type NotificationRow = {
  id: string;
  profile_id: string;
  event_type: string;
  title: string;
  message: string;
  created_at: string;
  read_at: string | null;
};

function mapReward(row: RewardRow): Reward {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    pointCost: row.point_cost,
    targetDaysToEarn: row.target_days_to_earn ?? null,
    minDaysBetweenClaims: row.min_days_between_claims ?? null,
    isActive: row.is_active,
    sortOrder: row.sort_order,
  };
}

function mapSquadRow(row: SquadRow): SquadState {
  return {
    squadPowerCurrent: row.squad_power_current,
    squadPowerMax: normalizeSquadPowerMax(row.squad_power_max),
    cycleDate: row.cycle_date,
    squadGoal:
      row.squad_goal_title &&
      typeof row.squad_goal_target_power === "number" &&
      row.squad_goal_reward_description
        ? {
            title: row.squad_goal_title,
            targetPower: row.squad_goal_target_power,
            rewardDescription: row.squad_goal_reward_description,
          }
        : null,
    goalCompletionCount: row.goal_completion_count ?? 0,
  };
}

function mapNotification(row: NotificationRow): NotificationEvent {
  return {
    id: row.id,
    profileId: row.profile_id,
    eventType:
      row.event_type === "reward_claimed" || row.event_type === "reward_returned"
        ? row.event_type
        : "mission_complete",
    title: row.title,
    message: row.message,
    createdAt: row.created_at,
    readAt: row.read_at,
  };
}

function isMissingColumnError(message: string, columnName: string): boolean {
  return message.includes(`column ${columnName} does not exist`);
}

function isMissingRpcArgError(message: string, argName: string): boolean {
  return message.includes(argName) && message.includes("claim_reward_v1");
}

async function fetchProfilePoints(
  admin: ReturnType<typeof getSupabaseAdmin>,
  profileId: string,
): Promise<{
  rewardPoints: number;
  xpPoints: number;
  powerLevel: number;
}> {
  if (!admin) {
    throw new Error("Supabase is not configured");
  }

  let response = await admin
    .from("profiles")
    .select("reward_points, power_level")
    .eq("id", profileId)
    .maybeSingle();
  if (
    response.error &&
    isMissingColumnError(response.error.message, "profiles.reward_points")
  ) {
    response = await admin
      .from("profiles")
      .select("power_level")
      .eq("id", profileId)
      .maybeSingle();
  }

  if (response.error) {
    throw new Error(response.error.message);
  }

  const row = (response.data ?? null) as {
    reward_points?: number | null;
    power_level?: number | null;
  } | null;
  if (!row || row.reward_points === undefined) {
    const rewardPoints = Number(row?.power_level ?? 0);
    const { data: claimRows, error: claimError } = await admin
      .from("reward_claims")
      .select("point_cost")
      .eq("profile_id", profileId);
    if (claimError) {
      throw new Error(claimError.message);
    }
    const spentRewardPoints = ((claimRows ?? []) as Array<{ point_cost?: number | null }>)
      .reduce((sum, claim) => sum + Number(claim.point_cost ?? 0), 0);
    return {
      rewardPoints,
      xpPoints: rewardPoints + spentRewardPoints,
      powerLevel: rewardPoints + spentRewardPoints,
    };
  }
  const xpPoints = Number(row?.power_level ?? 0);
  const rewardPoints = Number(row?.reward_points ?? row?.power_level ?? 0);
  return {
    rewardPoints,
    xpPoints,
    powerLevel: xpPoints,
  };
}

class LocalRepository implements Repository {
  private readonly store = getLocalStore();

  async getProfiles(): Promise<Profile[]> {
    return this.store.getProfiles();
  }

  async getMissions(profileId?: string): Promise<MissionWithState[]> {
    return this.store.getMissions(profileId);
  }

  async getTrashedMissions(): Promise<MissionWithState[]> {
    return this.store.getTrashedMissions();
  }

  async getSquadState(): Promise<SquadState> {
    return this.store.getSquadState();
  }

  async completeMission(input: MissionCompletionRequest): Promise<CompletionResult> {
    return this.store.completeMission(input);
  }

  async uncompleteMission(input: MissionUncompletionRequest): Promise<UncompletionResult> {
    return this.store.uncompleteMission(input);
  }

  async createMission(input: CreateMissionInput): Promise<Mission> {
    return this.store.createMission(input);
  }

  async updateMission(id: string, input: UpdateMissionInput): Promise<Mission> {
    return this.store.updateMission(id, input);
  }

  async deleteMission(id: string): Promise<void> {
    this.store.deleteMission(id);
  }

  async restoreMission(id: string): Promise<Mission> {
    return this.store.restoreMission(id);
  }

  async awardSquadPower(input: AwardSquadPowerInput): Promise<SquadState> {
    return this.store.awardSquadPower(input);
  }

  async getRewards(): Promise<Reward[]> {
    return this.store.getRewards();
  }

  async createReward(input: CreateRewardInput): Promise<Reward> {
    return this.store.createReward(input);
  }

  async updateReward(id: string, input: UpdateRewardInput): Promise<Reward> {
    return this.store.updateReward(id, input);
  }

  async deleteReward(id: string): Promise<void> {
    this.store.deleteReward(id);
  }

  async claimReward(input: ClaimRewardInput): Promise<ClaimRewardResult> {
    return this.store.claimReward(input);
  }

  async returnReward(input: ReturnRewardInput): Promise<ReturnRewardResult> {
    return this.store.returnReward(input);
  }

  async getRewardClaims(profileId: string): Promise<RewardClaimEntry[]> {
    return this.store.getRewardClaims(profileId);
  }

  async setSquadGoal(goal: SquadGoal | null): Promise<SquadState> {
    return this.store.setSquadGoal(goal);
  }

  async redeemSquadGoal(): Promise<SquadState> {
    return this.store.redeemSquadGoal();
  }

  async getMissionHistory(profileId: string, days: number): Promise<MissionHistoryEntry[]> {
    return this.store.getMissionHistory(profileId, days);
  }

  async createMissionBackfill(
    input: CreateMissionBackfillInput,
  ): Promise<CreateMissionBackfillResult> {
    return this.store.createMissionBackfill(input);
  }

  async getMissionBackfills(profileId: string): Promise<MissionBackfillEntry[]> {
    return this.store.getMissionBackfills(profileId);
  }

  async deleteMissionBackfill(id: string): Promise<DeleteMissionBackfillResult> {
    return this.store.deleteMissionBackfill(id);
  }

  async getNotifications(limit = 100): Promise<NotificationEvent[]> {
    return this.store.getNotifications(limit);
  }

  async markNotificationsRead(): Promise<MarkNotificationsReadResult> {
    return this.store.markNotificationsRead();
  }

  async getUnreadNotificationCount(): Promise<number> {
    return this.store.getUnreadNotificationCount();
  }

  async verifyParentPin(pin: string): Promise<boolean> {
    return this.store.verifyParentPin(pin);
  }

  async getParentDashboard(): Promise<ParentDashboardData> {
    return this.store.getParentDashboard();
  }

  async changeParentPin(newPin: string): Promise<void> {
    this.store.changeParentPin(newPin);
  }

  async resetDaily(cycleDate?: string): Promise<SquadState> {
    return this.store.resetDaily(cycleDate);
  }

  async createProfile(input: CreateProfileInput): Promise<Profile> {
    return this.store.createProfile(input);
  }

  async updateProfile(id: string, input: UpdateProfileInput): Promise<Profile> {
    return this.store.updateProfile(id, input);
  }

  async deleteProfile(id: string): Promise<void> {
    this.store.deleteProfile(id);
  }
}

class SupabaseRepository implements Repository {
  private async recomputeAndPersistStreak(
    profileId: string,
  ): Promise<{ currentStreak: number; lastStreakDate: string | null }> {
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error("Supabase is not configured");

    const { data, error } = await admin
      .from("mission_history")
      .select("completed_on_local_date")
      .eq("profile_id", profileId);
    if (error) throw new Error(error.message);

    const streak = recomputeStreakStateFromCompletionDates(
      ((data ?? []) as Array<{ completed_on_local_date?: string | null }>)
        .map((row) => row.completed_on_local_date)
        .filter((value): value is string => typeof value === "string" && value.length > 0),
    );

    const update = await admin
      .from("profiles")
      .update({
        current_streak: streak.currentStreak,
        last_streak_date: streak.lastStreakDate,
      })
      .eq("id", profileId);

    if (
      update.error &&
      (isMissingColumnError(update.error.message, "profiles.current_streak") ||
        isMissingColumnError(update.error.message, "profiles.last_streak_date"))
    ) {
      return streak;
    }

    if (update.error) {
      throw new Error(update.error.message);
    }

    return streak;
  }

  private async applyProfileMissionDelta(
    profileId: string,
    delta: number,
  ): Promise<{
    rewardPoints: number;
    xpPoints: number;
    powerLevel: number;
  }> {
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error("Supabase is not configured");

    const profilePoints = await fetchProfilePoints(admin, profileId);
    const nextRewardPoints = Math.max(0, profilePoints.rewardPoints + delta);
    const nextXpPoints = Math.max(0, profilePoints.xpPoints + delta);

    let updateResponse = await admin
      .from("profiles")
      .update({
        reward_points: nextRewardPoints,
        power_level: nextXpPoints,
      })
      .eq("id", profileId);
    if (
      updateResponse.error &&
      isMissingColumnError(updateResponse.error.message, "profiles.reward_points")
    ) {
      updateResponse = await admin
        .from("profiles")
        .update({
          power_level: nextXpPoints,
        })
        .eq("id", profileId);
    }
    if (updateResponse.error) {
      throw new Error(updateResponse.error.message);
    }

    return {
      rewardPoints: nextRewardPoints,
      xpPoints: nextXpPoints,
      powerLevel: nextXpPoints,
    };
  }

  async getProfiles(): Promise<Profile[]> {
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error("Supabase is not configured");

    let responseData: unknown[] | null = null;
    let responseError: { message: string } | null = null;

    const primaryResponse = await admin
      .from("profiles")
      .select(
        "id, hero_name, avatar_url, ui_mode, hero_card_object_position, reward_points, power_level",
      )
      .order("hero_name");
    responseData = primaryResponse.data;
    responseError = primaryResponse.error;

    if (
      responseError &&
      isMissingColumnError(responseError.message, "profiles.reward_points")
    ) {
      const fallbackResponse = await admin
        .from("profiles")
        .select("id, hero_name, avatar_url, ui_mode, hero_card_object_position, power_level")
        .order("hero_name");
      responseData = fallbackResponse.data;
      responseError = fallbackResponse.error;
    }

    if (responseError) throw new Error(responseError.message);
    const rows = (responseData ?? []) as ProfileRow[];
    if (rows.some((row) => row.reward_points === undefined)) {
      const { data: claimRows, error: claimError } = await admin
        .from("reward_claims")
        .select("profile_id, point_cost");
      if (claimError) {
        throw new Error(claimError.message);
      }
      const spentByProfileId = new Map<string, number>();
      for (const claim of (claimRows ?? []) as Array<{
        profile_id?: string | null;
        point_cost?: number | null;
      }>) {
        const profileId = typeof claim.profile_id === "string" ? claim.profile_id : null;
        if (!profileId) continue;
        spentByProfileId.set(
          profileId,
          (spentByProfileId.get(profileId) ?? 0) + Number(claim.point_cost ?? 0),
        );
      }

      return rows.map((row) => {
        const rewardPoints = Number(row.power_level ?? 0);
        const xpPoints = rewardPoints + (spentByProfileId.get(row.id) ?? 0);
        return {
          id: row.id,
          heroName: row.hero_name,
          avatarUrl: row.avatar_url,
          uiMode: row.ui_mode,
          heroCardObjectPosition: toHeroCardObjectPosition(
            row.hero_card_object_position,
          ),
          rewardPoints,
          xpPoints,
          powerLevel: xpPoints,
          currentStreak: Number(row.current_streak ?? 0),
          lastStreakDate: row.last_streak_date ?? null,
        };
      });
    }
    return rows.map(mapProfile);
  }

  async getSquadState(): Promise<SquadState> {
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error("Supabase is not configured");

    const { data, error } = await admin
      .from("squad_state")
      .select(
        "squad_power_current, squad_power_max, cycle_date, squad_goal_title, squad_goal_target_power, squad_goal_reward_description, goal_completion_count",
      )
      .eq("id", 1)
      .maybeSingle();

    if (error) throw new Error(error.message);

    if (!data) {
      const today = toLocalDateString(new Date(), env.appTimeZone);
      const { data: inserted, error: insertError } = await admin
        .from("squad_state")
        .insert({
          id: 1,
          squad_power_current: 0,
          squad_power_max: DEFAULT_SQUAD_POWER_MAX,
          cycle_date: today,
          squad_goal_title: null,
          squad_goal_target_power: null,
          squad_goal_reward_description: null,
        })
        .select(
          "squad_power_current, squad_power_max, cycle_date, squad_goal_title, squad_goal_target_power, squad_goal_reward_description, goal_completion_count",
        )
        .single();

      if (insertError) throw new Error(insertError.message);
      const insertedRow = inserted as SquadRow;

      return mapSquadRow(insertedRow);
    }
    const squadRow = data as SquadRow;
    if (normalizeSquadPowerMax(squadRow.squad_power_max) !== squadRow.squad_power_max) {
      const { data: updated, error: updateError } = await admin
        .from("squad_state")
        .update({ squad_power_max: DEFAULT_SQUAD_POWER_MAX })
        .eq("id", 1)
        .select(
          "squad_power_current, squad_power_max, cycle_date, squad_goal_title, squad_goal_target_power, squad_goal_reward_description",
        )
        .single();
      if (updateError) throw new Error(updateError.message);
      return mapSquadRow(updated as SquadRow);
    }
    return mapSquadRow(squadRow);
  }

  async getRewards(): Promise<Reward[]> {
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error("Supabase is not configured");

    let response: { data: unknown[] | null; error: { message: string } | null } = await admin
      .from("rewards")
      .select(
        "id, title, description, point_cost, target_days_to_earn, min_days_between_claims, is_active, sort_order",
      )
      .order("point_cost", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("title", { ascending: true });
    if (
      response.error &&
      isMissingColumnError(response.error.message, "rewards.target_days_to_earn")
    ) {
      response = await admin
        .from("rewards")
        .select("id, title, description, point_cost, is_active, sort_order")
        .order("point_cost", { ascending: true })
        .order("sort_order", { ascending: true })
        .order("title", { ascending: true });
    }

    if (response.error) throw new Error(response.error.message);
    return ((response.data ?? []) as RewardRow[]).map(mapReward).sort(compareRewardsByCost);
  }

  async createReward(input: CreateRewardInput): Promise<Reward> {
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error("Supabase is not configured");

    let response: { data: unknown | null; error: { message: string } | null } = await admin
      .from("rewards")
      .insert({
        title: input.title,
        description: input.description,
        point_cost: input.pointCost,
        target_days_to_earn: input.targetDaysToEarn ?? null,
        min_days_between_claims: input.minDaysBetweenClaims ?? null,
        is_active: input.isActive ?? true,
        sort_order: input.sortOrder ?? 1,
      })
      .select(
        "id, title, description, point_cost, target_days_to_earn, min_days_between_claims, is_active, sort_order",
      )
      .single();
    if (
      response.error &&
      (isMissingColumnError(response.error.message, "rewards.target_days_to_earn") ||
        isMissingColumnError(response.error.message, "rewards.min_days_between_claims"))
    ) {
      response = await admin
        .from("rewards")
        .insert({
          title: input.title,
          description: input.description,
          point_cost: input.pointCost,
          is_active: input.isActive ?? true,
          sort_order: input.sortOrder ?? 1,
        })
        .select("id, title, description, point_cost, is_active, sort_order")
        .single();
    }

    if (response.error) throw new Error(response.error.message);
    return mapReward(response.data as RewardRow);
  }

  async updateReward(id: string, input: UpdateRewardInput): Promise<Reward> {
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error("Supabase is not configured");

    const payload: Record<string, string | number | boolean | null> = {};
    if (input.title !== undefined) payload.title = input.title;
    if (input.description !== undefined) payload.description = input.description;
    if (input.pointCost !== undefined) payload.point_cost = input.pointCost;
    if (input.targetDaysToEarn !== undefined) {
      payload.target_days_to_earn = input.targetDaysToEarn;
    }
    if (input.minDaysBetweenClaims !== undefined) {
      payload.min_days_between_claims = input.minDaysBetweenClaims;
    }
    if (input.isActive !== undefined) payload.is_active = input.isActive;
    if (input.sortOrder !== undefined) payload.sort_order = input.sortOrder;

    let response: { data: unknown | null; error: { message: string } | null } = await admin
      .from("rewards")
      .update(payload)
      .eq("id", id)
      .select(
        "id, title, description, point_cost, target_days_to_earn, min_days_between_claims, is_active, sort_order",
      )
      .single();
    if (
      response.error &&
      (isMissingColumnError(response.error.message, "rewards.target_days_to_earn") ||
        isMissingColumnError(response.error.message, "rewards.min_days_between_claims"))
    ) {
      const fallbackPayload = { ...payload };
      delete fallbackPayload.target_days_to_earn;
      delete fallbackPayload.min_days_between_claims;
      if (Object.keys(fallbackPayload).length === 0) {
        response = await admin
          .from("rewards")
          .select("id, title, description, point_cost, is_active, sort_order")
          .eq("id", id)
          .single();
      } else {
        response = await admin
          .from("rewards")
          .update(fallbackPayload)
          .eq("id", id)
          .select("id, title, description, point_cost, is_active, sort_order")
          .single();
      }
    }

    if (response.error) throw new Error(response.error.message);
    return mapReward(response.data as RewardRow);
  }

  async deleteReward(id: string): Promise<void> {
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error("Supabase is not configured");

    const { error } = await admin.from("rewards").delete().eq("id", id);
    if (error) throw new Error(error.message);
  }

  async claimReward(input: ClaimRewardInput): Promise<ClaimRewardResult> {
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error("Supabase is not configured");

    const [profileResponse, initialRewardResponse, claimRowsResult] = await Promise.all([
      admin
        .from("profiles")
        .select("hero_name")
        .eq("id", input.profileId)
        .maybeSingle(),
      admin
        .from("rewards")
        .select(
          "id, title, description, point_cost, target_days_to_earn, min_days_between_claims, is_active, sort_order",
        )
        .eq("id", input.rewardId)
        .maybeSingle(),
      admin
        .from("reward_claims")
        .select("reward_id, claimed_at, sticker_concept_id")
        .eq("profile_id", input.profileId),
    ]);
    const profileRow = profileResponse.data;
    const rewardResponse: { data: unknown; error: { message: string } | null } = {
      data: initialRewardResponse.data,
      error: initialRewardResponse.error,
    };
    if (rewardResponse.error) {
      if (
        isMissingColumnError(rewardResponse.error.message, "rewards.target_days_to_earn") ||
        isMissingColumnError(rewardResponse.error.message, "rewards.min_days_between_claims")
      ) {
        const fallbackRewardResponse = await admin
          .from("rewards")
          .select("id, title, description, point_cost, is_active, sort_order")
          .eq("id", input.rewardId)
          .maybeSingle();
        if (fallbackRewardResponse.error) {
          throw new Error(fallbackRewardResponse.error.message);
        }
        rewardResponse.data = fallbackRewardResponse.data;
        rewardResponse.error = null;
      } else {
        throw new Error(rewardResponse.error.message);
      }
    }
    const reward = rewardResponse.data ? mapReward(rewardResponse.data as RewardRow) : null;
    if (!reward || !reward.isActive) {
      throw new Error("Reward unavailable");
    }
    const claimTime = input.claimedAt ? new Date(input.claimedAt) : new Date();
    if (Number.isNaN(claimTime.getTime())) {
      throw new Error("Invalid claim timestamp");
    }
    const claimedAt = claimTime.toISOString();

    let existingStickerConceptIds: string[] = [];
    const claimRowsError = claimRowsResult.error;
    let rewardClaims: Array<{
      reward_id?: string | null;
      claimed_at?: string | null;
      sticker_concept_id?: string | null;
    }> = [];
    if (claimRowsError) {
      if (!isMissingColumnError(claimRowsError.message, "reward_claims.sticker_concept_id")) {
        throw new Error(claimRowsError.message);
      }
      const fallbackClaims = await admin
        .from("reward_claims")
        .select("reward_id, claimed_at")
        .eq("profile_id", input.profileId);
      if (fallbackClaims.error) {
        throw new Error(fallbackClaims.error.message);
      }
      rewardClaims = (fallbackClaims.data ?? []) as Array<{
        reward_id?: string | null;
        claimed_at?: string | null;
      }>;
    } else {
      rewardClaims = (claimRowsResult.data ?? []) as Array<{
        reward_id?: string | null;
        claimed_at?: string | null;
        sticker_concept_id?: string | null;
      }>;
      existingStickerConceptIds = rewardClaims
        .map((row) => row.sticker_concept_id)
        .filter((value): value is string => typeof value === "string" && value.length > 0);
    }

    const cooldown = getRewardCooldownStatus({
      reward,
      claims: rewardClaims
        .filter((row) => row.reward_id === input.rewardId)
        .map((row) => ({
          rewardId: input.rewardId,
          claimedAt: row.claimed_at ?? "",
        }))
        .filter((row) => row.claimedAt.length > 0),
      asOf: claimTime,
      timeZone: env.appTimeZone,
    });
    if (cooldown.cooldownActive) {
      const profilePoints = await fetchProfilePoints(admin, input.profileId);
      return {
        claimed: false,
        insufficientPoints: false,
        alreadyClaimed: false,
        cooldownActive: true,
        nextClaimDate: cooldown.nextClaimDate,
        cooldownDaysRemaining: cooldown.cooldownDaysRemaining,
        newRewardPoints: profilePoints.rewardPoints,
        newXpPoints: profilePoints.xpPoints,
        newPowerLevel: profilePoints.powerLevel,
        reward,
      };
    }

    const art = await generateRewardClaimArt({
      rewardTitle: reward.title,
      rewardDescription: reward.description,
      heroName: (profileRow as { hero_name?: string } | null)?.hero_name ?? "Hero",
      claimedAt,
      existingStickerConceptIds,
    });

    if (input.claimedAt) {
      const profilePoints = await fetchProfilePoints(admin, input.profileId);
      if (profilePoints.rewardPoints < reward.pointCost) {
        return {
          claimed: false,
          insufficientPoints: true,
          alreadyClaimed: false,
          cooldownActive: false,
          nextClaimDate: cooldown.nextClaimDate,
          cooldownDaysRemaining: cooldown.cooldownDaysRemaining,
          newRewardPoints: profilePoints.rewardPoints,
          newXpPoints: profilePoints.xpPoints,
          newPowerLevel: profilePoints.powerLevel,
          reward,
        };
      }

      const nextRewardPoints = profilePoints.rewardPoints - reward.pointCost;
      const usesLegacyProfileSchema = profilePoints.rewardPoints === profilePoints.xpPoints;
      let profileUpdateResponse = await admin
        .from("profiles")
        .update({ reward_points: nextRewardPoints })
        .eq("id", input.profileId);
      if (
        profileUpdateResponse.error &&
        isMissingColumnError(profileUpdateResponse.error.message, "profiles.reward_points")
      ) {
        profileUpdateResponse = await admin
          .from("profiles")
          .update({ power_level: Math.max(0, profilePoints.powerLevel - reward.pointCost) })
          .eq("id", input.profileId);
      }
      if (profileUpdateResponse.error) {
        throw new Error(profileUpdateResponse.error.message);
      }

      const insertPayload = {
        profile_id: input.profileId,
        reward_id: input.rewardId,
        point_cost: reward.pointCost,
        claimed_at: claimedAt,
        image_url: art.imageUrl,
        sticker_type: art.stickerType ?? null,
        sticker_concept_id: art.stickerConceptId ?? null,
        sticker_prompt_seed: art.stickerPromptSeed ?? null,
      };
      let insertResponse = await admin.from("reward_claims").insert(insertPayload);
      if (insertResponse.error) {
        const message = insertResponse.error.message;
        if (
          isMissingColumnError(message, "reward_claims.sticker_type") ||
          isMissingColumnError(message, "reward_claims.sticker_concept_id") ||
          isMissingColumnError(message, "reward_claims.sticker_prompt_seed")
        ) {
          const fallbackPayload = {
            profile_id: input.profileId,
            reward_id: input.rewardId,
            point_cost: reward.pointCost,
            claimed_at: claimedAt,
            image_url: art.imageUrl,
          };
          insertResponse = await admin.from("reward_claims").insert(fallbackPayload);
        }
      }
      if (insertResponse.error) {
        throw new Error(insertResponse.error.message);
      }

      const notificationText = `${(profileRow as { hero_name?: string } | null)?.hero_name ?? "Hero"} claimed "${reward.title}" (-${reward.pointCost} reward points).`;
      await admin.from("notifications").insert({
        profile_id: input.profileId,
        event_type: "reward_claimed",
        title: "Reward Claimed",
        message: notificationText,
      });

      return {
        claimed: true,
        insufficientPoints: false,
        alreadyClaimed: false,
        cooldownActive: false,
        nextClaimDate: null,
        cooldownDaysRemaining: null,
        newRewardPoints: nextRewardPoints,
        newXpPoints: profilePoints.xpPoints,
        newPowerLevel: usesLegacyProfileSchema
          ? Math.max(0, profilePoints.powerLevel - reward.pointCost)
          : profilePoints.powerLevel,
        reward,
      };
    }

    let rpcResponse = await admin.rpc("claim_reward_v1", {
      p_profile_id: input.profileId,
      p_reward_id: input.rewardId,
      p_image_url: art.imageUrl,
      p_sticker_type: art.stickerType ?? null,
      p_sticker_concept_id: art.stickerConceptId ?? null,
      p_sticker_prompt_seed: art.stickerPromptSeed ?? null,
    });
    if (rpcResponse.error) {
      const message = rpcResponse.error.message;
      if (
        isMissingRpcArgError(message, "p_sticker_type") ||
        isMissingRpcArgError(message, "p_sticker_concept_id") ||
        isMissingRpcArgError(message, "p_sticker_prompt_seed")
      ) {
        rpcResponse = await admin.rpc("claim_reward_v1", {
          p_profile_id: input.profileId,
          p_reward_id: input.rewardId,
          p_image_url: art.imageUrl,
        });
      }
    }
    if (rpcResponse.error) throw new Error(rpcResponse.error.message);

    const result = (rpcResponse.data ?? {}) as {
      claimed?: boolean;
      insufficient_points?: boolean;
      cooldown_active?: boolean;
      next_claim_date?: string | null;
      cooldown_days_remaining?: number | null;
      new_reward_points?: number;
      new_xp_points?: number;
      new_power_level?: number;
      reward?: RewardRow;
    };

    if (!result.reward) {
      throw new Error("Reward unavailable");
    }

    const profilePoints = await fetchProfilePoints(admin, input.profileId);

    return {
      claimed: Boolean(result.claimed),
      insufficientPoints: Boolean(result.insufficient_points),
      alreadyClaimed: false,
      cooldownActive: Boolean(result.cooldown_active),
      nextClaimDate: result.next_claim_date ?? null,
      cooldownDaysRemaining:
        typeof result.cooldown_days_remaining === "number"
          ? result.cooldown_days_remaining
          : null,
      newRewardPoints: Number(result.new_reward_points ?? profilePoints.rewardPoints),
      newXpPoints: Number(result.new_xp_points ?? profilePoints.xpPoints),
      newPowerLevel: Number(result.new_power_level ?? profilePoints.powerLevel),
      reward: mapReward(result.reward),
    };
  }

  async returnReward(input: ReturnRewardInput): Promise<ReturnRewardResult> {
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error("Supabase is not configured");

    const { data: claimData, error: claimError } = await admin
      .from("reward_claims")
      .select("id, profile_id, reward_id, point_cost")
      .eq("id", input.rewardClaimId)
      .eq("profile_id", input.profileId)
      .maybeSingle();
    if (claimError) throw new Error(claimError.message);
    if (!claimData) {
      const profilePoints = await fetchProfilePoints(admin, input.profileId);

      return {
        returned: false,
        restoredPoints: 0,
        newRewardPoints: profilePoints.rewardPoints,
        newXpPoints: profilePoints.xpPoints,
        newPowerLevel: profilePoints.powerLevel,
      };
    }

    const restoredPoints = Number(
      (claimData as { point_cost?: number }).point_cost ?? 0,
    );

    const { data: profileData, error: profileError } = await admin
      .from("profiles")
      .select("reward_points, power_level")
      .eq("id", input.profileId)
      .maybeSingle();
    if (profileError) throw new Error(profileError.message);
    const currentRewardPoints = Number(
      (profileData as { reward_points?: number | null } | null)?.reward_points ??
        (profileData as { power_level?: number | null } | null)?.power_level ??
        0,
    );
    const nextRewardPoints = currentRewardPoints + restoredPoints;
    const currentXpPoints = Number(
      (profileData as { power_level?: number | null } | null)?.power_level ?? 0,
    );

    const { error: updateError } = await admin
      .from("profiles")
      .update({ reward_points: nextRewardPoints })
      .eq("id", input.profileId);
    if (updateError) throw new Error(updateError.message);

    const { error: deleteError } = await admin
      .from("reward_claims")
      .delete()
      .eq("id", input.rewardClaimId)
      .eq("profile_id", input.profileId);
    if (deleteError) throw new Error(deleteError.message);

    const [{ data: rewardRow }, { data: profileRow }] = await Promise.all([
      admin
        .from("rewards")
        .select("title")
        .eq("id", (claimData as { reward_id?: string }).reward_id ?? "")
        .maybeSingle(),
      admin
        .from("profiles")
        .select("hero_name")
        .eq("id", input.profileId)
        .maybeSingle(),
    ]);

    await admin.from("notifications").insert({
      profile_id: input.profileId,
      event_type: "reward_returned",
      title: "Reward Returned",
      message: `${(profileRow as { hero_name?: string } | null)?.hero_name ?? "Hero"} gave back "${(rewardRow as { title?: string } | null)?.title ?? "a reward"}" (+${restoredPoints} reward points).`,
    });

    return {
      returned: true,
      restoredPoints,
      newRewardPoints: nextRewardPoints,
      newXpPoints: currentXpPoints,
      newPowerLevel: currentXpPoints,
    };
  }

  async getRewardClaims(profileId: string): Promise<RewardClaimEntry[]> {
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error("Supabase is not configured");

    let claimsResponse: {
      data: unknown[] | null;
      error: { message: string } | null;
    } = await admin
      .from("reward_claims")
      .select(
        "id, profile_id, reward_id, point_cost, claimed_at, image_url, sticker_type, sticker_concept_id, sticker_prompt_seed",
      )
      .eq("profile_id", profileId)
      .order("claimed_at", { ascending: false });
    if (claimsResponse.error) {
      const message = claimsResponse.error.message;
      if (
        isMissingColumnError(message, "reward_claims.sticker_type") ||
        isMissingColumnError(message, "reward_claims.sticker_concept_id") ||
        isMissingColumnError(message, "reward_claims.sticker_prompt_seed")
      ) {
        claimsResponse = await admin
          .from("reward_claims")
          .select("id, profile_id, reward_id, point_cost, claimed_at, image_url")
          .eq("profile_id", profileId)
          .order("claimed_at", { ascending: false });
      }
    }
    if (claimsResponse.error) throw new Error(claimsResponse.error.message);

    const claimRows = (claimsResponse.data ?? []) as RewardClaimSupabaseRow[];
    if (claimRows.length === 0) return [];

    const rewardIds = Array.from(new Set(claimRows.map((row) => row.reward_id)));
    const { data: rewardData, error: rewardError } = await admin
      .from("rewards")
      .select("id, title, description")
      .in("id", rewardIds);
    if (rewardError) throw new Error(rewardError.message);

    const rewardById = new Map(
      ((rewardData ?? []) as Array<{ id: string; title: string; description: string }>).map(
        (row) => [row.id, row],
      ),
    );

    return claimRows.map((claim) => {
      const reward = rewardById.get(claim.reward_id);
      return {
        id: claim.id,
        rewardId: claim.reward_id,
        title: reward?.title ?? "Mystery Reward",
        description: reward?.description ?? "Reward claimed",
        pointCost: claim.point_cost,
        claimedAt: claim.claimed_at,
        imageUrl: claim.image_url,
        stickerType: claim.sticker_type ?? undefined,
        stickerConceptId: claim.sticker_concept_id,
        stickerPromptSeed: claim.sticker_prompt_seed,
      };
    });
  }

  async setSquadGoal(goal: SquadGoal | null): Promise<SquadState> {
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error("Supabase is not configured");

    const payload = goal
      ? {
          squad_goal_title: goal.title,
          squad_goal_target_power: goal.targetPower,
          squad_goal_reward_description: goal.rewardDescription,
        }
      : {
          squad_goal_title: null,
          squad_goal_target_power: null,
          squad_goal_reward_description: null,
        };

    const { data, error } = await admin
      .from("squad_state")
      .update(payload)
      .eq("id", 1)
      .select(
        "squad_power_current, squad_power_max, cycle_date, squad_goal_title, squad_goal_target_power, squad_goal_reward_description, goal_completion_count",
      )
      .single();
    if (error) throw new Error(error.message);

    return mapSquadRow(data as SquadRow);
  }

  async redeemSquadGoal(): Promise<SquadState> {
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error("Supabase is not configured");

    const current = await this.getSquadState();
    const nextCount = current.goalCompletionCount + 1;

    const { data, error } = await admin
      .from("squad_state")
      .update({ squad_power_current: 0, goal_completion_count: nextCount })
      .eq("id", 1)
      .select(
        "squad_power_current, squad_power_max, cycle_date, squad_goal_title, squad_goal_target_power, squad_goal_reward_description, goal_completion_count",
      )
      .single();

    if (error) throw new Error(error.message);
    return mapSquadRow(data as SquadRow);
  }

  async getMissionHistory(
    profileId: string,
    days: number,
  ): Promise<MissionHistoryEntry[]> {
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error("Supabase is not configured");

    const squad = await this.getSquadState();
    const start = new Date(`${squad.cycleDate}T00:00:00.000Z`);
    start.setUTCDate(start.getUTCDate() - Math.max(0, days - 1));
    const minDate = start.toISOString().slice(0, 10);

    const { data, error } = await admin
      .from("mission_history")
      .select("completed_on_local_date, points_awarded, mission_id")
      .eq("profile_id", profileId)
      .gte("completed_on_local_date", minDate)
      .order("completed_on_local_date", { ascending: false });
    if (error) throw new Error(error.message);

    const rows = (data ??
      []) as Array<{
      completed_on_local_date: string;
      points_awarded: number;
      mission_id: string;
    }>;
    if (rows.length === 0) {
      return [];
    }

    const missionIds = Array.from(new Set(rows.map((row) => row.mission_id)));
    const { data: missionRows, error: missionError } = await admin
      .from("missions")
      .select("id, title")
      .in("id", missionIds);
    if (missionError) throw new Error(missionError.message);
    const titleById = new Map(
      ((missionRows ?? []) as Array<{ id: string; title: string }>).map((row) => [
        row.id,
        row.title,
      ]),
    );

    const grouped = new Map<string, Array<{ title: string; powerAwarded: number }>>();
    for (const row of rows) {
      const list = grouped.get(row.completed_on_local_date) ?? [];
      list.push({
        title: titleById.get(row.mission_id) ?? "Mission",
        powerAwarded: row.points_awarded,
      });
      grouped.set(row.completed_on_local_date, list);
    }

    return Array.from(grouped.entries()).map(([date, missions]) => ({ date, missions }));
  }

  async createMissionBackfill(
    input: CreateMissionBackfillInput,
  ): Promise<CreateMissionBackfillResult> {
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error("Supabase is not configured");

    if (!isValidLocalDateString(input.localDate)) {
      throw new Error("Invalid localDate");
    }

    const squad = await this.getSquadState();
    if (input.localDate >= squad.cycleDate) {
      throw new Error("Backfill date must be before today");
    }

    const { data: missionData, error: missionError } = await admin
      .from("missions")
      .select("id, title, power_value, profile_id, is_active, deleted_at")
      .eq("id", input.missionId)
      .eq("profile_id", input.profileId)
      .eq("is_active", true)
      .is("deleted_at", null)
      .maybeSingle();
    if (missionError) throw new Error(missionError.message);
    if (!missionData) {
      throw new Error("Mission not found or inactive");
    }
    const mission = missionData as {
      id: string;
      title: string;
      power_value: number;
      profile_id: string;
    };

    const { data: duplicate, error: duplicateError } = await admin
      .from("mission_history")
      .select("id")
      .eq("mission_id", input.missionId)
      .eq("completed_on_local_date", input.localDate)
      .limit(1)
      .maybeSingle();
    if (duplicateError) throw new Error(duplicateError.message);
    if (duplicate) {
      throw new Error("Backfill already exists for this mission and date");
    }

    const completedAt = new Date().toISOString();
    const clientRequestId = buildMissionBackfillClientRequestId({
      profileId: input.profileId,
      missionId: input.missionId,
      localDate: input.localDate,
    });
    const insertResponse = await admin
      .from("mission_history")
      .insert({
        mission_id: input.missionId,
        profile_id: input.profileId,
        completed_at: completedAt,
        completed_on_local_date: input.localDate,
        client_request_id: clientRequestId,
        points_awarded: mission.power_value,
      })
      .select("id, created_at")
      .single();

    if (insertResponse.error) {
      if (insertResponse.error.message.toLowerCase().includes("duplicate")) {
        throw new Error("Backfill already exists for this mission and date");
      }
      throw new Error(insertResponse.error.message);
    }

    const profilePoints = await this.applyProfileMissionDelta(
      input.profileId,
      mission.power_value,
    );
    const nextSquadPowerCurrent = clamp(
      squad.squadPowerCurrent + mission.power_value,
      0,
      squad.squadPowerMax,
    );

    const squadUpdate = await admin
      .from("squad_state")
      .update({ squad_power_current: nextSquadPowerCurrent })
      .eq("id", 1);
    if (squadUpdate.error) throw new Error(squadUpdate.error.message);

    await this.recomputeAndPersistStreak(input.profileId);

    return {
      entry: {
        id: (insertResponse.data as { id: string }).id,
        profileId: input.profileId,
        missionId: mission.id,
        missionTitle: mission.title,
        localDate: input.localDate,
        pointsAwarded: mission.power_value,
        createdAt:
          (insertResponse.data as { created_at?: string | null }).created_at ??
          completedAt,
      },
      profileRewardPoints: profilePoints.rewardPoints,
      profileXpPoints: profilePoints.xpPoints,
      profilePowerLevel: profilePoints.powerLevel,
      squadPowerCurrent: nextSquadPowerCurrent,
      squadPowerMax: squad.squadPowerMax,
    };
  }

  async getMissionBackfills(profileId: string): Promise<MissionBackfillEntry[]> {
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error("Supabase is not configured");

    const { data, error } = await admin
      .from("mission_history")
      .select(
        "id, profile_id, mission_id, completed_on_local_date, points_awarded, completed_at, created_at, client_request_id",
      )
      .eq("profile_id", profileId)
      .like("client_request_id", "parent-backfill:%")
      .order("completed_on_local_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    const rows = (data ??
      []) as Array<{
      id: string;
      profile_id: string;
      mission_id: string;
      completed_on_local_date: string;
      points_awarded: number;
      completed_at: string;
      created_at?: string | null;
      client_request_id: string;
    }>;

    const backfills = rows.filter((row) =>
      isMissionBackfillClientRequestId(row.client_request_id),
    );
    if (backfills.length === 0) {
      return [];
    }

    const missionIds = Array.from(new Set(backfills.map((row) => row.mission_id)));
    const { data: missionRows, error: missionError } = await admin
      .from("missions")
      .select("id, title")
      .in("id", missionIds);
    if (missionError) throw new Error(missionError.message);
    const titleById = new Map(
      ((missionRows ?? []) as Array<{ id: string; title: string }>).map((row) => [
        row.id,
        row.title,
      ]),
    );

    return backfills.map((row) => ({
      id: row.id,
      profileId: row.profile_id,
      missionId: row.mission_id,
      missionTitle: titleById.get(row.mission_id) ?? "Mission",
      localDate: row.completed_on_local_date,
      pointsAwarded: Number(row.points_awarded ?? 0),
      createdAt: row.created_at ?? row.completed_at,
    }));
  }

  async deleteMissionBackfill(id: string): Promise<DeleteMissionBackfillResult> {
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error("Supabase is not configured");

    const { data: backfillData, error: backfillError } = await admin
      .from("mission_history")
      .select(
        "id, profile_id, mission_id, points_awarded, client_request_id, completed_on_local_date",
      )
      .eq("id", id)
      .maybeSingle();
    if (backfillError) throw new Error(backfillError.message);
    if (!backfillData) {
      throw new Error("Backfill entry not found");
    }

    const backfill = backfillData as {
      id: string;
      profile_id: string;
      mission_id: string;
      points_awarded: number;
      client_request_id: string;
      completed_on_local_date: string;
    };

    if (!isMissionBackfillClientRequestId(backfill.client_request_id)) {
      throw new Error("Only parent backfills can be removed");
    }

    const points = Number(backfill.points_awarded ?? 0);
    const squad = await this.getSquadState();

    const deleteResponse = await admin
      .from("mission_history")
      .delete()
      .eq("id", id)
      .eq("profile_id", backfill.profile_id);
    if (deleteResponse.error) throw new Error(deleteResponse.error.message);

    const profilePoints = await this.applyProfileMissionDelta(backfill.profile_id, -points);
    const nextSquadPowerCurrent = clamp(
      squad.squadPowerCurrent - points,
      0,
      squad.squadPowerMax,
    );
    const squadUpdate = await admin
      .from("squad_state")
      .update({ squad_power_current: nextSquadPowerCurrent })
      .eq("id", 1);
    if (squadUpdate.error) throw new Error(squadUpdate.error.message);

    await this.recomputeAndPersistStreak(backfill.profile_id);

    return {
      removed: true,
      profileRewardPoints: profilePoints.rewardPoints,
      profileXpPoints: profilePoints.xpPoints,
      profilePowerLevel: profilePoints.powerLevel,
      squadPowerCurrent: nextSquadPowerCurrent,
      squadPowerMax: squad.squadPowerMax,
    };
  }

  async getNotifications(limit = 100): Promise<NotificationEvent[]> {
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error("Supabase is not configured");

    const { data, error } = await admin
      .from("notifications")
      .select("id, profile_id, event_type, title, message, created_at, read_at")
      .order("created_at", { ascending: false })
      .limit(Math.max(1, Math.min(500, limit)));

    if (error) throw new Error(error.message);
    return ((data ?? []) as NotificationRow[]).map(mapNotification);
  }

  async markNotificationsRead(): Promise<MarkNotificationsReadResult> {
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error("Supabase is not configured");

    const { data: unreadRows, error: readError } = await admin
      .from("notifications")
      .select("id")
      .is("read_at", null);
    if (readError) throw new Error(readError.message);

    const ids = ((unreadRows ?? []) as Array<{ id: string }>).map((row) => row.id);
    if (ids.length === 0) {
      return { markedCount: 0 };
    }

    const { error } = await admin
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .in("id", ids);
    if (error) throw new Error(error.message);

    return { markedCount: ids.length };
  }

  async getUnreadNotificationCount(): Promise<number> {
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error("Supabase is not configured");

    const { count, error } = await admin
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .is("read_at", null);
    if (error) throw new Error(error.message);
    return Number(count ?? 0);
  }

  async getMissions(profileId?: string): Promise<MissionWithState[]> {
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error("Supabase is not configured");

    const squad = await this.getSquadState();

    let query = admin
      .from("missions")
      .select(
        "id, profile_id, title, instructions, image_url, power_value, is_active, recurring_daily, sort_order, deleted_at",
      )
      .is("deleted_at", null)
      .order("sort_order");

    if (profileId) {
      query = query.eq("profile_id", profileId).eq("is_active", true);
    }

    const { data: missionRowsRaw, error: missionError } = await query;
    if (missionError) throw new Error(missionError.message);
    const missionRows = (missionRowsRaw ?? []) as MissionRow[];

    const missionIds = missionRows.map((row) => row.id);
    if (missionIds.length === 0) return [];

    const { data: completedRows, error: completedError } = await admin
      .from("mission_history")
      .select("mission_id, completed_on_local_date")
      .in("mission_id", missionIds)
      .order("completed_on_local_date", { ascending: false });

    if (completedError) throw new Error(completedError.message);

    const completedTodaySet = new Set(
      (
        (completedRows ?? []) as Array<{
          mission_id: string;
          completed_on_local_date: string;
        }>
      )
        .filter((row) => row.completed_on_local_date === squad.cycleDate)
        .map((row) => row.mission_id),
    );
    const completedEverSet = new Set(
      (
        (completedRows ?? []) as Array<{
          mission_id: string;
          completed_on_local_date: string;
        }>
      ).map((row) => row.mission_id),
    );

    return missionRows.map((row) => ({
      ...mapMission(row),
      completedToday: row.recurring_daily
        ? completedTodaySet.has(row.id)
        : completedEverSet.has(row.id),
    }));
  }

  async getTrashedMissions(): Promise<MissionWithState[]> {
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error("Supabase is not configured");

    const { data, error } = await admin
      .from("missions")
      .select(
        "id, profile_id, title, instructions, image_url, power_value, is_active, recurring_daily, sort_order, deleted_at",
      )
      .not("deleted_at", "is", null)
      .order("sort_order");

    if (error) throw new Error(error.message);
    const rows = (data ?? []) as MissionRow[];
    return rows.map((row) => ({
      ...mapMission(row),
      completedToday: false,
    }));
  }

  async completeMission(input: MissionCompletionRequest): Promise<CompletionResult> {
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error("Supabase is not configured");

    const { data, error } = await admin.rpc("complete_mission_v1", {
      p_mission_id: input.missionId,
      p_profile_id: input.profileId,
      p_client_request_id: input.clientRequestId,
      p_completed_at: input.clientCompletedAt,
    });

    if (error) throw new Error(error.message);
    const result = (data ?? {}) as {
      awarded?: boolean;
      already_completed?: boolean;
      profile_power_level?: number;
      squad_power_current?: number;
      squad_power_max?: number;
    };
    const profilePoints = await fetchProfilePoints(admin, input.profileId);

    const payload: CompletionResult = {
      awarded: Boolean(result.awarded),
      alreadyCompleted: Boolean(result.already_completed),
      profileRewardPoints: profilePoints.rewardPoints,
      profileXpPoints: profilePoints.xpPoints,
      profilePowerLevel: Number(result.profile_power_level ?? profilePoints.powerLevel),
      squadPowerCurrent: Number(result.squad_power_current ?? 0),
      squadPowerMax: normalizeSquadPowerMax(result.squad_power_max),
    };

    if (payload.awarded) {
      const [{ data: missionRow }, { data: profileRow }] = await Promise.all([
        admin
          .from("missions")
          .select("title, power_value")
          .eq("id", input.missionId)
          .maybeSingle(),
        admin
          .from("profiles")
          .select("hero_name")
          .eq("id", input.profileId)
          .maybeSingle(),
      ]);

      const mission = missionRow as { title?: string; power_value?: number } | null;
      const profile = profileRow as { hero_name?: string } | null;
      await admin.from("notifications").insert({
        profile_id: input.profileId,
        event_type: "mission_complete",
        title: "Mission Complete",
        message: `${profile?.hero_name ?? "Hero"} finished "${mission?.title ?? "a mission"}" (+${Number(
          mission?.power_value ?? 0,
        )} power).`,
      });
    }

    return payload;
  }

  async uncompleteMission(
    input: MissionUncompletionRequest,
  ): Promise<UncompletionResult> {
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error("Supabase is not configured");

    const { data: missionData, error: missionError } = await admin
      .from("missions")
      .select("id, power_value, recurring_daily")
      .eq("id", input.missionId)
      .eq("profile_id", input.profileId)
      .maybeSingle();
    if (missionError) throw new Error(missionError.message);
    if (!missionData) {
      throw new Error("Mission not found");
    }

    const missionRow = missionData as {
      id: string;
      power_value: number;
      recurring_daily: boolean;
    };

    const squad = await this.getSquadState();
    let historyQuery = admin
      .from("mission_history")
      .select("id")
      .eq("mission_id", input.missionId)
      .eq("profile_id", input.profileId);
    if (missionRow.recurring_daily) {
      historyQuery = historyQuery.eq("completed_on_local_date", squad.cycleDate);
    }
    const { data: completionData, error: completionError } = await historyQuery
      .limit(1)
      .maybeSingle();
    if (completionError) throw new Error(completionError.message);
    if (!completionData) {
      const profilePoints = await fetchProfilePoints(admin, input.profileId);
      return {
        undone: false,
        wasCompleted: false,
        insufficientUnspentPoints: false,
        profileRewardPoints: profilePoints.rewardPoints,
        profileXpPoints: profilePoints.xpPoints,
        profilePowerLevel: profilePoints.powerLevel,
        squadPowerCurrent: squad.squadPowerCurrent,
        squadPowerMax: squad.squadPowerMax,
      };
    }

    const profilePoints = await fetchProfilePoints(admin, input.profileId);
    const undoPolicy = evaluateUndoEligibility({
      force: input.force,
      profileRewardPoints: profilePoints.rewardPoints,
      pointsAwarded: missionRow.power_value,
    });
    if (!undoPolicy.allowed) {
      return {
        undone: false,
        wasCompleted: true,
        insufficientUnspentPoints: undoPolicy.insufficientUnspentPoints,
        pointsRequiredToUndo: undoPolicy.pointsRequiredToUndo,
        profileRewardPoints: profilePoints.rewardPoints,
        profileXpPoints: profilePoints.xpPoints,
        profilePowerLevel: profilePoints.powerLevel,
        squadPowerCurrent: squad.squadPowerCurrent,
        squadPowerMax: squad.squadPowerMax,
      };
    }

    const { data, error } = await admin.rpc("uncomplete_mission_v1", {
      p_mission_id: input.missionId,
      p_profile_id: input.profileId,
    });

    if (error) throw new Error(error.message);
    const result = (data ?? {}) as {
      undone?: boolean;
      was_completed?: boolean;
      profile_power_level?: number;
      squad_power_current?: number;
      squad_power_max?: number;
    };
    const nextProfilePoints = await fetchProfilePoints(admin, input.profileId);

    return {
      undone: Boolean(result.undone),
      wasCompleted: Boolean(result.was_completed),
      insufficientUnspentPoints: false,
      profileRewardPoints: nextProfilePoints.rewardPoints,
      profileXpPoints: nextProfilePoints.xpPoints,
      profilePowerLevel: Number(
        result.profile_power_level ?? nextProfilePoints.powerLevel,
      ),
      squadPowerCurrent: Number(result.squad_power_current ?? 0),
      squadPowerMax: normalizeSquadPowerMax(result.squad_power_max),
    };
  }

  async createMission(input: CreateMissionInput): Promise<Mission> {
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error("Supabase is not configured");

    const { data, error } = await admin
      .from("missions")
      .insert({
        profile_id: input.profileId,
        title: input.title,
        instructions: input.instructions,
        image_url: input.imageUrl ?? null,
        power_value: input.powerValue,
        is_active: input.isActive ?? true,
        recurring_daily: input.recurringDaily ?? true,
        sort_order: input.sortOrder ?? 1,
        deleted_at: null,
      })
      .select(
        "id, profile_id, title, instructions, image_url, power_value, is_active, recurring_daily, sort_order, deleted_at",
      )
      .single();

    if (error) throw new Error(error.message);
    return mapMission(data as MissionRow);
  }

  async updateMission(id: string, input: UpdateMissionInput): Promise<Mission> {
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error("Supabase is not configured");

    const payload: Record<string, string | number | boolean | null> = {};
    if (input.title !== undefined) payload.title = input.title;
    if (input.instructions !== undefined) payload.instructions = input.instructions;
    if (input.imageUrl !== undefined) payload.image_url = input.imageUrl;
    if (input.powerValue !== undefined) payload.power_value = input.powerValue;
    if (input.isActive !== undefined) payload.is_active = input.isActive;
    if (input.recurringDaily !== undefined) {
      payload.recurring_daily = input.recurringDaily;
    }
    if (input.sortOrder !== undefined) payload.sort_order = input.sortOrder;

    const { data, error } = await admin
      .from("missions")
      .update(payload)
      .eq("id", id)
      .select(
        "id, profile_id, title, instructions, image_url, power_value, is_active, recurring_daily, sort_order, deleted_at",
      )
      .single();

    if (error) throw new Error(error.message);
    return mapMission(data as MissionRow);
  }

  async deleteMission(id: string): Promise<void> {
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error("Supabase is not configured");

    const { data, error } = await admin
      .from("missions")
      .update({
        deleted_at: new Date().toISOString(),
        is_active: false,
      })
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) throw new Error("Mission not found");

    const { error: historyError } = await admin
      .from("mission_history")
      .delete()
      .eq("mission_id", id);
    if (historyError) throw new Error(historyError.message);
  }

  async restoreMission(id: string): Promise<Mission> {
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error("Supabase is not configured");

    const { data, error } = await admin
      .from("missions")
      .update({
        deleted_at: null,
        is_active: true,
      })
      .eq("id", id)
      .select(
        "id, profile_id, title, instructions, image_url, power_value, is_active, recurring_daily, sort_order, deleted_at",
      )
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) throw new Error("Mission not found");
    return mapMission(data as MissionRow);
  }

  async awardSquadPower(input: AwardSquadPowerInput): Promise<SquadState> {
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error("Supabase is not configured");

    const squad = await this.getSquadState();
    const nextValue = Math.min(
      squad.squadPowerMax,
      Math.max(0, squad.squadPowerCurrent + input.delta),
    );

    const { error: eventError } = await admin.from("squad_events").insert({
      source_type: "manual",
      delta: input.delta,
      note: input.note ?? null,
    });

    if (eventError) throw new Error(eventError.message);

    const { data, error } = await admin
      .from("squad_state")
      .update({ squad_power_current: nextValue })
      .eq("id", 1)
      .select(
        "squad_power_current, squad_power_max, cycle_date, squad_goal_title, squad_goal_target_power, squad_goal_reward_description, goal_completion_count",
      )
      .single();

    if (error) throw new Error(error.message);

    const squadRow = data as SquadRow;

    return mapSquadRow(squadRow);
  }

  async verifyParentPin(pin: string): Promise<boolean> {
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error("Supabase is not configured");

    const { data } = await admin
      .from("parent_settings")
      .select("pin_hash")
      .eq("id", 1)
      .maybeSingle();

    const expectedHash =
      (data as { pin_hash?: string } | null)?.pin_hash ||
      env.parentPinHash ||
      hashPin(env.parentPinPlain);

    return verifyPin(pin, expectedHash);
  }

  async getParentDashboard(): Promise<ParentDashboardData> {
    const [profiles, missions, trashedMissions, squad, rewards] = await Promise.all([
      this.getProfiles(),
      this.getMissions(),
      this.getTrashedMissions(),
      this.getSquadState(),
      this.getRewards(),
    ]);

    return { profiles, missions, trashedMissions, squad, rewards };
  }

  async changeParentPin(newPin: string): Promise<void> {
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error("Supabase is not configured");

    const pinHash = hashPin(newPin);

    const { error } = await admin
      .from("parent_settings")
      .upsert({ id: 1, pin_hash: pinHash });

    if (error) throw new Error(error.message);
  }

  async resetDaily(cycleDate = toLocalDateString(new Date(), env.appTimeZone)): Promise<SquadState> {
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error("Supabase is not configured");

    const { error } = await admin.rpc("daily_reset_v1", {
      p_cycle_date: cycleDate,
    });

    if (error) throw new Error(error.message);

    return this.getSquadState();
  }

  async createProfile(input: CreateProfileInput): Promise<Profile> {
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error("Supabase is not configured");

    let response = await admin
      .from("profiles")
      .insert({
        hero_name: input.heroName,
        avatar_url: input.avatarUrl,
        ui_mode: input.uiMode,
        hero_card_object_position: toHeroCardObjectPosition(input.heroCardObjectPosition),
        reward_points: 0,
        power_level: 0,
      })
      .select(
        "id, hero_name, avatar_url, ui_mode, hero_card_object_position, reward_points, power_level",
      )
      .single();
    if (
      response.error &&
      isMissingColumnError(response.error.message, "profiles.reward_points")
    ) {
      response = await admin
        .from("profiles")
        .insert({
          hero_name: input.heroName,
          avatar_url: input.avatarUrl,
          ui_mode: input.uiMode,
          hero_card_object_position: toHeroCardObjectPosition(input.heroCardObjectPosition),
          power_level: 0,
        })
        .select("id, hero_name, avatar_url, ui_mode, hero_card_object_position, power_level")
        .single();
    }

    if (response.error) throw new Error(response.error.message);
    return mapProfile(response.data as ProfileRow);
  }

  async updateProfile(id: string, input: UpdateProfileInput): Promise<Profile> {
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error("Supabase is not configured");

    const payload: Record<string, string> = {};
    if (input.heroName !== undefined) payload.hero_name = input.heroName;
    if (input.avatarUrl !== undefined) payload.avatar_url = input.avatarUrl;
    if (input.uiMode !== undefined) payload.ui_mode = input.uiMode;
    if (input.heroCardObjectPosition !== undefined) {
      payload.hero_card_object_position = toHeroCardObjectPosition(input.heroCardObjectPosition);
    }

    let response = await admin
      .from("profiles")
      .update(payload)
      .eq("id", id)
      .select(
        "id, hero_name, avatar_url, ui_mode, hero_card_object_position, reward_points, power_level",
      )
      .single();
    if (
      response.error &&
      isMissingColumnError(response.error.message, "profiles.reward_points")
    ) {
      response = await admin
        .from("profiles")
        .update(payload)
        .eq("id", id)
        .select("id, hero_name, avatar_url, ui_mode, hero_card_object_position, power_level")
        .single();
    }

    if (response.error) throw new Error(response.error.message);
    return mapProfile(response.data as ProfileRow);
  }

  async deleteProfile(id: string): Promise<void> {
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error("Supabase is not configured");

    const { error } = await admin.from("profiles").delete().eq("id", id);
    if (error) throw new Error(error.message);
  }
}

let repository: Repository | null = null;

export function getRepository(): Repository {
  if (repository) {
    return repository;
  }

  repository = hasSupabaseAdmin ? new SupabaseRepository() : new LocalRepository();
  return repository;
}

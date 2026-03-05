import { toLocalDateString } from "@/lib/date";
import { env, hasSupabaseAdmin } from "@/lib/env";
import { getLocalStore } from "@/lib/server/local-store";
import { hashPin, verifyPin } from "@/lib/server/pin";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
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
  getMissionHistory(profileId: string, days: number): Promise<MissionHistoryEntry[]>;
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
  power_level: number;
  current_streak?: number | null;
  last_streak_date?: string | null;
}): Profile {
  return {
    id: row.id,
    heroName: row.hero_name,
    avatarUrl: row.avatar_url,
    uiMode: row.ui_mode,
    powerLevel: row.power_level,
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
};

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

  async getMissionHistory(profileId: string, days: number): Promise<MissionHistoryEntry[]> {
    return this.store.getMissionHistory(profileId, days);
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
  async getProfiles(): Promise<Profile[]> {
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error("Supabase is not configured");

    const { data, error } = await admin
      .from("profiles")
      .select("id, hero_name, avatar_url, ui_mode, power_level")
      .order("hero_name");

    if (error) throw new Error(error.message);
    const rows = (data ?? []) as ProfileRow[];
    return rows.map(mapProfile);
  }

  async getSquadState(): Promise<SquadState> {
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error("Supabase is not configured");

    const { data, error } = await admin
      .from("squad_state")
      .select("squad_power_current, squad_power_max, cycle_date")
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
          squad_power_max: 100,
          cycle_date: today,
        })
        .select("squad_power_current, squad_power_max, cycle_date")
        .single();

      if (insertError) throw new Error(insertError.message);
      const insertedRow = inserted as SquadRow;

      return {
        squadPowerCurrent: insertedRow.squad_power_current,
        squadPowerMax: insertedRow.squad_power_max,
        cycleDate: insertedRow.cycle_date,
        squadGoal: null,
      };
    }
    const squadRow = data as SquadRow;

    return {
      squadPowerCurrent: squadRow.squad_power_current,
      squadPowerMax: squadRow.squad_power_max,
      cycleDate: squadRow.cycle_date,
      squadGoal: null,
    };
  }

  async getRewards(): Promise<Reward[]> {
    throw new Error("Not implemented — requires Supabase migration");
  }

  async createReward(input: CreateRewardInput): Promise<Reward> {
    void input;
    throw new Error("Not implemented — requires Supabase migration");
  }

  async updateReward(id: string, input: UpdateRewardInput): Promise<Reward> {
    void id;
    void input;
    throw new Error("Not implemented — requires Supabase migration");
  }

  async deleteReward(id: string): Promise<void> {
    void id;
    throw new Error("Not implemented — requires Supabase migration");
  }

  async claimReward(input: ClaimRewardInput): Promise<ClaimRewardResult> {
    void input;
    throw new Error("Not implemented — requires Supabase migration");
  }

  async returnReward(input: ReturnRewardInput): Promise<ReturnRewardResult> {
    void input;
    throw new Error("Not implemented — requires Supabase migration");
  }

  async getRewardClaims(profileId: string): Promise<RewardClaimEntry[]> {
    void profileId;
    throw new Error("Not implemented — requires Supabase migration");
  }

  async setSquadGoal(goal: SquadGoal | null): Promise<SquadState> {
    void goal;
    throw new Error("Not implemented — requires Supabase migration");
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

    return {
      awarded: Boolean(result.awarded),
      alreadyCompleted: Boolean(result.already_completed),
      profilePowerLevel: Number(result.profile_power_level ?? 0),
      squadPowerCurrent: Number(result.squad_power_current ?? 0),
      squadPowerMax: Number(result.squad_power_max ?? 100),
    };
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
      const { data: profileData } = await admin
        .from("profiles")
        .select("power_level")
        .eq("id", input.profileId)
        .maybeSingle();
      return {
        undone: false,
        wasCompleted: false,
        insufficientUnspentPoints: false,
        profilePowerLevel: Number(
          (profileData as { power_level?: number } | null)?.power_level ?? 0,
        ),
        squadPowerCurrent: squad.squadPowerCurrent,
        squadPowerMax: squad.squadPowerMax,
      };
    }

    if (!input.force) {
      const { data: profileData, error: profileError } = await admin
        .from("profiles")
        .select("power_level")
        .eq("id", input.profileId)
        .maybeSingle();
      if (profileError) throw new Error(profileError.message);
      const powerLevel = Number(
        (profileData as { power_level?: number } | null)?.power_level ?? 0,
      );
      if (powerLevel < missionRow.power_value) {
        return {
          undone: false,
          wasCompleted: true,
          insufficientUnspentPoints: true,
          pointsRequiredToUndo: missionRow.power_value,
          profilePowerLevel: powerLevel,
          squadPowerCurrent: squad.squadPowerCurrent,
          squadPowerMax: squad.squadPowerMax,
        };
      }
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

    return {
      undone: Boolean(result.undone),
      wasCompleted: Boolean(result.was_completed),
      insufficientUnspentPoints: false,
      profilePowerLevel: Number(result.profile_power_level ?? 0),
      squadPowerCurrent: Number(result.squad_power_current ?? 0),
      squadPowerMax: Number(result.squad_power_max ?? 100),
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
      .select("squad_power_current, squad_power_max, cycle_date")
      .single();

    if (error) throw new Error(error.message);

    const squadRow = data as SquadRow;

    return {
      squadPowerCurrent: squadRow.squad_power_current,
      squadPowerMax: squadRow.squad_power_max,
      cycleDate: squadRow.cycle_date,
      squadGoal: null,
    };
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
    const [profiles, missions, trashedMissions, squad] = await Promise.all([
      this.getProfiles(),
      this.getMissions(),
      this.getTrashedMissions(),
      this.getSquadState(),
    ]);

    return { profiles, missions, trashedMissions, squad, rewards: [] };
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

    const { data, error } = await admin
      .from("profiles")
      .insert({
        hero_name: input.heroName,
        avatar_url: input.avatarUrl,
        ui_mode: input.uiMode,
        power_level: 0,
      })
      .select("id, hero_name, avatar_url, ui_mode, power_level")
      .single();

    if (error) throw new Error(error.message);
    return mapProfile(data as ProfileRow);
  }

  async updateProfile(id: string, input: UpdateProfileInput): Promise<Profile> {
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error("Supabase is not configured");

    const payload: Record<string, string> = {};
    if (input.heroName !== undefined) payload.hero_name = input.heroName;
    if (input.avatarUrl !== undefined) payload.avatar_url = input.avatarUrl;
    if (input.uiMode !== undefined) payload.ui_mode = input.uiMode;

    const { data, error } = await admin
      .from("profiles")
      .update(payload)
      .eq("id", id)
      .select("id, hero_name, avatar_url, ui_mode, power_level")
      .single();

    if (error) throw new Error(error.message);
    return mapProfile(data as ProfileRow);
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

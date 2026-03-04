import { toLocalDateString } from "@/lib/date";
import { env, hasSupabaseAdmin } from "@/lib/env";
import { getLocalStore } from "@/lib/server/local-store";
import { hashPin, verifyPin } from "@/lib/server/pin";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
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
}): Profile {
  return {
    id: row.id,
    heroName: row.hero_name,
    avatarUrl: row.avatar_url,
    uiMode: row.ui_mode,
    powerLevel: row.power_level,
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
      };
    }
    const squadRow = data as SquadRow;

    return {
      squadPowerCurrent: squadRow.squad_power_current,
      squadPowerMax: squadRow.squad_power_max,
      cycleDate: squadRow.cycle_date,
    };
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

    return { profiles, missions, trashedMissions, squad };
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

    // soft-delete all missions for this profile
    const now = new Date().toISOString();
    const { error: missionError } = await admin
      .from("missions")
      .update({ deleted_at: now, is_active: false })
      .eq("profile_id", id)
      .is("deleted_at", null);

    if (missionError) throw new Error(missionError.message);

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

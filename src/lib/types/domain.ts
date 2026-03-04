export type UiMode = "text" | "picture";
export type AiProvider = "openai" | "gemini";

export interface Profile {
  id: string;
  heroName: string;
  avatarUrl: string;
  uiMode: UiMode;
  powerLevel: number;
  currentStreak: number;
  lastStreakDate: string | null;
}

export interface Mission {
  id: string;
  profileId: string;
  title: string;
  instructions: string;
  imageUrl: string | null;
  powerValue: number;
  isActive: boolean;
  recurringDaily: boolean;
  sortOrder: number;
  deletedAt: string | null;
}

export interface MissionWithState extends Mission {
  completedToday: boolean;
}

export interface SquadState {
  squadPowerCurrent: number;
  squadPowerMax: number;
  cycleDate: string;
  squadGoal: SquadGoal | null;
}

export interface SquadGoal {
  title: string;
  targetPower: number;
  rewardDescription: string;
}

export interface MissionCompletionRequest {
  missionId: string;
  profileId: string;
  clientRequestId: string;
  clientCompletedAt: string;
}

export interface MissionUncompletionRequest {
  missionId: string;
  profileId: string;
}

export interface CompletionResult {
  awarded: boolean;
  alreadyCompleted: boolean;
  profilePowerLevel: number;
  squadPowerCurrent: number;
  squadPowerMax: number;
}

export interface UncompletionResult {
  undone: boolean;
  wasCompleted: boolean;
  profilePowerLevel: number;
  squadPowerCurrent: number;
  squadPowerMax: number;
}

export interface CreateMissionInput {
  profileId: string;
  title: string;
  instructions: string;
  imageUrl?: string | null;
  powerValue: number;
  isActive?: boolean;
  recurringDaily?: boolean;
  sortOrder?: number;
}

export interface UpdateMissionInput {
  title?: string;
  instructions?: string;
  imageUrl?: string | null;
  powerValue?: number;
  isActive?: boolean;
  recurringDaily?: boolean;
  sortOrder?: number;
}

export interface AwardSquadPowerInput {
  delta: number;
  note?: string;
}

export interface Reward {
  id: string;
  title: string;
  description: string;
  pointCost: number;
  isActive: boolean;
  sortOrder: number;
}

export interface RewardClaimRow {
  id: string;
  profileId: string;
  rewardId: string;
  pointCost: number;
  claimedAt: string;
}

export interface CreateRewardInput {
  title: string;
  description: string;
  pointCost: number;
  isActive?: boolean;
  sortOrder?: number;
}

export interface UpdateRewardInput {
  title?: string;
  description?: string;
  pointCost?: number;
  isActive?: boolean;
  sortOrder?: number;
}

export interface ClaimRewardInput {
  profileId: string;
  rewardId: string;
}

export interface ClaimRewardResult {
  claimed: boolean;
  insufficientPoints: boolean;
  newPowerLevel: number;
  reward: Reward;
}

export interface MissionHistoryEntry {
  date: string;
  missions: Array<{
    title: string;
    powerAwarded: number;
  }>;
}

export interface CreateProfileInput {
  heroName: string;
  avatarUrl: string;
  uiMode: UiMode;
}

export interface UpdateProfileInput {
  heroName?: string;
  avatarUrl?: string;
  uiMode?: UiMode;
}

export interface ParentDashboardData {
  profiles: Profile[];
  missions: MissionWithState[];
  trashedMissions: MissionWithState[];
  squad: SquadState;
  rewards: Reward[];
}

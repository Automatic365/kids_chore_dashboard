export type UiMode = "text" | "picture";
export type AiProvider = "openai" | "gemini";
export type RewardStickerType = "vehicle" | "companion";
export const HERO_CARD_OBJECT_POSITIONS = [
  "top-left",
  "top-center",
  "top-right",
  "center-left",
  "center",
  "center-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
] as const;
export type HeroCardObjectPosition = (typeof HERO_CARD_OBJECT_POSITIONS)[number];
export type NotificationEventType =
  | "mission_complete"
  | "reward_claimed"
  | "reward_returned";

export interface Profile {
  id: string;
  heroName: string;
  avatarUrl: string;
  uiMode: UiMode;
  heroCardObjectPosition: HeroCardObjectPosition;
  rewardPoints: number;
  xpPoints: number;
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
  goalCompletionCount: number;
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
  force?: boolean;
}

export interface CompletionResult {
  // A mission awards at most once per cycle for recurring missions and once ever for one-off missions.
  awarded: boolean;
  alreadyCompleted: boolean;
  profileRewardPoints: number;
  profileXpPoints: number;
  profilePowerLevel: number;
  squadPowerCurrent: number;
  squadPowerMax: number;
}

export interface UncompletionResult {
  // Undo can be blocked when points were already spent unless parent override force=true is used.
  undone: boolean;
  wasCompleted: boolean;
  insufficientUnspentPoints?: boolean;
  pointsRequiredToUndo?: number;
  profileRewardPoints: number;
  profileXpPoints: number;
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
  targetDaysToEarn: number | null;
  minDaysBetweenClaims: number | null;
  isActive: boolean;
  sortOrder: number;
}

export interface RewardClaimRow {
  id: string;
  profileId: string;
  rewardId: string;
  pointCost: number;
  claimedAt: string;
  imageUrl?: string | null;
  stickerType?: RewardStickerType;
  stickerConceptId?: string | null;
  stickerPromptSeed?: string | null;
}

export interface RewardClaimEntry {
  id: string;
  rewardId: string;
  title: string;
  description: string;
  pointCost: number;
  claimedAt: string;
  imageUrl: string | null;
  stickerType?: RewardStickerType;
  stickerConceptId?: string | null;
  stickerPromptSeed?: string | null;
}

export interface CreateRewardInput {
  title: string;
  description: string;
  pointCost: number;
  targetDaysToEarn?: number | null;
  minDaysBetweenClaims?: number | null;
  isActive?: boolean;
  sortOrder?: number;
}

export interface UpdateRewardInput {
  title?: string;
  description?: string;
  pointCost?: number;
  targetDaysToEarn?: number | null;
  minDaysBetweenClaims?: number | null;
  isActive?: boolean;
  sortOrder?: number;
}

export interface ClaimRewardInput {
  profileId: string;
  rewardId: string;
  claimedAt?: string;
}

export interface ReturnRewardInput {
  profileId: string;
  rewardClaimId: string;
}

export interface ClaimRewardResult {
  // Rewards can be claimed repeatedly when a profile has enough power.
  claimed: boolean;
  insufficientPoints: boolean;
  alreadyClaimed: boolean;
  cooldownActive: boolean;
  nextClaimDate: string | null;
  cooldownDaysRemaining: number | null;
  newRewardPoints: number;
  newXpPoints: number;
  newPowerLevel: number;
  reward: Reward;
}

export interface ReturnRewardResult {
  // Returning a reward removes its claim row and restores deducted power.
  returned: boolean;
  restoredPoints: number;
  newRewardPoints: number;
  newXpPoints: number;
  newPowerLevel: number;
}

export interface MissionHistoryEntry {
  date: string;
  missions: Array<{
    title: string;
    powerAwarded: number;
  }>;
}

export interface MissionBackfillEntry {
  id: string;
  profileId: string;
  missionId: string;
  missionTitle: string;
  localDate: string;
  pointsAwarded: number;
  createdAt: string;
}

export interface CreateMissionBackfillInput {
  profileId: string;
  missionId: string;
  localDate: string;
}

export interface CreateMissionBackfillResult {
  entry: MissionBackfillEntry;
  profileRewardPoints: number;
  profileXpPoints: number;
  profilePowerLevel: number;
  squadPowerCurrent: number;
  squadPowerMax: number;
}

export interface DeleteMissionBackfillResult {
  removed: boolean;
  profileRewardPoints: number;
  profileXpPoints: number;
  profilePowerLevel: number;
  squadPowerCurrent: number;
  squadPowerMax: number;
}

export interface NotificationEvent {
  id: string;
  profileId: string;
  eventType: NotificationEventType;
  title: string;
  message: string;
  createdAt: string;
  readAt: string | null;
}

export interface MarkNotificationsReadResult {
  markedCount: number;
}

export interface CreateProfileInput {
  heroName: string;
  avatarUrl: string;
  uiMode: UiMode;
  heroCardObjectPosition?: HeroCardObjectPosition;
}

export interface UpdateProfileInput {
  heroName?: string;
  avatarUrl?: string;
  uiMode?: UiMode;
  heroCardObjectPosition?: HeroCardObjectPosition;
}

export interface ParentDashboardData {
  profiles: Profile[];
  missions: MissionWithState[];
  trashedMissions: MissionWithState[];
  squad: SquadState;
  rewards: Reward[];
}

export interface ParentSummaryMissionStat {
  title: string;
  completedCount: number;
  totalRewardPoints: number;
  totalXpPoints: number;
}

export interface ParentSummaryDay {
  date: string;
  completed: number;
  rewardPoints: number;
  xpPoints: number;
}

export interface ParentSummaryHero {
  profileId: string;
  heroName: string;
  todayCompleted: number;
  todayTotal: number;
  averageRewardPointsPerDay: number;
  averageXpPointsPerDay: number;
  topMissions: ParentSummaryMissionStat[];
  daily: ParentSummaryDay[];
}

export interface ParentSummaryHousehold {
  averageRewardPointsPerDay: number;
  averageXpPointsPerDay: number;
  averageRewardPointsPerHeroPerDay: number;
  averageXpPointsPerHeroPerDay: number;
  totalRewardPointsEarned: number;
  totalXpPointsEarned: number;
  totalCompleted: number;
  topMissions: ParentSummaryMissionStat[];
  daily: ParentSummaryDay[];
}

export interface ParentSummaryData {
  cycleDate: string;
  windowDays: number;
  days: string[];
  household: ParentSummaryHousehold;
  heroes: ParentSummaryHero[];
}

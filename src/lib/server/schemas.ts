import { z } from "zod";
import { HERO_CARD_OBJECT_POSITIONS } from "@/lib/types/domain";

export const missionCompletionSchema = z.object({
  missionId: z.string().min(1),
  profileId: z.string().min(1),
  clientRequestId: z.string().min(1),
  clientCompletedAt: z.string().datetime(),
});

export const missionUncompletionSchema = z.object({
  missionId: z.string().min(1),
  profileId: z.string().min(1),
  force: z.boolean().optional(),
});

export const parentAuthSchema = z.object({
  pin: z.string().regex(/^\d{4,8}$/),
});

export const createMissionSchema = z.object({
  profileId: z.string().min(1),
  title: z.string().min(2).max(120),
  instructions: z.string().min(1).max(1000),
  imageUrl: z.string().max(2_000_000).optional().nullable(),
  powerValue: z.number().int().min(1).max(100),
  isActive: z.boolean().optional(),
  recurringDaily: z.boolean().optional(),
  sortOrder: z.number().int().min(1).max(999).optional(),
});

export const updateMissionSchema = z
  .object({
    title: z.string().min(2).max(120).optional(),
    instructions: z.string().min(1).max(1000).optional(),
    imageUrl: z.string().max(2_000_000).optional().nullable(),
    powerValue: z.number().int().min(1).max(100).optional(),
    isActive: z.boolean().optional(),
    recurringDaily: z.boolean().optional(),
    sortOrder: z.number().int().min(1).max(999).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });

export const createProfileSchema = z.object({
  heroName: z.string().min(2).max(60),
  avatarUrl: z.string().min(1).max(2_000_000),
  uiMode: z.enum(["text", "picture"]),
  heroCardObjectPosition: z.enum(HERO_CARD_OBJECT_POSITIONS).optional(),
});

export const updateProfileSchema = z
  .object({
    heroName: z.string().min(2).max(60).optional(),
    avatarUrl: z.string().min(1).max(2_000_000).optional(),
    uiMode: z.enum(["text", "picture"]).optional(),
    heroCardObjectPosition: z.enum(HERO_CARD_OBJECT_POSITIONS).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });

export const changePinSchema = z.object({
  newPin: z.string().regex(/^\d{4,8}$/, "PIN must be 4-8 digits"),
});

export const awardSquadPowerSchema = z.object({
  delta: z.number().int().min(-100).max(100),
  note: z.string().max(240).optional(),
});

export const aiMissionGenerateSchema = z.object({
  tasks: z.array(z.string().min(1).max(280)).min(1).max(30),
  profileName: z.string().min(1).max(120).optional(),
  uiMode: z.enum(["text", "picture"]).optional(),
  provider: z.enum(["openai", "gemini"]).optional(),
  parentPin: z.string().regex(/^\d{4,8}$/).optional(),
});

export const createRewardSchema = z.object({
  title: z.string().min(2).max(120),
  description: z.string().min(1).max(500),
  pointCost: z.number().int().min(1).max(1000),
  targetDaysToEarn: z.number().int().min(1).max(30).nullable().optional(),
  minDaysBetweenClaims: z.number().int().min(1).max(365).nullable().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(1).max(999).optional(),
});

export const updateRewardSchema = z
  .object({
    title: z.string().min(2).max(120).optional(),
    description: z.string().min(1).max(500).optional(),
    pointCost: z.number().int().min(1).max(1000).optional(),
    targetDaysToEarn: z.number().int().min(1).max(30).nullable().optional(),
    minDaysBetweenClaims: z.number().int().min(1).max(365).nullable().optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().min(1).max(999).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });

export const claimRewardSchema = z.object({
  profileId: z.string().min(1),
  rewardId: z.string().min(1),
});

export const createMissionBackfillSchema = z.object({
  profileId: z.string().min(1),
  missionId: z.string().min(1),
  localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const returnRewardSchema = z.object({
  profileId: z.string().min(1),
  rewardClaimId: z.string().min(1),
});

export const setSquadGoalSchema = z.object({
  goal: z
    .object({
      title: z.string().min(2).max(120),
      targetPower: z.number().int().min(1).max(2000),
      rewardDescription: z.string().min(1).max(500),
    })
    .nullable(),
});

export const generateAvatarSchema = z.object({
  heroName: z.string().min(2).max(60),
});

export const generateRewardArtSchema = z.object({
  heroName: z.string().min(2).max(60),
  rewardTitle: z.string().min(2).max(120),
  rewardDescription: z.string().max(500).optional().nullable(),
  claimedAt: z.string().datetime().optional(),
  existingStickerConceptIds: z.array(z.string().min(1).max(120)).max(1000).optional(),
});

export const createSignedMediaUploadSchema = z.object({
  kind: z.enum(["avatar", "mission"]).optional(),
  fileName: z.string().min(1).max(260),
  fileType: z.string().min(1).max(120),
  fileSize: z.number().int().min(1).max(10 * 1024 * 1024),
});

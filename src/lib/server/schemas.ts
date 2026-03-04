import { z } from "zod";

export const missionCompletionSchema = z.object({
  missionId: z.string().min(1),
  profileId: z.string().min(1),
  clientRequestId: z.string().min(1),
  clientCompletedAt: z.string().datetime(),
});

export const missionUncompletionSchema = z.object({
  missionId: z.string().min(1),
  profileId: z.string().min(1),
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
  avatarUrl: z.string().min(1).max(2000),
  uiMode: z.enum(["text", "picture"]),
});

export const updateProfileSchema = z
  .object({
    heroName: z.string().min(2).max(60).optional(),
    avatarUrl: z.string().min(1).max(2000).optional(),
    uiMode: z.enum(["text", "picture"]).optional(),
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

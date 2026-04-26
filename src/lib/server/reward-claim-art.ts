import { randomUUID } from "node:crypto";

import { reportError } from "@/lib/monitoring";
import {
  buildStickerPrompt,
  generateRewardStickerDataUrl,
  isStickerReward,
  selectStickerConcept,
} from "@/lib/reward-art";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { RewardStickerType } from "@/lib/types/domain";

const MEDIA_BUCKET = "hero-media";

export interface RewardClaimArtResult {
  imageUrl: string;
  stickerType?: RewardStickerType;
  stickerConceptId?: string | null;
  stickerPromptSeed?: string | null;
}

interface GenerateRewardClaimArtParams {
  rewardTitle: string;
  rewardDescription?: string | null;
  heroName: string;
  claimedAt: string;
  existingStickerConceptIds?: string[];
}

function fallbackArt(params: GenerateRewardClaimArtParams): RewardClaimArtResult {
  const selection = isStickerReward({
    rewardTitle: params.rewardTitle,
    rewardDescription: params.rewardDescription,
  })
    ? selectStickerConcept({
        heroName: params.heroName,
        claimedAt: params.claimedAt,
        existingStickerConceptIds: params.existingStickerConceptIds,
      })
    : null;

  return {
    imageUrl: generateRewardStickerDataUrl({
      rewardTitle: params.rewardTitle,
      heroName: params.heroName,
      claimedAt: params.claimedAt,
      stickerType: selection?.stickerType,
      stickerConceptId: selection?.stickerConceptId,
      stickerPromptSeed: selection?.stickerPromptSeed,
      existingStickerConceptIds: params.existingStickerConceptIds,
    }),
    stickerType: selection?.stickerType,
    stickerConceptId: selection?.stickerConceptId ?? null,
    stickerPromptSeed: selection?.stickerPromptSeed ?? null,
  };
}

function toDataUrl(buffer: Buffer, contentType: string): string {
  return `data:${contentType};base64,${buffer.toString("base64")}`;
}

async function uploadToStorage(buffer: Buffer, contentType: string): Promise<string | null> {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return null;
  }

  const ext = contentType.split("/")[1] || "png";
  const objectPath = `rewards/${Date.now()}-${randomUUID()}.${ext}`;
  const { error } = await admin.storage.from(MEDIA_BUCKET).upload(objectPath, buffer, {
    contentType,
    upsert: false,
  });

  if (error) {
    reportError(error, { surface: "reward_claim_art_upload" });
    return null;
  }

  const { data } = admin.storage.from(MEDIA_BUCKET).getPublicUrl(objectPath);
  return data.publicUrl || null;
}

async function generateOpenAiSticker(
  prompt: string,
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_IMAGE_MODEL ?? "dall-e-3",
      prompt,
      size: "1024x1024",
      quality: "standard",
    }),
  });

  if (!response.ok) {
    const payload = await response.text().catch(() => "");
    reportError(new Error(`Reward sticker generation failed: ${payload || response.statusText}`), {
      surface: "reward_claim_art_openai",
      status: response.status,
    });
    return null;
  }

  const payload = (await response.json()) as {
    data?: Array<{ b64_json?: string; url?: string }>;
  };
  const image = payload.data?.[0];
  if (!image) {
    return null;
  }

  if (image.b64_json) {
    return {
      buffer: Buffer.from(image.b64_json, "base64"),
      contentType: "image/png",
    };
  }

  if (!image.url) {
    return null;
  }

  const imageResponse = await fetch(image.url);
  if (!imageResponse.ok) {
    return null;
  }

  return {
    buffer: Buffer.from(await imageResponse.arrayBuffer()),
    contentType: imageResponse.headers.get("content-type") ?? "image/png",
  };
}

export async function generateRewardClaimArt(
  params: GenerateRewardClaimArtParams,
): Promise<RewardClaimArtResult> {
  const stickerReward = isStickerReward({
    rewardTitle: params.rewardTitle,
    rewardDescription: params.rewardDescription,
  });
  const fallback = fallbackArt(params);

  if (!stickerReward || !fallback.stickerType || !fallback.stickerConceptId) {
    return fallback;
  }

  try {
    const generated = await generateOpenAiSticker(
      buildStickerPrompt({
        rewardTitle: params.rewardTitle,
        rewardDescription: params.rewardDescription,
        heroName: params.heroName,
        selection: {
          stickerType: fallback.stickerType,
          stickerConceptId: fallback.stickerConceptId,
          stickerPromptSeed: fallback.stickerPromptSeed ?? "",
        },
      }),
    );
    if (!generated) {
      return fallback;
    }

    const uploadedUrl = await uploadToStorage(generated.buffer, generated.contentType);
    if (uploadedUrl) {
      return {
        ...fallback,
        imageUrl: uploadedUrl,
      };
    }

    return {
      ...fallback,
      imageUrl: toDataUrl(generated.buffer, generated.contentType),
    };
  } catch (error) {
    reportError(error, { surface: "reward_claim_art" });
    return fallback;
  }
}

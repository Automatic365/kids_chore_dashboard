import { err, getRequestId, ok } from "@/lib/server/api";
import { generateRewardClaimArt } from "@/lib/server/reward-claim-art";
import { generateRewardArtSchema } from "@/lib/server/schemas";

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  const body = await request.json().catch(() => null);
  const parsed = generateRewardArtSchema.safeParse(body);

  if (!parsed.success) {
    return err(400, "INVALID_REQUEST", "Invalid request", requestId, parsed.error.flatten());
  }

  const claimedAt = parsed.data.claimedAt ?? new Date().toISOString();
  const art = await generateRewardClaimArt({
    rewardTitle: parsed.data.rewardTitle,
    rewardDescription: parsed.data.rewardDescription ?? null,
    heroName: parsed.data.heroName,
    claimedAt,
    existingStickerConceptIds: parsed.data.existingStickerConceptIds,
  });

  return ok(art, requestId);
}

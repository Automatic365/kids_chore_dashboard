export const MISSION_BACKFILL_CLIENT_REQUEST_PREFIX = "parent-backfill:";

function randomSuffix(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function buildMissionBackfillClientRequestId(input: {
  profileId: string;
  missionId: string;
  localDate: string;
}): string {
  return `${MISSION_BACKFILL_CLIENT_REQUEST_PREFIX}${input.profileId}:${input.missionId}:${input.localDate}:${randomSuffix()}`;
}

export function isMissionBackfillClientRequestId(clientRequestId: string): boolean {
  return clientRequestId.startsWith(MISSION_BACKFILL_CLIENT_REQUEST_PREFIX);
}

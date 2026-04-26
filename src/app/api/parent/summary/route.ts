import { NextResponse } from "next/server";

import { ANALYTICS_MAX_WINDOW_DAYS, ANALYTICS_START_DATE } from "@/lib/analytics-config";
import { buildParentSummary } from "@/lib/parent-analytics";
import { isParentAuthenticated } from "@/lib/server/auth";
import { getRepository } from "@/lib/server/repository";

export async function GET() {
  if (!(await isParentAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const repo = getRepository();
  const [profiles, squad] = await Promise.all([repo.getProfiles(), repo.getSquadState()]);
  const profileData = await Promise.all(
    profiles.map(async (profile) => {
      const [missions, history] = await Promise.all([
        repo.getMissions(profile.id),
        repo.getMissionHistory(profile.id, ANALYTICS_MAX_WINDOW_DAYS),
      ]);
      return { profileId: profile.id, missions, history };
    }),
  );

  return NextResponse.json(
    buildParentSummary({
      cycleDate: squad.cycleDate,
      windowDays: ANALYTICS_MAX_WINDOW_DAYS,
      analyticsStartDate: ANALYTICS_START_DATE,
      profiles,
      missionsByProfileId: new Map(profileData.map((entry) => [entry.profileId, entry.missions])),
      historyByProfileId: new Map(profileData.map((entry) => [entry.profileId, entry.history])),
    }),
  );
}

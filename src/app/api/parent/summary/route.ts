import { NextResponse } from "next/server";

import { isParentAuthenticated } from "@/lib/server/auth";
import { getRepository } from "@/lib/server/repository";

function buildDateWindow(endDate: string, days: number): string[] {
  const last = new Date(`${endDate}T00:00:00.000Z`);
  const values: string[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const next = new Date(last);
    next.setUTCDate(last.getUTCDate() - i);
    values.push(next.toISOString().slice(0, 10));
  }
  return values;
}

export async function GET() {
  if (!(await isParentAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const repo = getRepository();
  const [profiles, squad] = await Promise.all([repo.getProfiles(), repo.getSquadState()]);
  const days = buildDateWindow(squad.cycleDate, 7);

  const heroes = await Promise.all(
    profiles.map(async (profile) => {
      const [missions, history] = await Promise.all([
        repo.getMissions(profile.id),
        repo.getMissionHistory(profile.id, 7),
      ]);
      const countByDate = new Map(history.map((entry) => [entry.date, entry.missions.length]));

      return {
        profileId: profile.id,
        heroName: profile.heroName,
        todayCompleted: countByDate.get(squad.cycleDate) ?? 0,
        todayTotal: missions.length,
        daily: days.map((date) => ({
          date,
          completed: countByDate.get(date) ?? 0,
        })),
      };
    }),
  );

  return NextResponse.json({
    cycleDate: squad.cycleDate,
    days,
    heroes,
  });
}
